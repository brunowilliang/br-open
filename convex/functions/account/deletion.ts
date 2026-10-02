import { eq, unsetToken } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  accountDeletionConfirmResultSchema,
  accountDeletionStatusSchema,
  confirmAccountDeletionSchema,
  requestAccountDeletionCodeResultSchema,
} from "../../domains/account/contract";
import {
  DELETION_CODE_TTL_MS,
  resolveDeletionCodeCheck,
  resolveDeletionCodeRequestGate,
} from "../../domains/account/deletion-code-rules";
import { collectAccountDeletionPlan } from "../../domains/account/deletion-reads";
import {
  buildAccountDeletionStatus,
  ORGANIZER_REMOVED_NAME,
} from "../../domains/account/deletion-rules";
import { sha256Hex } from "../../domains/account/sha256";
import { accountDeletionCode } from "../../domains/account/tables";
import * as authTables from "../../domains/auth/tables";
import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "../../domains/payment/contract";
import { playerProfile } from "../../domains/player/tables";
import { tournament } from "../../domains/tournament/tables";
import { authMutation, authQuery, privateMutation } from "../../lib/crpc";
import { deleteStorageIds } from "../../shared/media-rules";
import type { MutationCtx } from "../generated/server";
import {
  getTournamentManagerUserIds,
  type OrmCtx,
  type OrmMutationCtx,
  scheduleTournamentNotification,
} from "../tournament/_shared/guards";
import {
  applyMatchResult,
  entryRecipientUserIds,
} from "../tournament/_shared/match_writes";

/**
 * W.O. da saida: o lado do jogador perde para o outro lado (que avanca), e os
 * avisos novos cobrem o adversario, o parceiro de dupla e a organizacao. O
 * evento generico de resultado tambem sai pelo `applyMatchResult`.
 */
async function applyAccountRemovalWalkover(
  ctx: MutationCtx,
  input: {
    matchId: string;
    playerProfileId: Id<"playerProfile">;
    userId: Id<"user">;
  }
) {
  const match = await ctx.orm.query.tournamentMatch.findFirst({
    where: { id: input.matchId as Id<"tournamentMatch"> },
  });
  if (!match || match.publishedAt || !(match.entryAId && match.entryBId)) {
    return;
  }
  const category = await ctx.orm.query.tournamentCategory.findFirst({
    where: { id: match.categoryId },
  });
  if (!category) {
    return;
  }
  const currentTournament = await ctx.orm.query.tournament.findFirst({
    where: { id: category.tournamentId },
  });
  if (!currentTournament) {
    return;
  }
  if (currentTournament.status !== "ongoing") {
    return;
  }

  const [entryA, entryB] = await Promise.all([
    ctx.orm.query.tournamentEntry.findFirst({ where: { id: match.entryAId } }),
    ctx.orm.query.tournamentEntry.findFirst({ where: { id: match.entryBId } }),
  ]);
  const myEntry =
    entryA &&
    (entryA.playerAId === input.playerProfileId ||
      entryA.playerBId === input.playerProfileId)
      ? entryA
      : entryB &&
          (entryB.playerAId === input.playerProfileId ||
            entryB.playerBId === input.playerProfileId)
        ? entryB
        : null;
  const opponentEntry = myEntry === entryA ? entryB : entryA;
  if (!(myEntry && opponentEntry)) {
    return;
  }

  await applyMatchResult(ctx as unknown as OrmMutationCtx, {
    match,
    score: {
      sets: [{ aGames: 0, bGames: 0, kind: "set" }],
      winnerEntryId: opponentEntry.id as string,
    },
    tournament: currentTournament,
    walkover: true,
  });

  const opponentRecipients = (
    await entryRecipientUserIds(ctx as unknown as OrmCtx, [
      opponentEntry.id as string,
    ])
  ).filter((id) => id !== input.userId);
  if (opponentRecipients.length > 0) {
    await scheduleTournamentNotification(ctx, {
      actorUserId: input.userId,
      eventType: "tournament.player.removed",
      metadata: { audience: "opponent", matchId: match.id as string },
      recipientUserIds: opponentRecipients,
      sourceEntityId: match.id as string,
      sourceEntityType: "tournamentMatch",
      tournamentId: currentTournament.id as Id<"tournament">,
    });
  }

  const partnerUserId = myEntry.partnerUserId as Id<"user"> | null;
  if (partnerUserId && partnerUserId !== input.userId) {
    await scheduleTournamentNotification(ctx, {
      actorUserId: input.userId,
      eventType: "tournament.player.removed",
      metadata: { audience: "partner", matchId: match.id as string },
      recipientUserIds: [partnerUserId],
      sourceEntityId: match.id as string,
      sourceEntityType: "tournamentMatch",
      tournamentId: currentTournament.id as Id<"tournament">,
    });
  }

  const managerRecipients = (
    await getTournamentManagerUserIds(
      ctx as unknown as OrmCtx,
      currentTournament.organizationId
    )
  ).filter((id) => id !== input.userId);
  if (managerRecipients.length > 0) {
    await scheduleTournamentNotification(ctx, {
      actorUserId: input.userId,
      eventType: "tournament.entry.player_removed",
      metadata: { matchId: match.id as string },
      recipientUserIds: managerRecipients,
      sourceEntityId: match.id as string,
      sourceEntityType: "tournamentMatch",
      tournamentId: currentTournament.id as Id<"tournament">,
    });
  }
}

