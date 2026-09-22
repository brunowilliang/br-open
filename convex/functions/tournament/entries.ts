import { eq, unsetToken } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../generated/server";
import {
  CreateTournamentEntrySchema,
  SetEntryRoundSchema,
  SetEntrySeedSchema,
  TournamentEntryActionSchema,
  tournamentEntrySchema,
  tournamentEntryWithPlayersSchema,
  type TournamentGender,
  type TournamentModality,
  type TournamentPlayerCard,
} from "../../domains/tournament/contract";
import {
  ENTRY_LIVE_STATUSES,
  entrySlotFields,
  isRegistrationOpen,
  normalizeUsernameLookup,
  registrationClosedMessage,
  resolveCallerEligibility,
  resolveEntryStatusAfterPartnerAccepted,
  selectViewerTournamentEntryIds,
  validateEntryGenders,
} from "../../domains/tournament/entry-rules";
import type { InferSelectModel } from "kitcn/orm";
import {
  type tournamentCategory,
  tournamentEntry,
} from "../../domains/tournament/tables";
import { paymentCharge } from "../../domains/payment/tables";

type EntryRecord = InferSelectModel<typeof tournamentEntry>;
type CategoryRecord = InferSelectModel<typeof tournamentCategory>;
import { authMutation, authQuery } from "../../lib/crpc";
import {
  getViewerContext,
  requireActivePlayerProfile,
} from "../viewer/context";
import {
  getCategoryRecordOrThrow,
  getManagedTournamentOrThrow,
  getTournamentManagerUserIds,
  getTournamentRecordOrThrow,
  isDiscoverable,
  scheduleTournamentNotification,
  serializePlayerCard,
  type OrmCtx,
  type TournamentRecord,
} from "./_shared/guards";

function serializeEntry(record: EntryRecord) {
  return tournamentEntrySchema.parse({
    categoryId: record.categoryId,
    createdAt: record.createdAt.getTime(),
    createdByUserId: record.createdByUserId ?? null,
    entryRound: record.entryRound ?? null,
    id: record.id,
    partnerUserId: record.partnerUserId ?? null,
    playerAId: record.playerAId,
    playerBId: record.playerBId ?? null,
    seedRank: record.seedRank ?? null,
    status: record.status,
    updatedAt: record.updatedAt.getTime(),
  });
}

async function getCategoryAndTournament(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">
): Promise<{ category: CategoryRecord; tournament: TournamentRecord }> {
  const category = await getCategoryRecordOrThrow(ctx, categoryId);

  const tournamentRecord = await getTournamentRecordOrThrow(
    ctx,
    category.tournamentId as Id<"tournament">
  );
  return { category, tournament: tournamentRecord };
}

async function getEntryOrThrow(
  ctx: OrmCtx,
  entryId: Id<"tournamentEntry">
): Promise<EntryRecord> {
  const entry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { id: entryId },
  });
  if (!entry) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Inscrição não encontrada.",
    });
  }
  return entry;
}

async function findPlayerProfileByUsername(ctx: OrmCtx, username: string) {
  const normalized = normalizeUsernameLookup(username);
  const user = await ctx.orm.query.user.findFirst({
    where: { username: normalized },
  });
  if (!user) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Não encontramos esse usuário.",
    });
  }
  const profile = await ctx.orm.query.playerProfile.findFirst({
    where: { userId: user.id as Id<"user"> },
  });
  if (!profile) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Esse usuário ainda não tem perfil de jogador.",
    });
  }
  return { profile, user };
}

async function countActiveEntriesInCategory(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">,
  ignoreEntryId?: Id<"tournamentEntry">
) {
  const entries = await ctx.orm.query.tournamentEntry.findMany({
    limit: 300,
    where: { categoryId, status: "active" },
  });
  return entries.filter((entry) => entry.id !== ignoreEntryId).length;
}

