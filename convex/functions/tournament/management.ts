import { and, eq, unsetToken } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import {
  collectReplacedStorageIds,
  deleteStorageIds,
} from "../../shared/media-rules";
import {
  type CategorySyncExistingRow,
  resolveCategorySyncPlan,
} from "../../domains/tournament/category-rules";
import { ENTRY_LIVE_STATUSES } from "../../domains/tournament/entry-rules";
import {
  findRemovedScheduledCourt,
  validateTournamentEditStatus,
} from "../../domains/tournament/management-rules";
import {
  brazilDayKey,
  findScheduledMatchesBeyondWindowEnd,
  formatShortenWindowError,
} from "../../domains/tournament/window-rules";
import {
  CreateTournamentSchema,
  DeleteTournamentSchema,
  MAX_TOURNAMENT_CATEGORIES,
  TournamentByIdSchema,
  type TournamentOrganizerCategory,
  type TournamentStatus,
  UpdateTournamentSchema,
  tournamentOrganizerCategorySchema,
  tournamentSchema,
} from "../../domains/tournament/contract";
import {
  tournament,
  tournamentCategory,
} from "../../domains/tournament/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";
import {
  getManagedTournamentOrThrow,
  isUniqueIndexViolation,
  scheduleTournamentNotification,
  serializeCategory,
  serializeTournament,
  type OrmCtx,
  type OrmMutationCtx,
} from "./_shared/guards";
import { listTournamentMatchRecords } from "./_shared/match_writes";

type CategoryInput = z.infer<typeof CreateTournamentSchema>["categories"];

/**
 * Inscricoes VIVAS da categoria: reservam vaga (travam remocao e troca de tipo)
 * e sao o numero que o organizador ve na tela de edicao.
 */
function listLiveEntriesInCategory(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">
) {
  return ctx.orm.query.tournamentEntry.findMany({
    limit: 300,
    where: { categoryId, status: { in: [...ENTRY_LIVE_STATUSES] } },
  });
}

/** Estado de cada categoria gravada que o diff precisa para decidir. */
async function collectExistingCategoryRows(
  ctx: OrmCtx,
  tournamentId: Id<"tournament">
) {
  const existing = await ctx.orm.query.tournamentCategory.findMany({
    limit: MAX_TOURNAMENT_CATEGORIES,
    where: { tournamentId },
  });

  const rows: CategorySyncExistingRow[] = [];
  for (const category of existing) {
    const categoryId = category.id as Id<"tournamentCategory">;
    const [liveEntries, matches] = await Promise.all([
      listLiveEntriesInCategory(ctx, categoryId),
      ctx.orm.query.tournamentMatch.findMany({
        limit: 300,
        where: { categoryId },
      }),
    ]);
    rows.push({
      activeEntryCount: liveEntries.filter((entry) => entry.status === "active")
        .length,
      gender: category.gender,
      id: category.id as string,
      liveEntryCount: liveEntries.length,
      matchCount: matches.length,
      modality: category.modality,
      name: category.name,
    });
  }
  return rows;
}

/**
 * Category sync by DIFF: the payload carries the `id` of every category it
 * keeps, so never delete+recreate — the cascade would wipe entries/matches of
 * published tournaments and orphan paid charges with no refund. The decision
 * (unknown id, duplicate name in the same type, type lock, capacity floor,
 * removal) lives in `resolveCategorySyncPlan`; here we only read the current
 * state and apply the plan. Deletes run FIRST so a freed name can be reused in
 * the same payload without tripping the unique index.
 */
async function syncCategories(
  ctx: OrmMutationCtx,
  tournamentId: Id<"tournament">,
  categories: CategoryInput
) {
  const result = resolveCategorySyncPlan({
    existing: await collectExistingCategoryRows(ctx, tournamentId),
    next: categories,
  });
  if ("error" in result) {
    throw new CRPCError({
      code: result.error.code,
      message: result.error.message,
    });
  }

  const now = new Date();
  try {
    for (const id of result.plan.deletes) {
      await ctx.orm
        .delete(tournamentCategory)
        .where(eq(tournamentCategory.id, id as Id<"tournamentCategory">));
    }
    for (const category of result.plan.updates) {
      await ctx.orm
        .update(tournamentCategory)
        .set({
          entryFeeCents: category.entryFeeCents,
          gender: category.gender,
          maxEntries: category.maxEntries,
          modality: category.modality,
          name: category.name,
          nameKey: category.nameKey,
          updatedAt: now,
        })
        .where(
          eq(tournamentCategory.id, category.id as Id<"tournamentCategory">)
        );
    }
    for (const category of result.plan.inserts) {
      await ctx.orm.insert(tournamentCategory).values({
        createdAt: now,
        entryFeeCents: category.entryFeeCents,
        gender: category.gender,
        maxEntries: category.maxEntries,
        modality: category.modality,
        name: category.name,
        nameKey: category.nameKey,
        tournamentId,
        updatedAt: now,
      });
    }
  } catch (error) {
    // Troca de nomes entre categorias ("A" <-> "B") colide no meio do caminho:
    // o indice unico e a rede, e o cliente ve a mesma recusa da regra.
    if (isUniqueIndexViolation(error)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Já existe uma categoria com esse nome nesse tipo.",
      });
    }
    throw error;
  }
}

