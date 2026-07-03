import type { Id } from "../../../functions/_generated/dataModel";
import {
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  type LeagueChallengeStatus,
} from "../../../domains/league/challenge-rules";
import { VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES } from "../../../domains/league/challenge-status";
import { buildScheduledDate } from "../../../domains/league/challenge-scheduling-rules";
import type {
  LeagueChallengeProposalRecord,
  LeagueChallengeRecord,
  LeagueChallengeResultSubmissionRecord,
  OrmMutationCtx,
} from "./types";

export function computeEffectiveChallengeStatus(input: {
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

export async function syncTimeDrivenChallengeStatus(
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