async function assertCategoryCapacity(ctx: OrmCtx, category: CategoryRecord) {
  if (category.maxEntries === null) {
    return;
  }
  const active = await countActiveEntriesInCategory(
    ctx,
    category.id as Id<"tournamentCategory">
  );
  if (active >= category.maxEntries) {
    throw new CRPCError({
      code: "CONFLICT",
      message: "Essa categoria está lotada.",
    });
  }
}

/**
 * One player, one side. Rejects when any given profile already participates in
 * ANY non-terminal entry of the category, as playerA OR playerB — the DB unique
 * indexes only guard same-side duplicates, so a player could otherwise enter
 * twice through opposite sides of two entries.
 */
async function assertPlayersNotInCategory(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">,
  playerProfileIds: string[],
  options?: { ignoreEntryId?: Id<"tournamentEntry"> }
) {
  if (playerProfileIds.length === 0) {
    return;
  }
  const entries = await ctx.orm.query.tournamentEntry.findMany({
    limit: 300,
    where: {
      categoryId,
      status: { in: [...ENTRY_LIVE_STATUSES] },
    },
  });
  const idSet = new Set(playerProfileIds);
  for (const entry of entries) {
    if (options?.ignoreEntryId && entry.id === options.ignoreEntryId) {
      continue;
    }
    if (
      (entry.playerAId !== null && idSet.has(entry.playerAId as string)) ||
      (entry.playerBId !== null && idSet.has(entry.playerBId as string))
    ) {
      throw new CRPCError({
        code: "CONFLICT",
        message:
          "Esse jogador já está inscrito nessa categoria em outra inscrição.",
      });
    }
  }
}

function assertRegistrationOpen(
  tournamentRecord: { registrationDeadlineAt: Date; status: string },
  now: Date
) {
  // `drawn` keeps entries open: the deadline is the only closer (incremental
  // placement puts the entry straight into the bracket).
  const window = {
    nowMs: now.getTime(),
    registrationDeadlineMs: tournamentRecord.registrationDeadlineAt.getTime(),
    status: tournamentRecord.status,
  };
  if (!isRegistrationOpen(window)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: registrationClosedMessage(window),
    });
  }
}

function resolveInitialStatus(entryFeeCents: number, approvalMode: string) {
  if (entryFeeCents > 0) {
    return approvalMode === "manual" ? "pending_approval" : "awaiting_payment";
  }
  return approvalMode === "manual" ? "pending_approval" : "active";
}

async function notifyEntryCreatedForApproval(
  ctx: MutationCtx,
  input: {
    createdByUserId: Id<"user">;
    entry: EntryRecord;
    tournament: TournamentRecord;
  }
) {
  const managerIds = await getTournamentManagerUserIds(
    ctx as unknown as OrmCtx,
    input.tournament.organizationId
  );
  if (managerIds.length === 0) {
    return;
  }
  await scheduleTournamentNotification(ctx, {
    actorUserId: input.createdByUserId,
    eventType: "tournament.entry.created",
    // O id da inscricao viaja no `data` para o botao Aprovar / Recusar do
    // organizador (o mesmo `entryId` que `entries.approve` exige).
    metadata: { entryId: input.entry.id as string },
    recipientUserIds: managerIds,
    sourceEntityId: input.entry.id as string,
    sourceEntityType: "tournamentEntry",
    tournamentId: input.tournament.id as Id<"tournament">,
  });
}

async function notifyEntryConfirmed(
  ctx: MutationCtx,
  input: { entry: EntryRecord; tournamentId: Id<"tournament"> }
) {
  const recipients: Id<"user">[] = [];
  if (input.entry.createdByUserId) {
    recipients.push(input.entry.createdByUserId as Id<"user">);
  }
  if (input.entry.partnerUserId) {
    recipients.push(input.entry.partnerUserId as Id<"user">);
  }
  await scheduleTournamentNotification(ctx, {
    eventType: "tournament.entry.confirmed",
    recipientUserIds: recipients,
    sourceEntityId: input.entry.id as string,
    sourceEntityType: "tournamentEntry",
    tournamentId: input.tournamentId,
  });
}

