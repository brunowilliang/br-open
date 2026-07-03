import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  applyChallengeResultToRanking,
  canPlayersCancelChallenge,
  isChallengeSlotBlocked,
  resolveAcceptedChallengeStatus,
  resolveChallengeCreationRuleError,
  resolveChallengeRankingRestore,
  resolveResponseDeadline,
  validateChallengeScore,
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  resolveReopenedChallengeStatus,
  resolveScoreConfirmationStatus,
  type LeagueChallengeStatus,
} from "../../domains/league/challenge-rules";
import {
  AdminManageLeagueChallengeSchema,
  AdminSubmitLeagueChallengeResultSchema,
  CounterProposeLeagueChallengeSchema,
  CreateLeagueChallengeSchema,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  LeagueByIdSchema,
  LeagueChallengeByIdSchema,
  leagueChallengeSchema,
  leagueChallengeScoreSchema,
  LeagueMatchConfigSchema,
  leagueMembershipPlayerSchema,
  leagueScheduleItemSchema,
  leagueSchema,
  RequestLeagueChallengeCancellationSchema,
  RespondLeagueChallengeCancellationSchema,
  ReviewLeagueChallengeResultSchema,
  ReviewLeagueChallengeSchema,
  SubmitLeagueChallengeResultSchema,
  type League,
  type LeagueChallenge,
  type LeagueChallengeProposal,
  type LeagueChallengeResultSubmission,
  type LeagueChallengeScore,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  normalizeLeagueVisibility,
  resolveRuleValue,
} from "../../domains/league/contract";
import {
  ADMIN_CANCELABLE_CHALLENGE_STATUSES,
  ADMIN_INVALIDATABLE_CHALLENGE_STATUSES,
  ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES,
  ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
  VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES,
} from "../../domains/league/challenge-status";
import {
  buildScheduledDate,
  getDayKeyFromMatchDate,
  rangesOverlap,
} from "../../domains/league/challenge-scheduling-rules";
import {
  leagueChallenge,
  leagueChallengeAdminAction,
  leagueChallengeProposal,
  leagueChallengeResultSubmission,
  type league,
  type leagueMembership,
} from "../../domains/league/tables";
import type { NotificationEventType } from "../../shared/notifications/protocol";
import { isActiveActorManager } from "../../domains/auth/actor-context";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import { scheduleLeagueNotification } from "../notification/events";
import { internal } from "../_generated/api";
import {
  getViewerContext,
  requireActivePlayerProfile,
} from "../viewer/context";

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

