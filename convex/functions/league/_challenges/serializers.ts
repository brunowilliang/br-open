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
    avatarStorageId:
      record.avatarStorageId &&
      !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(
        record.avatarStorageId
      )
        ? record.avatarStorageId
        : null,
    courts: record.courts ?? [],
    coverStorageId:
      record.coverStorageId &&
      !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(
        record.coverStorageId
      )
        ? record.coverStorageId
        : null,
    createdAt: record.createdAt.getTime(),
    maxPlayers: record.maxPlayers ?? null,
    monthlyPriceCents:
      record.monthlyPriceCents ?? DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
    priceBillingInterval:
      record.priceBillingInterval ?? DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
    ruleConfig: {
      ...record.ruleConfig,
      challengeValidationMode:
        record.ruleConfig?.challengeValidationMode ??
        DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode:
        record.ruleConfig?.resultValidationMode ??
        DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
      scheduleVisibility:
        record.ruleConfig?.scheduleVisibility ??
        DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
    },
    updatedAt: record.updatedAt.getTime(),
    visibility: normalizeLeagueVisibility(record.visibility),
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
    player: await getPlayerSummary(
      ctx,
      membership.playerProfileId as Id<"playerProfile">
    ),
    playerProfileId: membership.playerProfileId,
    rankingPosition: membership.rankingPosition ?? null,
  };
}

export function serializeProposal(
  currentLeague: League,
  proposal: LeagueChallengeProposalRecord
) {
  return {
    challengeId: proposal.challengeId,
    courtId: proposal.courtId,
    courtName: getCourtNameOrThrow(currentLeague, proposal.courtId),
    createdAt: proposal.createdAt.getTime(),
    endMinute: proposal.endMinute,
    id: proposal.id,
    matchDate: proposal.matchDate,
    proposedByMembershipId: proposal.proposedByMembershipId,
    responseDeadlineAt: proposal.responseDeadlineAt.getTime(),
    revisionNumber: proposal.revisionNumber,
    startMinute: proposal.startMinute,
    status: proposal.status as LeagueChallengeProposal["status"],
  } satisfies LeagueChallengeProposal;
}

export function serializeResultSubmission(
  resultSubmission: LeagueChallengeResultSubmissionRecord
) {
  return {
    challengeId: resultSubmission.challengeId,
    confirmedAt: resultSubmission.confirmedAt
      ? resultSubmission.confirmedAt.getTime()
      : null,
    confirmedByMembershipId: resultSubmission.confirmedByMembershipId ?? null,
    id: resultSubmission.id,
    organizerReviewedByUserId:
      resultSubmission.organizerReviewedByUserId ?? null,
    reviewAction:
      (resultSubmission.reviewAction as
        | LeagueChallengeResultSubmission["reviewAction"]
        | undefined) ?? null,
    reviewedAt: resultSubmission.reviewedAt
      ? resultSubmission.reviewedAt.getTime()
      : null,
    score: leagueChallengeScoreSchema.parse(resultSubmission.score),
    submittedAt: resultSubmission.submittedAt.getTime(),
    submittedByMembershipId: resultSubmission.submittedByMembershipId,
    winnerMembershipId: resultSubmission.winnerMembershipId ?? null,
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
    cancellationRequestedAt: challenge.cancellationRequestedAt
      ? challenge.cancellationRequestedAt.getTime()
      : null,
    cancellationRequestedByMembershipId:
      challenge.cancellationRequestedByMembershipId ?? null,
    cancelledAt: challenge.cancelledAt ? challenge.cancelledAt.getTime() : null,
    challenged: await serializeParticipant(ctx, challengedMembership),
    challenger: await serializeParticipant(ctx, challengerMembership),
    challengeValidationMode:
      challenge.challengeValidationMode as LeagueChallenge["challengeValidationMode"],
    confirmedAt: challenge.confirmedAt ? challenge.confirmedAt.getTime() : null,
    createdAt: challenge.createdAt.getTime(),
    currentProposal: serializeProposal(currentLeague, currentProposal),
    finishedAt: challenge.finishedAt ? challenge.finishedAt.getTime() : null,
    id: challenge.id,
    invalidatedAt: challenge.invalidatedAt
      ? challenge.invalidatedAt.getTime()
      : null,
    latestResultSubmission: latestResultSubmission
      ? serializeResultSubmission(latestResultSubmission)
      : null,
    leagueId: challenge.leagueId,
    lockedAt: challenge.lockedAt ? challenge.lockedAt.getTime() : null,
    matchConfigSnapshot: LeagueMatchConfigSchema.parse(
      challenge.matchConfigSnapshot
    ),
    proposals: proposals.map((proposal) =>
      serializeProposal(currentLeague, proposal)
    ),
    resultValidationMode:
      challenge.resultValidationMode as LeagueChallenge["resultValidationMode"],
    status: effectiveStatus as LeagueChallenge["status"],
    updatedAt: challenge.updatedAt.getTime(),
  } satisfies LeagueChallenge);
}