/**
 * An entry that just became ACTIVE joins its category bracket at once
 * (incremental placement: birth with the 2nd confirmed, a random open slot
 * afterwards, one new bottom round when full). The core no-ops outside the
 * pre-start window or below 2 active entries.
 */
async function placeEntryIntoBracket(
  ctx: MutationCtx,
  input: { entry: EntryRecord }
) {
  await ctx.runMutation(internal.tournament.placement.placeActiveEntry, {
    categoryId: input.entry.categoryId as string,
    entryId: input.entry.id as string,
  });
}

/** Bracket mirrors the cancellation: the slot goes empty ("A definir"). */
async function removeEntryFromBracket(
  ctx: MutationCtx,
  input: { entry: EntryRecord }
) {
  await ctx.runMutation(internal.tournament.placement.removeCancelledEntry, {
    categoryId: input.entry.categoryId as string,
    entryId: input.entry.id as string,
  });
}

/**
 * Cancelling a PAID entry marks its charge(s) refund-pending and hands off to the
 * refund pipeline (processRefunds + the 15min sweep). The creator, who paid, is
 * told the refund started.
 */
async function scheduleEntryRefund(
  ctx: MutationCtx,
  input: { entry: EntryRecord; tournamentId: Id<"tournament"> }
) {
  const charges = await ctx.orm.query.paymentCharge.findMany({
    limit: 10,
    where: {
      sourceId: input.entry.id as string,
      sourceType: "tournament_entry",
      status: "PAID",
    },
  });
  const refundable = charges.filter(
    (charge) => charge.refundStatus === null || charge.refundStatus === "failed"
  );
  if (refundable.length === 0) {
    return;
  }
  const now = new Date();
  for (const charge of refundable) {
    await ctx.orm
      .update(paymentCharge)
      .set({ refundStatus: "pending", updatedAt: now })
      .where(eq(paymentCharge.id, charge.id));
  }
  await ctx.scheduler.runAfter(
    0,
    internal.tournament.lifecycle.processRefunds,
    { tournamentId: input.tournamentId as string }
  );
  if (input.entry.createdByUserId) {
    await scheduleTournamentNotification(ctx, {
      eventType: "tournament.entry.refund_requested",
      recipientUserIds: [input.entry.createdByUserId as Id<"user">],
      sourceEntityId: input.entry.id as string,
      sourceEntityType: "tournamentEntry",
      tournamentId: input.tournamentId,
    });
  }
}

/**
 * Last-resort race net for entry inserts: the code guard
 * (`assertPlayersNotInCategory`) plus the mirrored-slot unique indexes make a
 * duplicate virtually impossible, but two concurrent creates can still
 * interleave check and insert — the client must see a treated CONFLICT, never
 * the raw unique-index 500.
 */
function isUniqueIndexViolation(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Unique index") &&
    error.message.includes("violation")
  );
}

