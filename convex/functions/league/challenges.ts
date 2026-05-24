import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  AdminManageLeagueChallengeSchema,
  CounterProposeLeagueChallengeSchema,
  CreateLeagueChallengeSchema,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  LeagueByIdSchema,
  leagueChallengeSchema,
  leagueChallengeScoreSchema,
  LeagueCourtDayKeys,
  type League,
  type LeagueChallenge,
  type LeagueChallengeProposal,
  type LeagueChallengeResultSubmission,
  type LeagueChallengeScore,
  type LeagueCourtDay,
  LeagueMatchConfigSchema,
  leagueMembershipPlayerSchema,
  leagueSchema,
  RequestLeagueChallengeCancellationSchema,
  RespondLeagueChallengeCancellationSchema,
  ReviewLeagueChallengeResultSchema,
  ReviewLeagueChallengeSchema,
  SubmitLeagueChallengeResultSchema,
} from "../../domains/league/contract";
import {
  applyChallengeResultToRanking,
  buildResponseDeadline,
  canPlayersCancelChallenge,
  isChallengeSlotBlocked,
  type LeagueChallengeStatus,
  resolveAcceptedChallengeStatus,
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  resolveReopenedChallengeStatus,
  resolveScoreConfirmationStatus,
} from "../../domains/league/challenge-rules";
import {
  leagueChallenge,
  leagueChallengeAdminAction,
  leagueChallengeProposal,
  leagueChallengeResultSubmission,
  type league,
  type leagueMembership,
} from "../../domains/league/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";

type LeagueRecord = InferSelectModel<typeof league>;
type LeagueChallengeRecord = InferSelectModel<typeof leagueChallenge>;
type LeagueChallengeProposalRecord = InferSelectModel<
  typeof leagueChallengeProposal
>;
type LeagueChallengeResultSubmissionRecord = InferSelectModel<
  typeof leagueChallengeResultSubmission
>;
type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;
type OrmCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
type OrmMutationCtx = AuthenticatedCtx<MutationCtx>;

const CLOSED_CHALLENGE_STATUSES = new Set<LeagueChallengeStatus>([
  "finished",
  "declined",
  "cancelled",
  "invalidated",
]);

const VIEWER_PROPOSAL_RESPONSE_STATUSES = new Set<LeagueChallengeStatus>([
  "pending_opponent_response",
  "pending_creator_reapproval",
]);