function serializeLeagueRecord(record: LeagueRecord) {
  return leagueSchema.parse({
    ...record,
    visibility: normalizeLeagueVisibility(record.visibility),
    avatarStorageId:
      record.avatarStorageId &&
      !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(
        record.avatarStorageId
      )
        ? record.avatarStorageId
        : null,
    coverStorageId:
      record.coverStorageId &&
      !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(
        record.coverStorageId
      )
        ? record.coverStorageId
        : null,
    courts: record.courts ?? [],
    maxPlayers: record.maxPlayers ?? null,
    monthlyPriceCents:
      record.monthlyPriceCents ?? DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
    priceBillingInterval:
      record.priceBillingInterval ?? DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
    ruleConfig: {
      ...record.ruleConfig,
      scheduleVisibility:
        record.ruleConfig?.scheduleVisibility ??
        DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
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

async function resolvePlayerProfileAvatarUrl(
  ctx: OrmCtx,
  storageId?: null | string
) {
  if (!storageId) {
    return null;
  }

  try {
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  } catch {
    return null;
  }
}

async function getPlayerSummary(
  ctx: OrmCtx,
  playerProfileId: Id<"playerProfile">
) {
  const playerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { id: playerProfileId },
  });

  if (!playerProfile) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Jogador não encontrado.",
    });
  }

  const user = await ctx.orm.query.user.findFirst({
    where: { id: playerProfile.userId },
  });
  const fullName = playerProfile.fullName?.trim() || user?.name || "Jogador";
  const nickname =
    playerProfile.nickname?.trim() ||
    playerProfile.fullName?.trim() ||
    user?.name ||
    "Jogador";
  const avatarUrl = await resolvePlayerProfileAvatarUrl(
    ctx,
    playerProfile.avatarStorageId
  );

  return leagueMembershipPlayerSchema.parse({
    avatarUrl: avatarUrl ?? user?.image ?? null,
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
    playerProfileId: membership.playerProfileId,
    rankingPosition: membership.rankingPosition ?? null,
    player: await getPlayerSummary(
      ctx,
      membership.playerProfileId as Id<"playerProfile">
    ),
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

async function canManageLeague(ctx: OrmCtx, currentLeague: League) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const { activeActor } = viewerContext;

  return (
    activeActor.kind === "organization" &&
    activeActor.id === currentLeague.organizationId &&
    isActiveActorManager(activeActor)
  );
}

async function assertCanManageLeague(
  ctx: OrmCtx,
  currentLeague: League,
  message: string
) {
  if (await canManageLeague(ctx, currentLeague)) {
    return;
  }

  throw new CRPCError({
    code: "FORBIDDEN",
    message,
  });
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

function getActiveMembershipForPlayerProfile(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  playerProfileId: Id<"playerProfile">
) {
  return ctx.orm.query.leagueMembership.findFirst({
    where: {
      leagueId,
      playerProfileId,
      status: "active",
    },
  });
}

async function getActiveViewerMembership(ctx: OrmCtx, leagueId: Id<"league">) {
  const playerProfileId = await requireActivePlayerProfile(ctx);

  return getActiveMembershipForPlayerProfile(ctx, leagueId, playerProfileId);
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
  const isManagerOwner = await canManageLeague(ctx, currentLeague);
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const activeMembership =
    isManagerOwner || viewerContext.activeActor.kind !== "player"
      ? null
      : await getActiveMembershipForPlayerProfile(
          ctx,
          leagueId,
          viewerContext.activeActor.id as Id<"playerProfile">
        );

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
    const proposalId =
      challenge.currentProposalId as Id<"leagueChallengeProposal">;
    const currentProposal =
      await ctx.orm.query.leagueChallengeProposal.findFirst({
        where: { id: proposalId },
      });

    if (currentProposal && currentProposal.challengeId === challenge.id) {
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
    VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
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

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const challengesCreatedThisMonth = activeChallenges.filter(
    (challenge) =>
      challenge.challengerMembershipId === input.challengerMembership.id &&
      challenge.createdAt >= monthStart
  ).length;
  const ruleError = resolveChallengeCreationRuleError({
    challengedActiveChallengeCount: activeChallengeCountForMembership(
      input.challengedMembership.id as Id<"leagueMembership">
    ),
    challengedMembershipId: String(input.challengedMembership.id),
    challengedPosition: input.challengedMembership.rankingPosition,
    challengerActiveChallengeCount: activeChallengeCountForMembership(
      input.challengerMembership.id as Id<"leagueMembership">
    ),
    challengerCreatedThisMonthCount: challengesCreatedThisMonth,
    challengerMembershipId: String(input.challengerMembership.id),
    challengerPosition: input.challengerMembership.rankingPosition,
    maxActiveChallengesPerPlayer: resolveRuleValue(
      input.league.ruleConfig.maxActiveChallengesPerPlayer,
      Number.POSITIVE_INFINITY
    ),
    maxChallengeDistance: resolveRuleValue(
      input.league.ruleConfig.maxChallengeDistance,
      Number.POSITIVE_INFINITY
    ),
    maxChallengesPerMonth: resolveRuleValue(
      input.league.ruleConfig.maxChallengesPerMonth,
      Number.POSITIVE_INFINITY
    ),
  });

  if (ruleError) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: ruleError,
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

async function recordAdminChallengeAction(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  fromStatus: LeagueChallengeStatus;
  performedByUserId: Id<"user">;
  toStatus: LeagueChallengeStatus;
}) {
  await input.ctx.orm.insert(leagueChallengeAdminAction).values({
    action: input.action,
    challengeId: input.challenge.id as Id<"leagueChallenge">,
    createdAt: new Date(),
    fromStatus: input.fromStatus,
    performedByUserId: input.performedByUserId,
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

async function scheduleChallengeNotification(input: {
  actorUserId: Id<"user">;
  challenge: LeagueChallengeRecord;
  ctx: OrmMutationCtx;
  eventType: NotificationEventType;
  metadata?: Record<string, unknown>;
  recipientMembershipIds: Id<"leagueMembership">[];
}) {
  const memberships = await Promise.all(
    Array.from(new Set(input.recipientMembershipIds)).map((membershipId) =>
      getMembershipRecordByIdOrThrow(input.ctx, membershipId)
    )
  );
  const recipientUserIds = await Promise.all(
    memberships.map(async (membership) => {
      const currentPlayerProfile =
        await input.ctx.orm.query.playerProfile.findFirst({
          where: {
            id: membership.playerProfileId as Id<"playerProfile">,
          },
        });

      return currentPlayerProfile?.userId as Id<"user"> | undefined;
    })
  );

  await scheduleLeagueNotification(input.ctx, {
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    leagueId: input.challenge.leagueId as Id<"league">,
    metadata: {
      challengeId: input.challenge.id,
      ...input.metadata,
    },
    recipientUserIds: recipientUserIds.filter((userId): userId is Id<"user"> =>
      Boolean(userId)
    ),
    sourceEntityId: input.challenge.id,
    sourceEntityType: "leagueChallenge",
  });
}

/**
 * Retracts prior feed rows tied to this challenge before emitting a
 * superseding event (cancel, reschedule via counter-propose, admin
 * cancel/reopen). Prevents stale "Novo desafio" / "Proposta recebida"
 * notifications from lingering in the in-app feed after the challenge has
 * moved on.
 */
async function retractChallengeNotifications(
  ctx: OrmMutationCtx,
  challengeId: Id<"leagueChallenge"> | string
) {
  await ctx.runMutation(
    internal.notification.orchestrator.retractNotifications,
    {
      sourceEntityId: challengeId,
      sourceEntityType: "leagueChallenge",
    }
  );
}

function buildTodayUtcKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export const listScheduled = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueScheduleItemSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
    const scheduleVisibility =
      currentLeague.ruleConfig.scheduleVisibility ?? "public";

    // Acesso público (qualquer usuário autenticado) quando a agenda é pública.
    // Caso contrário, exige owner ou participante ativo.
    if (scheduleVisibility !== "public") {
      await getViewerContextOrThrow(ctx, leagueId);
    }

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      where: { leagueId },
    });

    const todayUtc = buildTodayUtcKey();
    const scheduledItems = await Promise.all(
      challengeRecords.map(async (challenge) => {
        if (challenge.status !== "confirmed") {
          return null;
        }

        const currentProposal = await getCurrentProposalOrThrow(ctx, challenge);

        if (currentProposal.matchDate < todayUtc) {
          return null;
        }

        const [challengerMembership, challengedMembership] = await Promise.all([
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengerMembershipId as Id<"leagueMembership">
          ),
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengedMembershipId as Id<"leagueMembership">
          ),
        ]);

        const [challenger, challenged] = await Promise.all([
          getPlayerSummary(
            ctx,
            challengerMembership.playerProfileId as Id<"playerProfile">
          ),
          getPlayerSummary(
            ctx,
            challengedMembership.playerProfileId as Id<"playerProfile">
          ),
        ]);

        const courtName = getCourtNameOrThrow(
          currentLeague,
          currentProposal.courtId
        );

        return leagueScheduleItemSchema.parse({
          challenged: {
            avatarUrl: challenged.avatarUrl ?? null,
            fullName: challenged.fullName,
          },
          challenger: {
            avatarUrl: challenger.avatarUrl ?? null,
            fullName: challenger.fullName,
          },
          courtName,
          id: challenge.id,
          matchDate: currentProposal.matchDate,
          startMinute: currentProposal.startMinute,
        });
      })
    );

    return scheduledItems
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.matchDate !== b.matchDate) {
          return a.matchDate < b.matchDate ? -1 : 1;
        }
        return a.startMinute - b.startMinute;
      });
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

        if (!challenge.currentProposalId) {
          return null;
        }
        const proposalId =
          challenge.currentProposalId as Id<"leagueChallengeProposal">;
        const currentProposal =
          await ctx.orm.query.leagueChallengeProposal.findFirst({
            where: { id: proposalId },
          });
        if (!currentProposal || currentProposal.challengeId !== challenge.id) {
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
    const challengerMembership = await getActiveViewerMembership(ctx, leagueId);

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
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: createdChallenge,
      ctx,
      eventType: "league.challenge.created",
      metadata: { proposalId: createdProposal.id },
      recipientMembershipIds: [
        challengedMembership.id as Id<"leagueMembership">,
      ],
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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
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
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.proposal_accepted",
      metadata: { proposalId: currentProposal.id },
      recipientMembershipIds: [
        (viewerMembership.id === syncedChallenge.challengerMembershipId
          ? syncedChallenge.challengedMembershipId
          : syncedChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
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
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.proposal_declined",
      metadata: { proposalId: currentProposal.id },
      recipientMembershipIds: [
        (viewerMembership.id === currentChallenge.challengerMembershipId
          ? currentChallenge.challengedMembershipId
          : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
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
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
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
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
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

    await retractChallengeNotifications(ctx, syncedChallenge.id);
    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.counter_proposed",
      metadata: { proposalId: createdProposal.id },
      recipientMembershipIds: [
        (nextStatus === "pending_creator_reapproval"
          ? syncedChallenge.challengerMembershipId
          : syncedChallenge.challengedMembershipId) as Id<"leagueMembership">,
      ],
    });

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
    const isManagerOwner = await canManageLeague(ctx, currentLeague);
    const viewerMembership = isManagerOwner
      ? null
      : await getActiveViewerMembership(
          ctx,
          currentChallenge.leagueId as Id<"league">
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

    await retractChallengeNotifications(ctx, currentChallenge.id);
    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancelled",
      recipientMembershipIds: isManagerOwner
        ? [
            currentChallenge.challengerMembershipId as Id<"leagueMembership">,
            currentChallenge.challengedMembershipId as Id<"leagueMembership">,
          ]
        : [
            (viewerMembership?.id === currentChallenge.challengerMembershipId
              ? currentChallenge.challengedMembershipId
              : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
          ],
    });

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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancellation_requested",
      recipientMembershipIds: [
        (viewerMembership.id === currentChallenge.challengerMembershipId
          ? currentChallenge.challengedMembershipId
          : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
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

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.cancellation_accepted",
        recipientMembershipIds: [
          currentChallenge.cancellationRequestedByMembershipId as Id<"leagueMembership">,
        ],
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

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "confirmed",
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancellation_rejected",
      recipientMembershipIds: [
        currentChallenge.cancellationRequestedByMembershipId as Id<"leagueMembership">,
      ],
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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
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
    const matchConfigSnapshot = LeagueMatchConfigSchema.parse(
      syncedChallenge.matchConfigSnapshot
    );
    const scoreValidationError = validateChallengeScore({
      challengedMembershipId: String(syncedChallenge.challengedMembershipId),
      challengerMembershipId: String(syncedChallenge.challengerMembershipId),
      matchConfig: matchConfigSnapshot,
      score: parsedScore,
    });

    if (scoreValidationError) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: scoreValidationError,
      });
    }

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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.result_submitted",
      recipientMembershipIds: [
        (viewerMembership.id === syncedChallenge.challengerMembershipId
          ? syncedChallenge.challengedMembershipId
          : syncedChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
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
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_confirmed",
      recipientMembershipIds: [
        latestResultSubmission.submittedByMembershipId as Id<"leagueMembership">,
      ],
    });

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

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode validar esse desafio."
    );

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

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.admin_approved",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.admin_rejected",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
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

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode validar resultados."
    );

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

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_confirmed",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

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

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_correction_requested",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
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

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_invalidated",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "invalidated",
      invalidatedAt: now,
      updatedAt: now,
    });
  });