export const create = authMutation
  .input(CreateTournamentEntrySchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const playerProfileId = (await requireActivePlayerProfile(
      ctx
    )) as Id<"playerProfile">;
    const { category, tournament: tournamentRecord } =
      await getCategoryAndTournament(
        ctx,
        input.categoryId as Id<"tournamentCategory">
      );
    assertRegistrationOpen(tournamentRecord, new Date());

    // The CALLER must match a FIXED-gender category (simples masculino/feminino
    // and duplas masculinas/femininas) — the same pure rule the tournament read
    // exposes per category (`viewerEligible`). Checked BEFORE capacity/duplicate
    // so the wrong-gender diagnosis wins.
    const viewerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: playerProfileId },
    });
    const callerEligibility = resolveCallerEligibility({
      gender: category.gender as TournamentGender,
      modality: category.modality as TournamentModality,
      playerAGender: viewerProfile?.gender ?? null,
    });
    if (!callerEligibility.eligible) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: callerEligibility.reason,
      });
    }

    await assertCategoryCapacity(ctx, category);
    await assertPlayersNotInCategory(
      ctx,
      category.id as Id<"tournamentCategory">,
      [playerProfileId as string]
    );

    const now = new Date();
    const createdByUserId = ctx.userId as Id<"user">;

    if (category.modality === "singles") {
      if (input.partnerUsername) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Simples não aceita parceiro de dupla.",
        });
      }

      const status = resolveInitialStatus(
        category.entryFeeCents,
        tournamentRecord.approvalMode ?? "auto"
      );
      let created: EntryRecord;
      try {
        [created] = await ctx.orm
          .insert(tournamentEntry)
          .values({
            categoryId: category.id as Id<"tournamentCategory">,
            createdAt: now,
            createdByUserId,
            playerAId: playerProfileId,
            status,
            updatedAt: now,
            ...entrySlotFields({
              playerAId: playerProfileId,
              status,
            }),
          })
          .returning();
      } catch (error) {
        if (isUniqueIndexViolation(error)) {
          throw new CRPCError({
            code: "CONFLICT",
            message: "Você já tem inscrição nessa categoria.",
          });
        }
        throw error;
      }

      if (status === "pending_approval") {
        await notifyEntryCreatedForApproval(ctx, {
          createdByUserId,
          entry: created,
          tournament: tournamentRecord,
        });
      }
      if (status === "active") {
        await placeEntryIntoBracket(ctx, { entry: created });
      }
      return serializeEntry(created);
    }

    // Doubles — partner invited by username, entry born pending_partner.
    if (!input.partnerUsername) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Duplas exigem um parceiro convidado por username.",
      });
    }
    const { profile: partnerProfile, user: partnerUser } =
      await findPlayerProfileByUsername(ctx, input.partnerUsername);
    if (partnerProfile.id === playerProfileId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Você não pode convidar a si mesmo.",
      });
    }
    // The invited partner must be free in this category too.
    await assertPlayersNotInCategory(
      ctx,
      category.id as Id<"tournamentCategory">,
      [partnerProfile.id as string]
    );

    const genderError = validateEntryGenders({
      gender: category.gender as TournamentGender,
      modality: "doubles",
      playerAGender: viewerProfile?.gender ?? null,
      playerBGender: partnerProfile.gender ?? null,
    });
    if (genderError) {
      throw new CRPCError({ code: "BAD_REQUEST", message: genderError });
    }

    let created: EntryRecord;
    try {
      [created] = await ctx.orm
        .insert(tournamentEntry)
        .values({
          categoryId: category.id as Id<"tournamentCategory">,
          createdAt: now,
          createdByUserId,
          partnerUserId: partnerUser.id as Id<"user">,
          playerAId: playerProfileId,
          playerBId: partnerProfile.id as Id<"playerProfile">,
          status: "pending_partner",
          updatedAt: now,
          ...entrySlotFields({
            playerAId: playerProfileId,
            playerBId: partnerProfile.id as Id<"playerProfile">,
            status: "pending_partner",
          }),
        })
        .returning();
    } catch (error) {
      if (isUniqueIndexViolation(error)) {
        throw new CRPCError({
          code: "CONFLICT",
          message: "Um dos jogadores já tem inscrição nessa categoria.",
        });
      }
      throw error;
    }

    await scheduleTournamentNotification(ctx, {
      actorUserId: createdByUserId,
      eventType: "tournament.partner.invited",
      // O id da inscricao viaja no `data` para o botao Aceitar / Recusar do
      // convite (o mesmo `entryId` que `respondPartnerInvite` exige).
      metadata: { entryId: created.id as string },
      recipientUserIds: [partnerUser.id as Id<"user">],
      sourceEntityId: created.id as string,
      sourceEntityType: "tournamentEntry",
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });
    return serializeEntry(created);
  });

