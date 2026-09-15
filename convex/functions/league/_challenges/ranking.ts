import type { Id } from "../../../functions/_generated/dataModel";
import { CRPCError } from "kitcn/server";
import {
  applyChallengeResultToRanking,
  resolveChallengeRankingRestore,
  type LeagueChallengeStatus,
} from "../../../domains/league/challenge-rules";
import { leagueChallengeOrganizerAction } from "../../../domains/league/tables";
import type {
  League,
  ResolvedLeagueChallengeScore,
} from "../../../domains/league/contract";
import type { LeagueChallengeRecord, OrmMutationCtx } from "./types";

export async function applyChallengeRankingResult(input: {
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  currentLeague: League;
  // REWORK-2: placar JÁ RESOLVIDO — todas as mutations validam antes de
  // chegar aqui (o vencedor pode vir do placar ou do explícito do payload).
  score: ResolvedLeagueChallengeScore;
}) {
  const activeMemberships = await input.ctx.orm.query.leagueMembership.findMany(
    {
      limit: 500,
      orderBy: { rankingPosition: "asc" },
      where: {
        leagueId: input.challenge.leagueId as Id<"league">,
        status: "active",
      },
    }
  );

  const rankingMembershipIds = activeMemberships.map((membership) =>
    String(membership.id)
  );

  const nextRankingMembershipIds = applyChallengeResultToRanking({
    challengedMembershipId: String(input.challenge.challengedMembershipId),
    challengerMembershipId: String(input.challenge.challengerMembershipId),
    lossBehavior: input.currentLeague.ruleConfig.lossBehavior,
    rankingMembershipIds,
    walkover: input.score.walkover === true,
    walkoverBehavior: input.currentLeague.ruleConfig.walkoverBehavior,
    winBehavior: input.currentLeague.ruleConfig.winBehavior,
    winnerMembershipId: input.score.winnerMembershipId,
  });

  for (const [index, membershipId] of nextRankingMembershipIds.entries()) {
    await input.ctx.db.patch(membershipId as Id<"leagueMembership">, {
      rankingPosition: index + 1,
      updatedAt: Date.now(),
    });
  }

  return {
    rankingSnapshotAfterResult: nextRankingMembershipIds,
    rankingSnapshotBeforeResult: rankingMembershipIds,
  };
}

export async function restoreChallengeRankingSnapshot(input: {
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
}) {
  const activeMemberships = await input.ctx.orm.query.leagueMembership.findMany(
    {
      limit: 500,
      orderBy: { rankingPosition: "asc" },
      where: {
        leagueId: input.challenge.leagueId as Id<"league">,
        status: "active",
      },
    }
  );

  const currentRankingMembershipIds = activeMemberships.map((membership) =>
    String(membership.id)
  );
  const restoreResult = resolveChallengeRankingRestore({
    currentRankingMembershipIds,
    hasRankingApplied: Boolean(input.challenge.rankingAppliedAt),
    rankingSnapshotAfterResult: input.challenge.rankingSnapshotAfterResult,
    rankingSnapshotBeforeResult: input.challenge.rankingSnapshotBeforeResult,
  });

  if (!restoreResult.ok) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: restoreResult.error,
    });
  }

  for (const [
    index,
    membershipId,
  ] of restoreResult.rankingMembershipIds.entries()) {
    await input.ctx.db.patch(membershipId as Id<"leagueMembership">, {
      rankingPosition: index + 1,
      updatedAt: Date.now(),
    });
  }
}

export async function recordOrganizerChallengeAction(input: {
  action:
    | "cancel"
    | "edit_result"
    | "invalidate"
    | "reopen_challenge"
    | "reopen_result";
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  fromStatus: LeagueChallengeStatus;
  performedByUserId: Id<"user">;
  /** IBX-0028: resumo JSON da edição (antes/depois) para trilha de auditoria. */
  reason?: string;
  toStatus: LeagueChallengeStatus;
}) {
  await input.ctx.orm.insert(leagueChallengeOrganizerAction).values({
    action: input.action,
    challengeId: input.challenge.id as Id<"leagueChallenge">,
    createdAt: new Date(),
    fromStatus: input.fromStatus,
    performedByUserId: input.performedByUserId,
    reason: input.reason,
    toStatus: input.toStatus,
  });
}