export const listMine = authQuery
  .output(z.array(tournamentSchema))
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);
    const records = await ctx.orm.query.tournament.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
      where: { organizationId },
    });
    return Promise.all(
      records.map((record) => serializeTournament(ctx, record))
    );
  });
export const getById = authQuery
  .input(TournamentByIdSchema)
  .output(
    z.object({
      categories: z.array(tournamentOrganizerCategorySchema),
      tournament: tournamentSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: MAX_TOURNAMENT_CATEGORIES,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    const categoriesWithCounts: TournamentOrganizerCategory[] = [];
    for (const category of categories) {
      const liveEntries = await listLiveEntriesInCategory(
        ctx,
        category.id as Id<"tournamentCategory">
      );
      categoriesWithCounts.push({
        ...serializeCategory(category),
        liveEntryCount: liveEntries.length,
      });
    }
    return {
      categories: categoriesWithCounts,
      tournament: await serializeTournament(ctx, record),
    };
  });

export const generateUploadUrl = authMutation
  .output(z.string())
  .mutation(async ({ ctx }) => {
    await requireActiveManager(ctx);
    return ctx.storage.generateUploadUrl();
  });

export const create = authMutation
  .input(CreateTournamentSchema)
  .output(tournamentSchema)
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);
    const now = new Date();
    const { categories, endDate, ...tournamentInput } = input;

    const [created] = await ctx.orm
      .insert(tournament)
      .values({
        ...tournamentInput,
        createdAt: now,
        // Sem fim informado o torneio nasce sem teto (comportamento de hoje).
        ...(endDate === null || endDate === undefined
          ? {}
          : { endDate: new Date(endDate) }),
        organizationId,
        registrationDeadlineAt: new Date(
          tournamentInput.registrationDeadlineAt
        ),
        startDate: new Date(tournamentInput.startDate),
        status: "draft",
        updatedAt: now,
      })
      .returning();

    await syncCategories(ctx, created.id as Id<"tournament">, categories);
    return serializeTournament(ctx, created);
  });