export const respondPartnerInvite = authMutation
  .input(z.object({ accept: z.boolean(), entryId: z.string().min(1) }))
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    if (entry.status !== "pending_partner") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse convite não está mais pendente.",
      });
    }
    if (entry.partnerUserId !== ((ctx.userId ?? null) as Id<"user"> | null)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Esse convite não é seu.",
      });
    }

    const { category, tournament: tournamentRecord } =
      await getCategoryAndTournament(
        ctx,
        entry.categoryId as Id<"tournamentCategory">
      );
    const now = new Date();

    if (!input.accept) {
      // Declined invite = terminal entry: free the slots so both players can
      // enter again.
      const [updated] = await ctx.orm
        .update(tournamentEntry)
        .set({
          activeAId: unsetToken,
          activeBId: unsetToken,
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
        .returning();
      await scheduleTournamentNotification(ctx, {
        actorUserId: ctx.userId as Id<"user">,
        eventType: "tournament.partner.responded",
        metadata: { accepted: false },
        recipientUserIds: [entry.createdByUserId as Id<"user">],
        sourceEntityId: entry.id as string,
        sourceEntityType: "tournamentEntry",
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
      return serializeEntry(updated);
    }

    // The invite can only be accepted while registrations are open (published +
    // before the deadline) — same rule as creating an entry.
    assertRegistrationOpen(tournamentRecord, new Date());
    // The accepting partner must not belong to another entry in the category
    // (this entry's own playerB side is ignored).
    await assertPlayersNotInCategory(
      ctx,
      category.id as Id<"tournamentCategory">,
      [entry.playerBId as string],
      { ignoreEntryId: entry.id as Id<"tournamentEntry"> }
    );
    await assertCategoryCapacity(ctx, category);
    const nextStatus = resolveEntryStatusAfterPartnerAccepted({
      approvalMode: (tournamentRecord.approvalMode ?? "auto") as
        | "auto"
        | "manual",
      entryFeeCents: category.entryFeeCents,
    });
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({ status: nextStatus, updatedAt: now })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();

    await scheduleTournamentNotification(ctx, {
      actorUserId: ctx.userId as Id<"user">,
      eventType: "tournament.partner.responded",
      metadata: { accepted: true },
      recipientUserIds: [entry.createdByUserId as Id<"user">],
      sourceEntityId: entry.id as string,
      sourceEntityType: "tournamentEntry",
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });

    if (nextStatus === "active") {
      await notifyEntryConfirmed(ctx, {
        entry: updated,
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
      await placeEntryIntoBracket(ctx, { entry: updated });
    }
    return serializeEntry(updated);
  });

export const approve = authMutation
  .input(TournamentEntryActionSchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    const { category, tournament: tournamentRecord } =
      await getCategoryAndTournament(
        ctx,
        entry.categoryId as Id<"tournamentCategory">
      );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    if (entry.status !== "pending_approval") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa inscrição não está aguardando aprovação.",
      });
    }

    const now = new Date();
    const nextStatus =
      category.entryFeeCents > 0 ? "awaiting_payment" : "active";
    // Manual approval respects maxEntries, counting ACTIVE entries only (pending
    // entries never reserve a slot). The other ACTIVE paths guard too: create and
    // accept here, and the paid activation at its last gate.
    if (nextStatus === "active") {
      await assertCategoryCapacity(ctx, category);
    }
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({ status: nextStatus, updatedAt: now })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();

    if (nextStatus === "active") {
      await notifyEntryConfirmed(ctx, {
        entry: updated,
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
      await placeEntryIntoBracket(ctx, { entry: updated });
    }
    return serializeEntry(updated);
  });

export const reject = authMutation
  .input(TournamentEntryActionSchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    const { tournament: tournamentRecord } = await getCategoryAndTournament(
      ctx,
      entry.categoryId as Id<"tournamentCategory">
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    if (entry.status !== "pending_approval") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa inscrição não está aguardando aprovação.",
      });
    }

    const now = new Date();
    // Rejected = terminal entry: free the category slots.
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({
        activeAId: unsetToken,
        activeBId: unsetToken,
        status: "rejected",
        updatedAt: now,
      })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();

    if (entry.createdByUserId) {
      await scheduleTournamentNotification(ctx, {
        eventType: "tournament.entry.rejected",
        recipientUserIds: [entry.createdByUserId as Id<"user">],
        sourceEntityId: entry.id as string,
        sourceEntityType: "tournamentEntry",
        tournamentId: tournamentRecord.id as Id<"tournament">,
      });
    }
    return serializeEntry(updated);
  });

