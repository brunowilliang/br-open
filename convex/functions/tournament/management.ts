import { and, eq } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import {
  collectReplacedStorageIds,
  deleteStorageIds,
} from "../../shared/media-rules";
import { buildCategoryDisplayName } from "../../domains/tournament/entry-rules";
import {
  CreateTournamentSchema,
  DeleteTournamentSchema,
  TournamentByIdSchema,
  UpdateTournamentSchema,
  tournamentCategorySchema,
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
  serializeCategory,
  serializeTournament,
  type OrmMutationCtx,
} from "./_shared/guards";

type CategoryInput = z.infer<typeof CreateTournamentSchema>["categories"];
/**
 * Category sync by DIFF (H2 fix) — categories are keyed by their natural
 * pair (modality, gender; backed by uniqueIndex). Never delete+recreate:
 * the cascade would wipe entries/matches of published tournaments and
 * orphan paid charges with no refund. Instead: UPDATE kept pairs (fee/
 * caps, with a capacity floor), DELETE only removed pairs with zero
 * entries (with entries the caller gets a clear error), INSERT new pairs.
 */
async function syncCategories(
  ctx: OrmMutationCtx,
  tournamentId: Id<"tournament">,
  categories: CategoryInput
) {
  const existing = await ctx.orm.query.tournamentCategory.findMany({
    limit: 10,
    where: { tournamentId },
  });
  const existingByKey = new Map(
    existing.map((category) => [
      `${category.modality}:${category.gender}`,
      category,
    ])
  );
  const now = new Date();

  for (const category of categories) {
    const key = `${category.modality}:${category.gender}`;
    const current = existingByKey.get(key);

    if (!current) {
      await ctx.orm.insert(tournamentCategory).values({
        createdAt: now,
        displayName: buildCategoryDisplayName(
          category.modality,
          category.gender
        ),
        entryFeeCents: category.entryFeeCents,
        gender: category.gender,
        maxEntries: category.maxEntries,
        modality: category.modality,
        tournamentId,
        updatedAt: now,
      });
      continue;
    }

    // Capacity floor: the new cap can never strand existing entries.
    if (category.maxEntries !== null) {
      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: {
          categoryId: current.id as Id<"tournamentCategory">,
          status: "active",
        },
      });
      if (category.maxEntries < entries.length) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: `A categoria ${current.displayName} já tem ${entries.length} inscrições — o limite não pode ser menor que isso.`,
        });
      }
    }

    await ctx.orm
      .update(tournamentCategory)
      .set({
        entryFeeCents: category.entryFeeCents,
        maxEntries: category.maxEntries,
        updatedAt: now,
      })
      .where(eq(tournamentCategory.id, current.id as Id<"tournamentCategory">));
  }

  const inputKeys = new Set(
    categories.map((category) => `${category.modality}:${category.gender}`)
  );
  for (const category of existing) {
    if (inputKeys.has(`${category.modality}:${category.gender}`)) {
      continue;
    }
    const entries = await ctx.orm.query.tournamentEntry.findMany({
      limit: 300,
      where: {
        categoryId: category.id as Id<"tournamentCategory">,
        status: {
          in: [
            "pending_partner",
            "pending_approval",
            "awaiting_payment",
            "active",
          ],
        },
      },
    });
    if (entries.length > 0) {
      throw new CRPCError({
        code: "CONFLICT",
        message: `A categoria ${category.displayName} tem inscrições e não pode ser removida.`,
      });
    }
    await ctx.orm
      .delete(tournamentCategory)
      .where(
        eq(tournamentCategory.id, category.id as Id<"tournamentCategory">)
      );
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
      categories: z.array(tournamentCategorySchema),
      tournament: tournamentSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const record = await getManagedTournamentOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    return {
      categories: categories.map(serializeCategory),
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
    const { categories, ...tournamentInput } = input;

    const [created] = await ctx.orm
      .insert(tournament)
      .values({
        ...tournamentInput,
        createdAt: now,
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
    if (current.status !== "draft" && current.status !== "published") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Torneios sorteados ou em andamento não podem ser editados.",
      });
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
    const { categories, tournamentId, ...rest } = input;
    const [updated] = await ctx.orm
      .update(tournament)
      .set({
        ...rest,
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
