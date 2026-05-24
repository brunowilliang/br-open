export const ACTIVE_CHALLENGE_BLOCKING_STATUSES = new Set([
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
] as const);

export type ActiveChallengeBlockingStatus =
  (typeof ACTIVE_CHALLENGE_BLOCKING_STATUSES extends Set<infer T> ? T : never) &
    string;

export type LeagueChallengeStatus =
  | ActiveChallengeBlockingStatus
  | "finished"
  | "declined"
  | "cancelled"
  | "invalidated";

export type LeagueChallengeValidationMode = "automatic" | "manual";
export type LeagueResultValidationMode = "automatic" | "manual";
export type LeagueChallengeWinBehavior =
  | "take_opponent_position"
  | "climb_one_position";
export type LeagueChallengeLossBehavior = "stay_put" | "drop_one_position";

type BuildResponseDeadlineInput = {
  now: Date;
  responseDeadlineHours: number;
};

type ResolveAcceptedChallengeStatusInput = {
  challengeValidationMode: LeagueChallengeValidationMode;
};

type ResolveScoreConfirmationStatusInput = {
  resultValidationMode: LeagueResultValidationMode;
};

type ResolveMissingResultStatusInput = {
  hasSubmittedResult: boolean;
  now: Date;
  scheduledEndAt: Date;
};

type CanPlayersCancelChallengeInput = {
  now: Date;
  scheduledStartAt: Date;
};

type ApplyChallengeResultToRankingInput = {
  challengedMembershipId: string;
  challengerMembershipId: string;
  lossBehavior: LeagueChallengeLossBehavior;
  rankingMembershipIds: string[];
  winBehavior: LeagueChallengeWinBehavior;
  winnerMembershipId: string;
};

type ResolveReopenedChallengeStatusInput = {
  challengerMembershipId: string;
  proposedByMembershipId: string;
};

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

function moveItem(
  items: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}

export function buildResponseDeadline(input: BuildResponseDeadlineInput) {
  return new Date(
    input.now.getTime() + input.responseDeadlineHours * MILLISECONDS_PER_HOUR
  );
}

export function resolveAcceptedChallengeStatus(
  input: ResolveAcceptedChallengeStatusInput
) {
  return input.challengeValidationMode === "manual"
    ? "pending_admin_challenge_validation"
    : "confirmed";
}

export function resolveScoreConfirmationStatus(
  input: ResolveScoreConfirmationStatusInput
) {
  return input.resultValidationMode === "manual"
    ? "pending_admin_result_validation"
    : "finished";
}

export function resolveNoResponseStatus() {
  return "pending_admin_decision";
}

export function resolveMissingResultStatus(
  input: ResolveMissingResultStatusInput
) {
  if (input.hasSubmittedResult || input.now < input.scheduledEndAt) {
    return null;
  }

  return "pending_result_submission";
}

export function canPlayersCancelChallenge(
  input: CanPlayersCancelChallengeInput
) {
  return input.now < input.scheduledStartAt;
}

export function isChallengeSlotBlocked(status: LeagueChallengeStatus) {
  return ACTIVE_CHALLENGE_BLOCKING_STATUSES.has(
    status as ActiveChallengeBlockingStatus
  );
}

export function applyChallengeResultToRanking(
  input: ApplyChallengeResultToRankingInput
) {
  const challengerIndex = input.rankingMembershipIds.indexOf(
    input.challengerMembershipId
  );
  const challengedIndex = input.rankingMembershipIds.indexOf(
    input.challengedMembershipId
  );

  if (challengerIndex === -1 || challengedIndex === -1) {
    return input.rankingMembershipIds;
  }

  if (input.winnerMembershipId === input.challengerMembershipId) {
    if (input.winBehavior === "climb_one_position") {
      return moveItem(
        input.rankingMembershipIds,
        challengerIndex,
        Math.max(0, challengerIndex - 1)
      );
    }

    const nextRanking = [...input.rankingMembershipIds];
    nextRanking[challengedIndex] = input.challengerMembershipId;
    nextRanking[challengerIndex] = input.challengedMembershipId;
    return nextRanking;
  }

  if (input.lossBehavior === "drop_one_position") {
    return moveItem(
      input.rankingMembershipIds,
      challengerIndex,
      Math.min(input.rankingMembershipIds.length - 1, challengerIndex + 1)
    );
  }

  return input.rankingMembershipIds;
}

export function resolveReopenedChallengeStatus(
  input: ResolveReopenedChallengeStatusInput
) {
  return input.proposedByMembershipId === input.challengerMembershipId
    ? "pending_opponent_response"
    : "pending_creator_reapproval";
}