export const cancel = authMutation
  .input(TournamentEntryActionSchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    const { tournament: tournamentRecord } = await getCategoryAndTournament(
      ctx,
      entry.categoryId as Id<"tournamentCategory">
    );

    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const isOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === tournamentRecord.organizationId;
    const isParticipant =
      viewerContext.activeActor.kind === "player" &&
      (entry.playerAId === viewerContext.activeActor.id ||
        entry.playerBId === viewerContext.activeActor.id);
    if (!(isOrganizer || isParticipant)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Inscrição não encontrada.",
      });
    }
    if (
      tournamentRecord.status !== "published" &&
      tournamentRecord.status !== "drawn"
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Inscrições só podem ser canceladas antes do início do torneio.",
      });
    }
    if (entry.status === "cancelled" || entry.status === "rejected") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Essa inscrição já está encerrada.",
      });
    }

    const now = new Date();
    // Cancelled = terminal entry: free the slots so the player can re-register —
    // the cancelled row used to hold the unique index forever and block re-entry.
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({
        activeAId: unsetToken,
        activeBId: unsetToken,
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();

    // The bracket is the live mirror of the entries: the cancelled slot stays
    // EMPTY ("A definir", no automatic bye for the survivor). A paid entry also
    // gets its refund started, with a notice to the creator who paid.
    await removeEntryFromBracket(ctx, { entry: updated });
    await scheduleEntryRefund(ctx, {
      entry: updated,
      tournamentId: tournamentRecord.id as Id<"tournament">,
    });
    return serializeEntry(updated);
  });

export const setSeed = authMutation
  .input(SetEntrySeedSchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    const { tournament: tournamentRecord } = await getCategoryAndTournament(
      ctx,
      entry.categoryId as Id<"tournamentCategory">
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    if (
      tournamentRecord.status !== "published" &&
      tournamentRecord.status !== "drawn"
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Seeds só podem ser marcados antes de iniciar o torneio.",
      });
    }
    if (entry.status !== "active") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Apenas inscrições ativas podem ser cabeças de chave.",
      });
    }

    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({ seedRank: input.seedRank, updatedAt: now })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();
    return serializeEntry(updated);
  });

// Direct phase entry. Same window as setSeed — published (pre-draw) and drawn
// (pre-start, feeds the re-draw); completability is validated at draw time by
// validateEntryRounds.
export const setEntryRound = authMutation
  .input(SetEntryRoundSchema)
  .output(tournamentEntrySchema)
  .mutation(async ({ ctx, input }) => {
    const entry = await getEntryOrThrow(
      ctx,
      input.entryId as Id<"tournamentEntry">
    );
    const { tournament: tournamentRecord } = await getCategoryAndTournament(
      ctx,
      entry.categoryId as Id<"tournamentCategory">
    );
    await getManagedTournamentOrThrow(
      ctx,
      tournamentRecord.id as Id<"tournament">
    );
    // Same window as setSeed: published (pre-draw) and drawn (pre-start, feeds
    // the re-draw). Phase changes are inert until the organizer re-draws.
    if (
      tournamentRecord.status !== "published" &&
      tournamentRecord.status !== "drawn"
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "A fase de entrada só pode ser definida antes de iniciar o torneio.",
      });
    }
    if (entry.status !== "active") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Apenas inscrições ativas podem ter fase de entrada.",
      });
    }

    const now = new Date();
    const [updated] = await ctx.orm
      .update(tournamentEntry)
      .set({ entryRound: input.entryRound, updatedAt: now })
      .where(eq(tournamentEntry.id, entry.id as Id<"tournamentEntry">))
      .returning();
    return serializeEntry(updated);
  });