export const update = authMutation
  .input(UpdateTournamentSchema)
  .output(tournamentSchema)
  .mutation(async ({ ctx, input }) => {
    const current = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    // Drawn and ONGOING are both adjustment phases (user decision after the
    // drawn-only lockdown proved too narrow); only finished stays frozen.
    const statusError = validateTournamentEditStatus(
      current.status as TournamentStatus
    );
    if (statusError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: statusError });
    }

    // A court that LEFT the list may not break an existing booking
    // (mirrors the entry-safe category sync below).
    const nextCourtIds = new Set(
      input.courts.map((court: { id: string }) => court.id)
    );
    const removedCourtIds = new Set(
      ((current.courts ?? []) as Array<{ id: string }>)
        .map((court) => court.id)
        .filter((courtId) => !nextCourtIds.has(courtId))
    );

    // Janela: definir/encurtar o fim só passa sem confronto agendado além dele
    // que ainda dê pra remarcar (publicado não volta pra agenda); estender (ou
    // tirar o fim) avisa quem está no torneio.
    const nextEndDayKey =
      input.endDate === null || input.endDate === undefined
        ? null
        : brazilDayKey(input.endDate);
    const currentEndDayKey = current.endDate
      ? brazilDayKey(current.endDate.getTime())
      : null;
    const shortensWindow =
      nextEndDayKey !== null &&
      (currentEndDayKey === null || nextEndDayKey < currentEndDayKey);
    const extendsWindow =
      nextEndDayKey !== null &&
      currentEndDayKey !== null &&
      nextEndDayKey > currentEndDayKey;

    const tournamentMatches =
      removedCourtIds.size > 0 || shortensWindow
        ? await listTournamentMatchRecords(ctx, current.id as Id<"tournament">)
        : [];
    if (shortensWindow) {
      const beyond = findScheduledMatchesBeyondWindowEnd({
        endDayKey: nextEndDayKey,
        matches: tournamentMatches,
      });
      if (beyond) {
        throw new CRPCError({
          code: "CONFLICT",
          message: formatShortenWindowError({
            count: beyond.count,
            endDayKey: nextEndDayKey,
          }),
        });
      }
    }
    if (removedCourtIds.size > 0) {
      const removedCourtId = findRemovedScheduledCourt({
        removedCourtIds,
        scheduledMatches: tournamentMatches,
      });
      if (removedCourtId) {
        const removedCourt = (
          (current.courts ?? []) as Array<{
            id: string;
            name: string;
          }>
        ).find((court) => court.id === removedCourtId);
        throw new CRPCError({
          code: "CONFLICT",
          message: `A quadra "${removedCourt?.name ?? removedCourtId}" tem partida agendada e não pode ser removida.`,
        });
      }
    }

    const replacedStorageIds = collectReplacedStorageIds("avatarStorageId", {
      next: input,
      previous: current,
    }).concat(
      collectReplacedStorageIds("coverStorageId", {
        next: input,
        previous: current,
      })
    );

    const now = new Date();
    const { categories, endDate, tournamentId, ...rest } = input;
    const [updated] = await ctx.orm
      .update(tournament)
      .set({
        ...rest,
        // Ausente = janela intocada; nulo = volta a ficar sem teto.
        ...(endDate === undefined
          ? {}
          : { endDate: endDate === null ? unsetToken : new Date(endDate) }),
        registrationDeadlineAt: new Date(rest.registrationDeadlineAt),
        startDate: new Date(rest.startDate),
        updatedAt: now,
      })
      .where(
        and(
          eq(tournament.id, current.id),
          eq(tournament.organizationId, current.organizationId)
        )!
      )
      .returning();

    await syncCategories(ctx, updated.id as Id<"tournament">, categories);
    await deleteStorageIds(ctx, replacedStorageIds);

    // Estender a janela muda a vida de quem está no torneio: o aviso sai só
    // quando o fim ANDA para frente.
    if (extendsWindow && nextEndDayKey !== null) {
      const recipients = new Set<Id<"user">>();
      const tournamentCategories =
        await ctx.orm.query.tournamentCategory.findMany({
          limit: MAX_TOURNAMENT_CATEGORIES,
          where: { tournamentId: updated.id as Id<"tournament"> },
        });
      for (const category of tournamentCategories) {
        const entries = await ctx.orm.query.tournamentEntry.findMany({
          limit: 300,
          where: {
            categoryId: category.id as Id<"tournamentCategory">,
            status: "active",
          },
        });
        for (const entry of entries) {
          if (entry.createdByUserId) {
            recipients.add(entry.createdByUserId as Id<"user">);
          }
          if (entry.partnerUserId) {
            recipients.add(entry.partnerUserId as Id<"user">);
          }
        }
      }
      if (recipients.size > 0) {
        await scheduleTournamentNotification(ctx, {
          eventType: "tournament.window_extended",
          metadata: { endDate: nextEndDayKey },
          recipientUserIds: [...recipients],
          tournamentId: updated.id as Id<"tournament">,
        });
      }
    }

    return serializeTournament(ctx, updated);
  });

export const publish = authMutation
  .input(TournamentByIdSchema)
  .output(tournamentSchema)
  .mutation(async ({ ctx, input }) => {
    const current = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (current.status !== "draft") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Apenas rascunhos podem ser publicados.",
      });
    }

    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournament)
      .set({ status: "published", updatedAt: now })
      .where(eq(tournament.id, current.id))
      .returning();
    return serializeTournament(ctx, updated);
  });

export const remove = authMutation
  .input(DeleteTournamentSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const current = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    if (current.status !== "draft") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Apenas rascunhos podem ser removidos. Cancele torneios já publicados.",
      });
    }

    const replacedStorageIds = [
      ...collectReplacedStorageIds("avatarStorageId", {
        next: { avatarStorageId: null },
        previous: current,
      }),
      ...collectReplacedStorageIds("coverStorageId", {
        next: { coverStorageId: null },
        previous: current,
      }),
    ];

    // Categories/entries/matches cascade via FKs (tables.ts onDelete).
    await ctx.orm.delete(tournament).where(eq(tournament.id, current.id));
    await deleteStorageIds(ctx, replacedStorageIds);

    return { success: true };
  });