export const status = authQuery
  .output(accountDeletionStatusSchema)
  .query(async ({ ctx }) => {
    const plan = await collectAccountDeletionPlan(
      ctx,
      ctx.userId as Id<"user">
    );
    return buildAccountDeletionStatus(plan.snapshot);
  });

export const requestCode = authMutation
  .output(requestAccountDeletionCodeResultSchema)
  .mutation(async ({ ctx }) => {
    const userId = ctx.userId as Id<"user">;
    const now = new Date();
    const existing = await ctx.orm.query.accountDeletionCode.findFirst({
      where: { userId },
    });
    const gate = resolveDeletionCodeRequestGate({
      nowMs: now.getTime(),
      requestedAtMs: existing?.requestedAt.getTime() ?? null,
    });
    if (gate === "cooldown") {
      throw new CRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Aguarde um instante para pedir um novo código.",
      });
    }

    const expiresAt = new Date(now.getTime() + DELETION_CODE_TTL_MS);
    if (existing) {
      await ctx.orm
        .update(accountDeletionCode)
        .set({
          attempts: 0,
          codeHash: "",
          expiresAt,
          requestedAt: now,
          sentAt: unsetToken,
          updatedAt: now,
        })
        .where(eq(accountDeletionCode.id, existing.id));
    } else {
      await ctx.orm.insert(accountDeletionCode).values({
        attempts: 0,
        codeHash: "",
        createdAt: now,
        expiresAt,
        requestedAt: now,
        updatedAt: now,
        userId,
      });
    }

    await ctx.scheduler.runAfter(0, internal.account.deletionCode.send, {
      userId: userId as string,
    });
    return { sentAt: now.getTime() };
  });