export const adminSubmitResult = authMutation
  .input(AdminSubmitLeagueChallengeResultSchema)
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

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode editar o placar."
    );

    // Sincroniza status derivados do tempo (ex.: proposta sem resposta após o
    // deadline vira pending_admin_decision) antes de validar, para que o
    // status refletido na UI (derivado) seja o mesmo usado aqui.
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

    const currentStatus = syncedChallenge.status as LeagueChallengeStatus;

    if (!ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não pode receber placar pelo admin.",
      });
    }

    const parsedScore = leagueChallengeScoreSchema.parse(input.score);
    const matchConfigSnapshot = LeagueMatchConfigSchema.parse(
      currentChallenge.matchConfigSnapshot
    );
    const scoreValidationError = validateChallengeScore({
      challengedMembershipId: String(currentChallenge.challengedMembershipId),
      challengerMembershipId: String(currentChallenge.challengerMembershipId),
      matchConfig: matchConfigSnapshot,
      score: parsedScore,
    });

    if (scoreValidationError) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: scoreValidationError,
      });
    }

    if (currentChallenge.rankingAppliedAt) {
      await restoreChallengeRankingSnapshot({
        challenge: currentChallenge,
        ctx,
      });
    }

    const rankingSnapshots = await applyChallengeRankingResult({
      challenge: currentChallenge,
      ctx,
      currentLeague,
      score: parsedScore,
    });

    await ctx.orm
      .insert(leagueChallengeResultSubmission)
      .values({
        adminReviewedByUserId: ctx.userId,
        challengeId: currentChallenge.id as Id<"leagueChallenge">,
        confirmedAt: now,
        confirmedByMembershipId:
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        reviewAction: "approved",
        reviewedAt: now,
        score: parsedScore,
        submittedAt: now,
        submittedByMembershipId:
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        winnerMembershipId:
          parsedScore.winnerMembershipId as Id<"leagueMembership">,
      })
      .returning();

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        finishedAt: now.getTime(),
        invalidatedAt: null,
        rankingAppliedAt: now.getTime(),
        rankingSnapshotAfterResult: rankingSnapshots.rankingSnapshotAfterResult,
        rankingSnapshotBeforeResult:
          rankingSnapshots.rankingSnapshotBeforeResult,
        status: "finished",
        updatedAt: now.getTime(),
      } as never
    );

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_confirmed",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      finishedAt: now,
      invalidatedAt: null,
      rankingAppliedAt: now,
      rankingSnapshotAfterResult: rankingSnapshots.rankingSnapshotAfterResult,
      rankingSnapshotBeforeResult: rankingSnapshots.rankingSnapshotBeforeResult,
      status: "finished",
      updatedAt: now,
    });
  });

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

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode executar essa ação."
    );

    const currentStatus = currentChallenge.status as LeagueChallengeStatus;
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (input.action === "cancel") {
      if (!ADMIN_CANCELABLE_CHALLENGE_STATUSES.has(currentStatus)) {
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
        toStatus: "cancelled",
      });

      await retractChallengeNotifications(ctx, currentChallenge.id);
      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.cancelled",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
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
      if (!ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has(currentStatus)) {
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
        toStatus: "invalidated",
      });

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_invalidated",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
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
      const responseDeadlineAt = resolveResponseDeadline({
        now,
        rule: currentLeague.ruleConfig.responseDeadlineHours,
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
        toStatus: nextStatus,
      });

      await retractChallengeNotifications(ctx, currentChallenge.id);
      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.admin_approved",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
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
      toStatus: "pending_result_correction",
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_correction_requested",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
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

/**
 * Status em que o admin pode enviar um lembrete aos jogadores pedindo que
 * registrem o placar. São os status onde o placar ainda está pendente de
 * ação de um jogador e o desafio não está finalizado/cancelado.
 */
export const adminRequestResultReminder = authMutation
  .input(LeagueChallengeByIdSchema)
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

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode enviar lembretes de placar."
    );

    // Sincroniza status derivados do tempo antes de validar, alinhando o
    // status usado aqui com o exibido na UI.
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

    const currentStatus = syncedChallenge.status as LeagueChallengeStatus;

    if (!ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES.has(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando placar dos jogadores.",
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.result_reminder_requested",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: currentStatus,
      updatedAt: now,
    });
  });