function serializeLeagueRecord(record: LeagueRecord) {
  return leagueSchema.parse({
    ...record,
    courts: record.courts ?? [],
    ruleConfig: {
      ...record.ruleConfig,
      challengeValidationMode:
        record.ruleConfig?.challengeValidationMode ??
        DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode:
        record.ruleConfig?.resultValidationMode ??
        DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    },
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function getDayKeyFromMatchDate(matchDate: string): LeagueCourtDay {
  const parsedDate = new Date(`${matchDate}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Data da partida inválida.",
    });
  }

  return LeagueCourtDayKeys[
    parsedDate.getUTCDay() === 0 ? 6 : parsedDate.getUTCDay() - 1
  ];
}

function buildScheduledDate(matchDate: string, minute: number) {
  const baseDate = new Date(`${matchDate}T00:00:00.000Z`);

  if (Number.isNaN(baseDate.getTime())) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Data da partida inválida.",
    });
  }

  baseDate.setUTCMinutes(minute, 0, 0);

  return baseDate;
}

function rangesOverlap(input: {
  leftEndMinute: number;
  leftStartMinute: number;
  rightEndMinute: number;
  rightStartMinute: number;
}) {
  return (
    input.leftStartMinute < input.rightEndMinute &&
    input.rightStartMinute < input.leftEndMinute
  );
}

async function getPlayerSummary(ctx: OrmCtx, userId: Id<"user">) {
  const [user, playerProfile] = await Promise.all([
    ctx.orm.query.user.findFirst({ where: { id: userId } }),
    ctx.orm.query.playerProfile.findFirst({ where: { userId } }),
  ]);

  if (!user) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Usuário não encontrado.",
    });
  }

  const fullName = playerProfile?.fullName?.trim() || user.name;
  const nickname =
    playerProfile?.nickname?.trim() ||
    playerProfile?.fullName?.trim() ||
    user.name;

  return leagueMembershipPlayerSchema.parse({
    avatarUrl: user.image ?? null,
    fullName,
    nickname,
  });
}

async function serializeParticipant(
  ctx: OrmCtx,
  membership: LeagueMembershipRecord
) {
  return {
    membershipId: membership.id as Id<"leagueMembership">,
    userId: membership.userId,
    rankingPosition: membership.rankingPosition ?? null,
    player: await getPlayerSummary(ctx, membership.userId),
  };
}

async function getLeagueRecordOrThrow(ctx: OrmCtx, leagueId: Id<"league">) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId },
  });

  if (!currentLeague) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Liga não encontrada.",
    });
  }

  return serializeLeagueRecord(currentLeague);
}

async function getChallengeRecordOrThrow(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  const currentChallenge = await ctx.orm.query.leagueChallenge.findFirst({
    where: { id: challengeId },
  });

  if (!currentChallenge) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Desafio não encontrado.",
    });
  }

  return currentChallenge;
}

async function getMembershipRecordByIdOrThrow(
  ctx: OrmCtx,
  membershipId: Id<"leagueMembership">
) {
  const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: { id: membershipId },
  });

  if (!currentMembership) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Participante não encontrado.",
    });
  }

  return currentMembership;
}

function getActiveMembershipForUser(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  userId: Id<"user">
) {
  return ctx.orm.query.leagueMembership.findFirst({
    where: {
      leagueId,
      status: "active",
      userId,
    },
  });
}

async function getActiveMembershipByIdOrThrow(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  membershipId: Id<"leagueMembership">
) {
  const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: {
      id: membershipId,
      leagueId,
      status: "active",
    },
  });

  if (!currentMembership) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O participante informado não está ativo na liga.",
    });
  }

  return currentMembership;
}

async function getViewerContextOrThrow(ctx: OrmCtx, leagueId: Id<"league">) {
  const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
  const isManagerOwner = currentLeague.managerUserId === ctx.userId;
  const activeMembership = isManagerOwner
    ? null
    : await getActiveMembershipForUser(ctx, leagueId, ctx.userId);

  if (!(isManagerOwner || activeMembership)) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Você não pode acessar os desafios dessa liga.",
    });
  }

  return {
    activeMembership,
    currentLeague,
    isManagerOwner,
  };
}

function getChallengeProposals(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  return ctx.orm.query.leagueChallengeProposal.findMany({
    limit: 100,
    orderBy: { revisionNumber: "asc" },
    where: { challengeId },
  });
}

async function getLatestResultSubmission(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  const [latestResultSubmission] =
    await ctx.orm.query.leagueChallengeResultSubmission.findMany({
      limit: 1,
      orderBy: { submittedAt: "desc" },
      where: { challengeId },
    });

  return latestResultSubmission ?? null;
}

async function getCurrentProposalOrThrow(
  ctx: OrmCtx,
  challenge: LeagueChallengeRecord
) {
  if (challenge.currentProposalId) {
    const currentProposal =
      await ctx.orm.query.leagueChallengeProposal.findFirst({
        where: {
          id: challenge.currentProposalId as Id<"leagueChallengeProposal">,
          challengeId: challenge.id as Id<"leagueChallenge">,
        },
      });

    if (currentProposal) {
      return currentProposal;
    }
  }

  const proposals = await getChallengeProposals(
    ctx,
    challenge.id as Id<"leagueChallenge">
  );
  const fallbackProposal = proposals.at(-1);

  if (!fallbackProposal) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "A proposta atual do desafio não foi encontrada.",
    });
  }

  return fallbackProposal;
}

function getCourtNameOrThrow(currentLeague: League, courtId: string) {
  const currentCourt = currentLeague.courts.find(
    (court) => court.id === courtId
  );

  if (!currentCourt) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra selecionada não pertence a essa liga.",
    });
  }

  return currentCourt.name;
}

function assertCourtAvailability(input: {
  currentLeague: League;
  courtId: string;
  endMinute: number;
  matchDate: string;
  startMinute: number;
}) {
  const currentCourt = input.currentLeague.courts.find(
    (court) => court.id === input.courtId
  );

  if (!currentCourt) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra selecionada não pertence a essa liga.",
    });
  }

  const dayKey = getDayKeyFromMatchDate(input.matchDate);
  const dayAvailability = currentCourt.availability[dayKey];
  const fitsAvailability = dayAvailability.some(
    (range) =>
      input.startMinute >= range.startMinute &&
      input.endMinute <= range.endMinute
  );

  if (!fitsAvailability) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra não está disponível nesse horário.",
    });
  }
}

function getProposalReceiverMembershipId(challenge: LeagueChallengeRecord) {
  switch (challenge.status) {
    case "pending_opponent_response":
      return challenge.challengedMembershipId as Id<"leagueMembership">;
    case "pending_creator_reapproval":
      return challenge.challengerMembershipId as Id<"leagueMembership">;
    default:
      return null;
  }
}

function getCancellationResponseMembershipId(challenge: LeagueChallengeRecord) {
  if (
    challenge.status !== "pending_cancellation_acceptance" ||
    !challenge.cancellationRequestedByMembershipId
  ) {
    return null;
  }

  return challenge.cancellationRequestedByMembershipId ===
    challenge.challengerMembershipId
    ? (challenge.challengedMembershipId as Id<"leagueMembership">)
    : (challenge.challengerMembershipId as Id<"leagueMembership">);
}

function computeEffectiveChallengeStatus(input: {
  challenge: LeagueChallengeRecord;
  currentProposal: LeagueChallengeProposalRecord;
  latestResultSubmission: LeagueChallengeResultSubmissionRecord | null;
  now: Date;
}) {
  if (
    VIEWER_PROPOSAL_RESPONSE_STATUSES.has(
      input.challenge.status as LeagueChallengeStatus
    ) &&
    input.now.getTime() > input.currentProposal.responseDeadlineAt.getTime()
  ) {
    return resolveNoResponseStatus();
  }

  if (input.challenge.status === "confirmed") {
    const pendingResultStatus = resolveMissingResultStatus({
      hasSubmittedResult: Boolean(input.latestResultSubmission),
      now: input.now,
      scheduledEndAt: buildScheduledDate(
        input.currentProposal.matchDate,
        input.currentProposal.endMinute
      ),
    });

    if (pendingResultStatus) {
      return pendingResultStatus;
    }
  }

  return input.challenge.status as LeagueChallengeStatus;
}

async function syncTimeDrivenChallengeStatus(
  ctx: OrmMutationCtx,
  challenge: LeagueChallengeRecord,
  currentProposal: LeagueChallengeProposalRecord,
  latestResultSubmission: LeagueChallengeResultSubmissionRecord | null,
  now: Date
) {
  const effectiveStatus = computeEffectiveChallengeStatus({
    challenge,
    currentProposal,
    latestResultSubmission,
    now,
  });

  if (effectiveStatus === challenge.status) {
    return challenge;
  }

  await ctx.db.patch(challenge.id as Id<"leagueChallenge">, {
    status: effectiveStatus,
    updatedAt: now.getTime(),
  });

  return {
    ...challenge,
    status: effectiveStatus,
    updatedAt: now,
  };
}

async function assertCourtSlotAvailable(input: {
  challengeIdToIgnore?: Id<"leagueChallenge"> | null;
  courtId: string;
  ctx: OrmCtx;
  endMinute: number;
  matchDate: string;
  startMinute: number;
}) {
  const proposals = await input.ctx.orm.query.leagueChallengeProposal.findMany({
    limit: 500,
    where: {
      courtId: input.courtId,
      matchDate: input.matchDate,
    },
  });

  for (const proposal of proposals) {
    const parentChallenge = await input.ctx.orm.query.leagueChallenge.findFirst(
      {
        where: { id: proposal.challengeId as Id<"leagueChallenge"> },
      }
    );

    if (!parentChallenge) {
      continue;
    }

    if (
      input.challengeIdToIgnore &&
      parentChallenge.id === input.challengeIdToIgnore
    ) {
      continue;
    }

    if (parentChallenge.currentProposalId !== proposal.id) {
      continue;
    }

    if (
      !isChallengeSlotBlocked(parentChallenge.status as LeagueChallengeStatus)
    ) {
      continue;
    }

    if (
      rangesOverlap({
        leftEndMinute: input.endMinute,
        leftStartMinute: input.startMinute,
        rightEndMinute: proposal.endMinute,
        rightStartMinute: proposal.startMinute,
      })
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse horário já está reservado para outro desafio.",
      });
    }
  }
}

async function assertChallengeCreationRules(input: {
  challengedMembership: LeagueMembershipRecord;
  challengerMembership: LeagueMembershipRecord;
  ctx: OrmCtx;
  league: League;
}) {
  if (input.challengedMembership.id === input.challengerMembership.id) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Você não pode desafiar a si mesmo.",
    });
  }

  const challengerPosition = input.challengerMembership.rankingPosition;
  const challengedPosition = input.challengedMembership.rankingPosition;

  if (!(challengerPosition && challengedPosition)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O ranking da liga está incompleto para abrir esse desafio.",
    });
  }

  if (challengerPosition <= challengedPosition) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Você só pode desafiar jogadores acima da sua posição.",
    });
  }

  if (
    challengerPosition - challengedPosition >
    input.league.ruleConfig.maxChallengeDistance
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Esse desafio ultrapassa a distância máxima permitida.",
    });
  }

  const activeChallenges = await input.ctx.orm.query.leagueChallenge.findMany({
    limit: 500,
    where: { leagueId: input.league.id as Id<"league"> },
  });

  const activeChallengeCountForMembership = (
    membershipId: Id<"leagueMembership">
  ) =>
    activeChallenges.filter(
      (challenge) =>
        isChallengeSlotBlocked(challenge.status as LeagueChallengeStatus) &&
        (challenge.challengerMembershipId === membershipId ||
          challenge.challengedMembershipId === membershipId)
    ).length;

  if (
    activeChallengeCountForMembership(
      input.challengerMembership.id as Id<"leagueMembership">
    ) >= input.league.ruleConfig.maxActiveChallengesPerPlayer
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Você já atingiu o limite de desafios ativos.",
    });
  }

  if (
    activeChallengeCountForMembership(
      input.challengedMembership.id as Id<"leagueMembership">
    ) >= input.league.ruleConfig.maxActiveChallengesPerPlayer
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O adversário já atingiu o limite de desafios ativos.",
    });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const challengesCreatedThisMonth = activeChallenges.filter(
    (challenge) =>
      challenge.challengerMembershipId === input.challengerMembership.id &&
      challenge.createdAt >= monthStart
  ).length;

  if (
    challengesCreatedThisMonth >= input.league.ruleConfig.maxChallengesPerMonth
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Você já atingiu o limite mensal de desafios.",
    });
  }
}

function serializeProposal(
  currentLeague: League,
  proposal: LeagueChallengeProposalRecord
) {
  return {
    id: proposal.id,
    challengeId: proposal.challengeId,
    proposedByMembershipId: proposal.proposedByMembershipId,
    courtId: proposal.courtId,
    courtName: getCourtNameOrThrow(currentLeague, proposal.courtId),
    matchDate: proposal.matchDate,
    startMinute: proposal.startMinute,
    endMinute: proposal.endMinute,
    responseDeadlineAt: proposal.responseDeadlineAt.getTime(),
    revisionNumber: proposal.revisionNumber,
    status: proposal.status as LeagueChallengeProposal["status"],
    createdAt: proposal.createdAt.getTime(),
  } satisfies LeagueChallengeProposal;
}

function serializeResultSubmission(
  resultSubmission: LeagueChallengeResultSubmissionRecord
) {
  return {
    id: resultSubmission.id,
    challengeId: resultSubmission.challengeId,
    submittedByMembershipId: resultSubmission.submittedByMembershipId,
    confirmedByMembershipId: resultSubmission.confirmedByMembershipId ?? null,
    adminReviewedByUserId: resultSubmission.adminReviewedByUserId ?? null,
    reviewAction:
      (resultSubmission.reviewAction as
        | LeagueChallengeResultSubmission["reviewAction"]
        | undefined) ?? null,
    score: leagueChallengeScoreSchema.parse(resultSubmission.score),
    winnerMembershipId: resultSubmission.winnerMembershipId ?? null,
    submittedAt: resultSubmission.submittedAt.getTime(),
    confirmedAt: resultSubmission.confirmedAt
      ? resultSubmission.confirmedAt.getTime()
      : null,
    reviewedAt: resultSubmission.reviewedAt
      ? resultSubmission.reviewedAt.getTime()
      : null,
  } satisfies LeagueChallengeResultSubmission;
}

const leagueChallengeOccupiedSlotSchema = z.object({
  challengeId: z.string(),
  courtId: z.string(),
  endMinute: z.number().int(),
  matchDate: z.string(),
  startMinute: z.number().int(),
});

async function serializeChallenge(
  ctx: OrmCtx,
  currentLeague: League,
  challenge: LeagueChallengeRecord
) {
  const [
    challengerMembership,
    challengedMembership,
    proposals,
    latestResultSubmission,
  ] = await Promise.all([
    getMembershipRecordByIdOrThrow(
      ctx,
      challenge.challengerMembershipId as Id<"leagueMembership">
    ),
    getMembershipRecordByIdOrThrow(
      ctx,
      challenge.challengedMembershipId as Id<"leagueMembership">
    ),
    getChallengeProposals(ctx, challenge.id as Id<"leagueChallenge">),
    getLatestResultSubmission(ctx, challenge.id as Id<"leagueChallenge">),
  ]);

  const currentProposal =
    proposals.find((proposal) => proposal.id === challenge.currentProposalId) ??
    proposals.at(-1);

  if (!currentProposal) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "A proposta atual do desafio não foi encontrada.",
    });
  }

  const effectiveStatus = computeEffectiveChallengeStatus({
    challenge,
    currentProposal,
    latestResultSubmission,
    now: new Date(),
  });

  return leagueChallengeSchema.parse({
    id: challenge.id,
    leagueId: challenge.leagueId,
    status: effectiveStatus as LeagueChallenge["status"],
    challengeValidationMode:
      challenge.challengeValidationMode as LeagueChallenge["challengeValidationMode"],
    resultValidationMode:
      challenge.resultValidationMode as LeagueChallenge["resultValidationMode"],
    challenger: await serializeParticipant(ctx, challengerMembership),
    challenged: await serializeParticipant(ctx, challengedMembership),
    matchConfigSnapshot: LeagueMatchConfigSchema.parse(
      challenge.matchConfigSnapshot
    ),
    currentProposal: serializeProposal(currentLeague, currentProposal),
    proposals: proposals.map((proposal) =>
      serializeProposal(currentLeague, proposal)
    ),
    latestResultSubmission: latestResultSubmission
      ? serializeResultSubmission(latestResultSubmission)
      : null,
    cancellationRequestedByMembershipId:
      challenge.cancellationRequestedByMembershipId ?? null,
    cancellationRequestedAt: challenge.cancellationRequestedAt
      ? challenge.cancellationRequestedAt.getTime()
      : null,
    lockedAt: challenge.lockedAt ? challenge.lockedAt.getTime() : null,
    confirmedAt: challenge.confirmedAt ? challenge.confirmedAt.getTime() : null,
    finishedAt: challenge.finishedAt ? challenge.finishedAt.getTime() : null,
    cancelledAt: challenge.cancelledAt ? challenge.cancelledAt.getTime() : null,
    invalidatedAt: challenge.invalidatedAt
      ? challenge.invalidatedAt.getTime()
      : null,
    createdAt: challenge.createdAt.getTime(),
    updatedAt: challenge.updatedAt.getTime(),
  } satisfies LeagueChallenge);
}

async function applyChallengeRankingResult(input: {
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  currentLeague: League;
  score: LeagueChallengeScore;
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

async function restoreChallengeRankingSnapshot(input: {
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
}) {
  const rankingSnapshotAfterResult = input.challenge.rankingSnapshotAfterResult;
  const rankingSnapshotBeforeResult =
    input.challenge.rankingSnapshotBeforeResult;
  const hasRankingSnapshots =
    Boolean(input.challenge.rankingAppliedAt) &&
    Array.isArray(rankingSnapshotAfterResult) &&
    Array.isArray(rankingSnapshotBeforeResult);

  if (!hasRankingSnapshots) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message:
        "Esse resultado não possui um snapshot seguro para reabrir o ranking.",
    });
  }

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

  if (
    JSON.stringify(currentRankingMembershipIds) !==
    JSON.stringify(rankingSnapshotAfterResult)
  ) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message:
        "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.",
    });
  }

  for (const [index, membershipId] of rankingSnapshotBeforeResult.entries()) {
    await input.ctx.db.patch(membershipId as Id<"leagueMembership">, {
      rankingPosition: index + 1,
      updatedAt: Date.now(),
    });
  }
}

async function recordAdminChallengeAction(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  fromStatus: LeagueChallengeStatus;
  performedByUserId: Id<"user">;
  reason: string;
  toStatus: LeagueChallengeStatus;
}) {
  await input.ctx.orm.insert(leagueChallengeAdminAction).values({
    action: input.action,
    challengeId: input.challenge.id as Id<"leagueChallenge">,
    createdAt: new Date(),
    fromStatus: input.fromStatus,
    performedByUserId: input.performedByUserId,
    reason: input.reason,
    toStatus: input.toStatus,
  });
}

function assertParticipantAccess(input: {
  challenge: LeagueChallengeRecord;
  isManagerOwner: boolean;
  viewerMembership: LeagueMembershipRecord | null;
}) {
  if (input.isManagerOwner) {
    return;
  }

  const viewerMembershipId = input.viewerMembership?.id;
  const isParticipant =
    viewerMembershipId === input.challenge.challengerMembershipId ||
    viewerMembershipId === input.challenge.challengedMembershipId;

  if (!isParticipant) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Você não pode acessar esse desafio.",
    });
  }
}

export const listForLeague = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueChallengeSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const { activeMembership, currentLeague, isManagerOwner } =
      await getViewerContextOrThrow(ctx, leagueId);

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { leagueId },
    });

    const visibleChallenges = challengeRecords.filter((challenge) => {
      if (isManagerOwner) {
        return true;
      }

      return (
        challenge.challengerMembershipId === activeMembership?.id ||
        challenge.challengedMembershipId === activeMembership?.id
      );
    });

    return Promise.all(
      visibleChallenges.map((challenge) =>
        serializeChallenge(ctx, currentLeague, challenge)
      )
    );
  });

export const listOccupiedSlots = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueChallengeOccupiedSlotSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    await getViewerContextOrThrow(ctx, leagueId);

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { leagueId },
    });

    const occupiedSlots = await Promise.all(
      challengeRecords.map(async (challenge) => {
        if (
          !(
            challenge.currentProposalId &&
            isChallengeSlotBlocked(challenge.status as LeagueChallengeStatus)
          )
        ) {
          return null;
        }

        const currentProposal =
          await ctx.orm.query.leagueChallengeProposal.findFirst({
            where: {
              id: challenge.currentProposalId as Id<"leagueChallengeProposal">,
              challengeId: challenge.id as Id<"leagueChallenge">,
            },
          });

        if (!currentProposal) {
          return null;
        }

        return {
          challengeId: String(challenge.id),
          courtId: currentProposal.courtId,
          endMinute: currentProposal.endMinute,
          matchDate: currentProposal.matchDate,
          startMinute: currentProposal.startMinute,
        };
      })
    );

    return occupiedSlots.filter((slot) => slot !== null);
  });

export const getById = authQuery
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .query(async ({ ctx, input }) => {
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const { activeMembership, currentLeague, isManagerOwner } =
      await getViewerContextOrThrow(
        ctx,
        currentChallenge.leagueId as Id<"league">
      );

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner,
      viewerMembership: activeMembership,
    });

    return serializeChallenge(ctx, currentLeague, currentChallenge);
  });

export const create = authMutation
  .input(CreateLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
    const challengerMembership = await getActiveMembershipForUser(
      ctx,
      leagueId,
      ctx.userId
    );

    if (!challengerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para abrir um desafio.",
      });
    }

    const challengedMembership = await getActiveMembershipByIdOrThrow(
      ctx,
      leagueId,
      input.challengedMembershipId as Id<"leagueMembership">
    );

    await assertChallengeCreationRules({
      challengedMembership,
      challengerMembership,
      ctx,
      league: currentLeague,
    });
    assertCourtAvailability({
      courtId: input.courtId,
      currentLeague,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });
    await assertCourtSlotAvailable({
      courtId: input.courtId,
      ctx,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });

    const [createdChallenge] = await ctx.orm
      .insert(leagueChallenge)
      .values({
        leagueId,
        challengerMembershipId:
          challengerMembership.id as Id<"leagueMembership">,
        challengedMembershipId:
          challengedMembership.id as Id<"leagueMembership">,
        status: "pending_opponent_response",
        challengeValidationMode:
          currentLeague.ruleConfig.challengeValidationMode,
        resultValidationMode: currentLeague.ruleConfig.resultValidationMode,
        matchConfigSnapshot: currentLeague.ruleConfig.matchConfig,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [createdProposal] = await ctx.orm
      .insert(leagueChallengeProposal)
      .values({
        challengeId: createdChallenge.id as Id<"leagueChallenge">,
        proposedByMembershipId:
          challengerMembership.id as Id<"leagueMembership">,
        courtId: input.courtId,
        matchDate: input.matchDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        responseDeadlineAt: buildResponseDeadline({
          now,
          responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
        }),
        revisionNumber: 1,
        status: "active",
        createdAt: now,
      })
      .returning();

    await ctx.db.patch(createdChallenge.id as Id<"leagueChallenge">, {
      currentProposalId: createdProposal.id,
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...createdChallenge,
      currentProposalId: createdProposal.id,
      updatedAt: now,
    });
  });

export const acceptProposal = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      syncedChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para responder um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(syncedChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_STATUSES.has(
        syncedChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode mais ser aceito nessa etapa.",
      });
    }

    const nextStatus = resolveAcceptedChallengeStatus({
      challengeValidationMode: syncedChallenge.challengeValidationMode as
        | "automatic"
        | "manual",
    });

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "accepted",
      }),
      ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
        status: nextStatus,
        lockedAt: now.getTime(),
        confirmedAt: nextStatus === "confirmed" ? now.getTime() : undefined,
        updatedAt: now.getTime(),
      }),
    ]);

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      status: nextStatus,
      lockedAt: now,
      confirmedAt:
        nextStatus === "confirmed" ? now : syncedChallenge.confirmedAt,
      updatedAt: now,
    });
  });

export const declineProposal = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      currentChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para responder um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(currentChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_STATUSES.has(
        currentChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode mais ser recusado nessa etapa.",
      });
    }

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "declined",
      }),
      ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "declined",
        updatedAt: now.getTime(),
      }),
    ]);

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "declined",
      updatedAt: now,
    });
  });

export const counterPropose = authMutation
  .input(CounterProposeLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      syncedChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para negociar um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(syncedChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_STATUSES.has(
        syncedChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode receber uma contraproposta agora.",
      });
    }

    assertCourtAvailability({
      courtId: input.courtId,
      currentLeague,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });
    await assertCourtSlotAvailable({
      challengeIdToIgnore: syncedChallenge.id as Id<"leagueChallenge">,
      courtId: input.courtId,
      ctx,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });

    const nextStatus =
      syncedChallenge.status === "pending_opponent_response"
        ? "pending_creator_reapproval"
        : "pending_opponent_response";

    const [createdProposal] = await ctx.orm
      .insert(leagueChallengeProposal)
      .values({
        challengeId: syncedChallenge.id as Id<"leagueChallenge">,
        proposedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
        courtId: input.courtId,
        matchDate: input.matchDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        responseDeadlineAt: buildResponseDeadline({
          now,
          responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
        }),
        revisionNumber: currentProposal.revisionNumber + 1,
        status: "active",
        createdAt: now,
      })
      .returning();

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "replaced",
      }),
      ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
        currentProposalId: createdProposal.id,
        status: nextStatus,
        updatedAt: now.getTime(),
      }),
    ]);

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      currentProposalId: createdProposal.id,
      status: nextStatus,
      updatedAt: now,
    });
  });

export const cancel = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const isManagerOwner = currentLeague.managerUserId === ctx.userId;
    const viewerMembership = isManagerOwner
      ? null
      : await getActiveMembershipForUser(
          ctx,
          currentChallenge.leagueId as Id<"league">,
          ctx.userId
        );

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner,
      viewerMembership,
    });

    if (
      !(
        isManagerOwner ||
        canPlayersCancelChallenge({
          now,
          scheduledStartAt: buildScheduledDate(
            currentProposal.matchDate,
            currentProposal.startMinute
          ),
        })
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Depois do horário marcado, só o admin pode cancelar.",
      });
    }

    if (
      CLOSED_CHALLENGE_STATUSES.has(
        currentChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio já está encerrado.",
      });
    }

    if (!isManagerOwner) {
      if (currentChallenge.status === "confirmed") {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message:
            "Depois da confirmação, solicite o cancelamento para o outro jogador.",
        });
      }

      if (currentChallenge.status === "pending_cancellation_acceptance") {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio já está aguardando resposta de cancelamento.",
        });
      }
    }

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "cancelled",
      }),
      ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "cancelled",
        cancelledAt: now.getTime(),
        updatedAt: now.getTime(),
      }),
    ]);

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    });
  });

export const requestCancellation = authMutation
  .input(RequestLeagueChallengeCancellationSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      currentChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para solicitar o cancelamento.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (currentChallenge.status !== "confirmed") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Só é possível solicitar cancelamento em partidas confirmadas.",
      });
    }

    if (
      !canPlayersCancelChallenge({
        now,
        scheduledStartAt: buildScheduledDate(
          currentProposal.matchDate,
          currentProposal.startMinute
        ),
      })
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Depois do horário marcado, só o admin pode cancelar.",
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "pending_cancellation_acceptance",
      cancellationRequestedAt: now.getTime(),
      cancellationRequestedByMembershipId:
        viewerMembership.id as Id<"leagueMembership">,
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "pending_cancellation_acceptance",
      cancellationRequestedAt: now,
      cancellationRequestedByMembershipId:
        viewerMembership.id as Id<"leagueMembership">,
      updatedAt: now,
    });
  });

export const respondCancellationRequest = authMutation
  .input(RespondLeagueChallengeCancellationSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      currentChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para responder ao cancelamento.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (currentChallenge.status !== "pending_cancellation_acceptance") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando resposta de cancelamento.",
      });
    }

    const receiverMembershipId =
      getCancellationResponseMembershipId(currentChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !currentChallenge.cancellationRequestedByMembershipId
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Você não pode responder essa solicitação de cancelamento.",
      });
    }

    if (input.action === "accept") {
      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          status: "cancelled",
        }),
        ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
          status: "cancelled",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          cancelledAt: now.getTime(),
          updatedAt: now.getTime(),
        }),
      ]);

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "cancelled",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "confirmed",
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "confirmed",
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      updatedAt: now,
    });
  });

export const submitResult = authMutation
  .input(SubmitLeagueChallengeResultSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      syncedChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para enviar um resultado.",
      });
    }

    assertParticipantAccess({
      challenge: syncedChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (
      ![
        "confirmed",
        "pending_result_submission",
        "pending_result_correction",
        "pending_result_confirmation",
      ].includes(syncedChallenge.status)
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não pode receber resultado.",
      });
    }

    const parsedScore = leagueChallengeScoreSchema.parse(input.score);

    await ctx.orm
      .insert(leagueChallengeResultSubmission)
      .values({
        challengeId: syncedChallenge.id as Id<"leagueChallenge">,
        submittedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
        score: parsedScore,
        winnerMembershipId:
          parsedScore.winnerMembershipId as Id<"leagueMembership">,
        submittedAt: now,
      })
      .returning();

    await ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
      status: "pending_result_confirmation",
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      status: "pending_result_confirmation",
      updatedAt: now,
    });
  });

export const confirmResult = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveMembershipForUser(
      ctx,
      currentChallenge.leagueId as Id<"league">,
      ctx.userId
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para confirmar um resultado.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (!latestResultSubmission) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Ainda não existe resultado enviado para esse desafio.",
      });
    }

    if (
      latestResultSubmission.submittedByMembershipId === viewerMembership.id
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Quem enviou o resultado não pode confirmá-lo.",
      });
    }

    if (latestResultSubmission.confirmedByMembershipId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse resultado já foi confirmado.",
      });
    }

    const nextStatus = resolveScoreConfirmationStatus({
      resultValidationMode: currentChallenge.resultValidationMode as
        | "automatic"
        | "manual",
    });
    const rankingSnapshots =
      nextStatus === "finished"
        ? await applyChallengeRankingResult({
            challenge: currentChallenge,
            ctx,
            currentLeague,
            score: latestResultSubmission.score as LeagueChallengeScore,
          })
        : null;

    await ctx.db.patch(
      latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
      {
        confirmedAt: now.getTime(),
        confirmedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
      }
    );

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        status: nextStatus,
        finishedAt: nextStatus === "finished" ? now.getTime() : undefined,
        rankingAppliedAt: nextStatus === "finished" ? now.getTime() : null,
        rankingSnapshotAfterResult:
          rankingSnapshots?.rankingSnapshotAfterResult ?? undefined,
        rankingSnapshotBeforeResult:
          rankingSnapshots?.rankingSnapshotBeforeResult ?? undefined,
        updatedAt: now.getTime(),
      } as never
    );

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: nextStatus,
      finishedAt: nextStatus === "finished" ? now : currentChallenge.finishedAt,
      updatedAt: now,
    });
  });

export const reviewChallenge = authMutation
  .input(ReviewLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (currentLeague.managerUserId !== ctx.userId) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Só o admin da liga pode validar esse desafio.",
      });
    }

    if (currentChallenge.status !== "pending_admin_challenge_validation") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando validação manual.",
      });
    }

    if (input.action === "approve") {
      await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "confirmed",
        confirmedAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "confirmed",
        confirmedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "cancelled",
      cancelledAt: now.getTime(),
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    });
  });

export const reviewResult = authMutation
  .input(ReviewLeagueChallengeResultSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (currentLeague.managerUserId !== ctx.userId) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Só o admin da liga pode validar resultados.",
      });
    }

    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (
      !latestResultSubmission ||
      latestResultSubmission.id !== input.resultSubmissionId
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "O resultado informado não corresponde ao desafio.",
      });
    }

    if (currentChallenge.status !== "pending_admin_result_validation") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando validação de resultado.",
      });
    }

    if (input.action === "approve") {
      const rankingSnapshots = await applyChallengeRankingResult({
        challenge: currentChallenge,
        ctx,
        currentLeague,
        score: latestResultSubmission.score as LeagueChallengeScore,
      });

      await ctx.db.patch(
        latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
        {
          adminReviewedByUserId: ctx.userId,
          reviewAction: "approved",
          reviewedAt: now.getTime(),
        }
      );

      await ctx.db.patch(
        currentChallenge.id as Id<"leagueChallenge">,
        {
          status: "finished",
          finishedAt: now.getTime(),
          rankingAppliedAt: now.getTime(),
          rankingSnapshotAfterResult:
            rankingSnapshots.rankingSnapshotAfterResult,
          rankingSnapshotBeforeResult:
            rankingSnapshots.rankingSnapshotBeforeResult,
          updatedAt: now.getTime(),
        } as never
      );

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "finished",
        finishedAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "request_correction") {
      await ctx.db.patch(
        latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
        {
          adminReviewedByUserId: ctx.userId,
          reviewAction: "correction_requested",
          reviewedAt: now.getTime(),
        }
      );

      await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "pending_result_correction",
        updatedAt: now.getTime(),
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "pending_result_correction",
        updatedAt: now,
      });
    }

    await ctx.db.patch(
      latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
      {
        adminReviewedByUserId: ctx.userId,
        reviewAction: "invalidated",
        reviewedAt: now.getTime(),
      }
    );

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "invalidated",
      invalidatedAt: now.getTime(),
      updatedAt: now.getTime(),
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "invalidated",
      invalidatedAt: now,
      updatedAt: now,
    });
  });

const ADMIN_CANCELABLE_STATUSES = new Set<LeagueChallengeStatus>([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "pending_admin_challenge_validation",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
]);

const ADMIN_INVALIDATABLE_STATUSES = new Set<LeagueChallengeStatus>([
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
  "finished",
]);

export const adminManage = authMutation
  .input(AdminManageLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (currentLeague.managerUserId !== ctx.userId) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Só o admin da liga pode executar essa ação.",
      });
    }

    const currentStatus = currentChallenge.status as LeagueChallengeStatus;
    const reason = input.reason.trim();
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (input.action === "cancel") {
      if (!ADMIN_CANCELABLE_STATUSES.has(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode mais ser cancelado pelo admin.",
        });
      }

      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          status: "cancelled",
        }),
        ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
          status: "cancelled",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          cancelledAt: now.getTime(),
          updatedAt: now.getTime(),
        }),
      ]);

      await recordAdminChallengeAction({
        action: "cancel",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        reason,
        toStatus: "cancelled",
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "cancelled",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "invalidate") {
      if (!ADMIN_INVALIDATABLE_STATUSES.has(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode ser invalidado nesse estado.",
        });
      }

      if (currentStatus === "finished") {
        await restoreChallengeRankingSnapshot({
          challenge: currentChallenge,
          ctx,
        });
      }

      if (latestResultSubmission) {
        await ctx.db.patch(
          latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
          {
            adminReviewedByUserId: ctx.userId,
            reviewAction: "invalidated",
            reviewedAt: now.getTime(),
          }
        );
      }

      await ctx.db.patch(
        currentChallenge.id as Id<"leagueChallenge">,
        {
          status: "invalidated",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          finishedAt: null,
          invalidatedAt: now.getTime(),
          rankingAppliedAt: null,
          updatedAt: now.getTime(),
        } as never
      );

      await recordAdminChallengeAction({
        action: "invalidate",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        reason,
        toStatus: "invalidated",
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "invalidated",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        finishedAt: null,
        invalidatedAt: now,
        rankingAppliedAt: null,
        updatedAt: now,
      });
    }

    if (input.action === "reopen_challenge") {
      if (!["declined", "cancelled", "invalidated"].includes(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode ser reaberto nesse estado.",
        });
      }

      if (latestResultSubmission) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message:
            "Esse desafio já possui placar. Use a ação de reabrir resultado.",
        });
      }

      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );
      const nextStatus = resolveReopenedChallengeStatus({
        challengerMembershipId: String(currentChallenge.challengerMembershipId),
        proposedByMembershipId: String(currentProposal.proposedByMembershipId),
      });
      const responseDeadlineAt = buildResponseDeadline({
        now,
        responseDeadlineHours: currentLeague.ruleConfig.responseDeadlineHours,
      });

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          responseDeadlineAt: responseDeadlineAt.getTime(),
          status: "active",
        }),
        ctx.db.patch(
          currentChallenge.id as Id<"leagueChallenge">,
          {
            status: nextStatus,
            cancellationRequestedAt: null,
            cancellationRequestedByMembershipId: null,
            cancelledAt: null,
            confirmedAt: null,
            finishedAt: null,
            invalidatedAt: null,
            lockedAt: null,
            rankingAppliedAt: null,
            updatedAt: now.getTime(),
          } as never
        ),
      ]);

      await recordAdminChallengeAction({
        action: "reopen_challenge",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        reason,
        toStatus: nextStatus,
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: nextStatus,
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: null,
        confirmedAt: null,
        finishedAt: null,
        invalidatedAt: null,
        lockedAt: null,
        rankingAppliedAt: null,
        updatedAt: now,
      });
    }

    if (!["finished", "invalidated"].includes(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse resultado não pode ser reaberto nesse estado.",
      });
    }

    if (!latestResultSubmission) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não possui placar para reabrir.",
      });
    }

    if (currentChallenge.rankingAppliedAt) {
      await restoreChallengeRankingSnapshot({
        challenge: currentChallenge,
        ctx,
      });
    }

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        status: "pending_result_correction",
        finishedAt: null,
        invalidatedAt: null,
        rankingAppliedAt: null,
        updatedAt: now.getTime(),
      } as never
    );

    await recordAdminChallengeAction({
      action: "reopen_result",
      challenge: currentChallenge,
      ctx,
      fromStatus: currentStatus,
      performedByUserId: ctx.userId,
      reason,
      toStatus: "pending_result_correction",
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "pending_result_correction",
      finishedAt: null,
      invalidatedAt: null,
      rankingAppliedAt: null,
      updatedAt: now,
    });
  });
