import type { Id } from "../../../functions/_generated/dataModel";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import {
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  LeagueMatchConfigSchema,
  leagueChallengeSchema,
  leagueChallengeScoreSchema,
  leagueMembershipPlayerSchema,
  leagueSchema,
  normalizeLeagueVisibility,
  type League,
  type LeagueChallenge,
  type LeagueChallengeProposal,
  type LeagueChallengeResultSubmission,
} from "../../../domains/league/contract";
import { resolveStorageUrl } from "../../../shared/media-rules";
import { getCourtNameOrThrow } from "./scheduling_guards";
import { getChallengeProposals, getLatestResultSubmission } from "./proposals";
import { getMembershipRecordByIdOrThrow } from "./record_guards";
import { computeEffectiveChallengeStatus } from "./status_helpers";
import type {
  LeagueChallengeProposalRecord,
  LeagueChallengeRecord,
  LeagueChallengeResultSubmissionRecord,
  LeagueMembershipRecord,
  LeagueRecord,
  OrmCtx,
} from "./types";

export function serializeLeagueRecord(record: LeagueRecord) {
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

export async function getPlayerSummary(
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
  const avatarUrl = await resolveStorageUrl(ctx, playerProfile.avatarStorageId);

  return leagueMembershipPlayerSchema.parse({
    avatarUrl: avatarUrl ?? user?.image ?? null,
    fullName,
    nickname,
  });
}

export async function serializeParticipant(
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

export function serializeProposal(
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

export function serializeResultSubmission(
  resultSubmission: LeagueChallengeResultSubmissionRecord
) {
  return {
    id: resultSubmission.id,
    challengeId: resultSubmission.challengeId,
    submittedByMembershipId: resultSubmission.submittedByMembershipId,
    confirmedByMembershipId: resultSubmission.confirmedByMembershipId ?? null,
    organizerReviewedByUserId:
      resultSubmission.organizerReviewedByUserId ?? null,
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

export const leagueChallengeOccupiedSlotSchema = z.object({
  challengeId: z.string(),
  courtId: z.string(),
  endMinute: z.number().int(),
  matchDate: z.string(),
  startMinute: z.number().int(),
});

export async function serializeChallenge(
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