export const confirm = authMutation
  .input(confirmAccountDeletionSchema)
  .output(accountDeletionConfirmResultSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.userId as Id<"user">;
    const now = new Date();
    const row = await ctx.orm.query.accountDeletionCode.findFirst({
      where: { userId },
    });
    if (!row) {
      return { status: "code_expired" };
    }

    const check = resolveDeletionCodeCheck({
      attempts: row.attempts,
      codeHash: row.codeHash,
      expiresAtMs: row.expiresAt.getTime(),
      nowMs: now.getTime(),
      submittedHash: sha256Hex(input.code),
    });
    if (check.status === "expired") {
      // Envio ainda em voo (hash vazio) nao pode derrubar a linha: o action
      // fecharia sem codigo nenhum. Codigo expirado de verdade limpa o estado.
      if (row.codeHash.length > 0) {
        await ctx.orm
          .delete(accountDeletionCode)
          .where(eq(accountDeletionCode.id, row.id));
      }
      return { status: "code_expired" };
    }
    if (check.status === "exhausted") {
      await ctx.orm
        .delete(accountDeletionCode)
        .where(eq(accountDeletionCode.id, row.id));
      return { status: "too_many_attempts" };
    }
    if (check.status === "invalid") {
      // A tentativa precisa SOBREVIVER ao erro: por isso o union de retorno,
      // nunca CRPCError (mutation que lanca perde as proprias escritas).
      await ctx.orm
        .update(accountDeletionCode)
        .set({ attempts: row.attempts + 1, updatedAt: now })
        .where(eq(accountDeletionCode.id, row.id));
      return { attemptsLeft: check.attemptsLeft, status: "invalid_code" };
    }

    const plan = await collectAccountDeletionPlan(ctx, userId);
    const deletionStatus = buildAccountDeletionStatus(plan.snapshot);
    if (!deletionStatus.canDelete) {
      return { blockers: deletionStatus.blockers, status: "blocked" };
    }

    await ctx.runMutation(internal.account.deletion.execute, {
      userId: userId as string,
    });
    return { status: "deleted" };
  });

export const execute = privateMutation
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const userId = input.userId as Id<"user">;
    const plan = await collectAccountDeletionPlan(ctx, userId);
    const deletionStatus = buildAccountDeletionStatus(plan.snapshot);
    if (!deletionStatus.canDelete) {
      throw new CRPCError({
        code: "CONFLICT",
        data: { blockers: deletionStatus.blockers },
        message: "Ainda há pendências para resolver antes de excluir a conta.",
      });
    }

    if (plan.cancellableEntryIds.length > 0) {
      await ctx.runMutation(
        internal.tournament.entries.cancelEntriesForAccountRemoval,
        { entryIds: plan.cancellableEntryIds }
      );
    }
    if (plan.liveEntryIds.length > 0) {
      await ctx.runMutation(
        internal.payment.charge.cancelPendingChargesForSource,
        {
          sourceIds: plan.liveEntryIds,
          sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
        }
      );
    }

    if (plan.playerProfileId) {
      for (const matchId of plan.walkoverMatchIds) {
        await applyAccountRemovalWalkover(ctx, {
          matchId,
          playerProfileId: plan.playerProfileId,
          userId,
        });
      }
    }

    if (plan.draftStorageIds.length > 0) {
      await deleteStorageIds(ctx, plan.draftStorageIds);
    }
    for (const draftId of plan.draftTournamentIds) {
      await ctx.orm
        .delete(tournament)
        .where(eq(tournament.id, draftId as Id<"tournament">));
    }

    if (plan.playerProfileId) {
      const profile = await ctx.orm.query.playerProfile.findFirst({
        where: { id: plan.playerProfileId },
      });
      if (profile) {
        const now = new Date();
        if (profile.avatarStorageId) {
          await deleteStorageIds(ctx, [profile.avatarStorageId]);
        }
        // Anonimizacao com unset (nunca null): o perfil fica como
        // "Jogador removido" e o indice unico de userId nao colide.
        await ctx.orm
          .update(playerProfile)
          .set({
            avatarStorageId: unsetToken,
            fullName: unsetToken,
            nickname: unsetToken,
            phone: unsetToken,
            removedAt: now,
            updatedAt: now,
            userId: unsetToken,
          })
          .where(eq(playerProfile.id, plan.playerProfileId));
      }
    }

    for (const organization of plan.managedOrganizations) {
      if (organization.logo) {
        await deleteStorageIds(ctx, [organization.logo]);
      }
      await ctx.orm
        .update(authTables.organization)
        .set({ logo: unsetToken, name: ORGANIZER_REMOVED_NAME })
        .where(eq(authTables.organization.id, organization.organizationId));
    }

    await ctx.orm.delete(authTables.user).where(eq(authTables.user.id, userId));
  });