export const listForTournament = authQuery
  .input(z.object({ tournamentId: z.string().min(1) }))
  .output(z.array(tournamentEntryWithPlayersSchema))
  .query(async ({ ctx, input }) => {
    const record = await getTournamentRecordOrThrow(
      ctx,
      input.tournamentId as Id<"tournament">
    );
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: 10,
      where: { tournamentId: record.id as Id<"tournament"> },
    });
    // Entries carry player cards (name/avatar/username), so the same visibility
    // gate as discovery.getById applies: organizer OR discoverable OR participant
    // of THIS tournament — otherwise any authenticated user could enumerate
    // private/draft entries.
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const isTournamentOrganizer =
      viewerContext.activeActor.kind === "organization" &&
      viewerContext.activeActor.id === record.organizationId;
    if (!(isTournamentOrganizer || isDiscoverable(record))) {
      let hasViewerEntry = false;
      if (viewerContext.activeActor.kind === "player") {
        const playerProfileId = viewerContext.activeActor
          .id as Id<"playerProfile">;
        const [asA, asB] = await Promise.all([
          ctx.orm.query.tournamentEntry.findMany({
            limit: 100,
            where: { playerAId: playerProfileId },
          }),
          ctx.orm.query.tournamentEntry.findMany({
            limit: 100,
            where: { playerBId: playerProfileId },
          }),
        ]);
        hasViewerEntry =
          selectViewerTournamentEntryIds({
            categoryIds: categories.map((category) => category.id as string),
            entries: [...asA, ...asB],
          }).length > 0;
      }
      if (!hasViewerEntry) {
        throw new CRPCError({
          code: "NOT_FOUND",
          message: "Torneio não encontrado.",
        });
      }
    }
    const entries: EntryRecord[] = [];
    for (const category of categories) {
      const rows = await ctx.orm.query.tournamentEntry.findMany({
        limit: 300,
        where: { categoryId: category.id as Id<"tournamentCategory"> },
      });
      entries.push(...rows);
    }

    // Pre-load profiles + usernames once (maps by id) so the join stays at
    // two bounded queries regardless of entry count.
    const profileIds = [
      ...new Set(
        entries.flatMap((entry) =>
          [entry.playerAId, entry.playerBId].filter(
            (id): id is NonNullable<typeof id> => id !== null
          )
        )
      ),
    ];
    const profileRows = await ctx.orm.query.playerProfile.findMany({
      limit: 500,
      where: { id: { in: profileIds as Id<"playerProfile">[] } },
    });
    const userIds = [
      ...new Set(profileRows.map((profile) => profile.userId as Id<"user">)),
    ];
    const userRows = await ctx.orm.query.user.findMany({
      limit: 500,
      where: { id: { in: userIds } },
    });
    const usernameByUserId = new Map(
      userRows.map((user) => [user.id as string, user.username ?? null])
    );

    const cardCache = new Map<string, TournamentPlayerCard>();
    const cardFor = async (playerProfileId: string | null) => {
      if (playerProfileId === null) {
        return null;
      }
      const cached = cardCache.get(playerProfileId);
      if (cached) {
        return cached;
      }
      const profile = profileRows.find((row) => row.id === playerProfileId);
      if (!profile) {
        return null;
      }
      const card = await serializePlayerCard(ctx, {
        avatarStorageId: profile.avatarStorageId,
        fullName: profile.fullName,
        nickname: profile.nickname,
        playerProfileId: profile.id as string,
        username: usernameByUserId.get(profile.userId as string) ?? null,
      });
      cardCache.set(playerProfileId, card);
      return card;
    };

    return Promise.all(
      entries.map(async (entry) => ({
        ...serializeEntry(entry),
        playerA: await cardFor(entry.playerAId as string | null),
        playerB: await cardFor(entry.playerBId as string | null),
      }))
    );
  });
