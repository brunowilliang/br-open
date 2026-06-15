const ADMIN_PENDING_STATUSES = new Set([
  "pending_admin_challenge_validation",
  "pending_admin_result_validation",
  "pending_admin_decision",
]);

export type ChallengeTabCountItem = {
  challenged: {
    membershipId?: string | null;
    playerProfileId?: string | null;
  };
  challenger: {
    membershipId?: string | null;
    playerProfileId?: string | null;
  };
  cancellationRequestedByMembershipId?: string | null;
  latestResultSubmission?: {
    submittedByMembershipId?: string | null;
  } | null;
  status: string;
};

function isViewerParticipant(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
  return (
    challenge.challenger.playerProfileId === viewerPlayerProfileId ||
    challenge.challenged.playerProfileId === viewerPlayerProfileId
  );
}

function isPlayerActionRequired(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
  if (!isViewerParticipant(challenge, viewerPlayerProfileId)) {
    return false;
  }

  if (challenge.status === "pending_opponent_response") {
    return challenge.challenged.playerProfileId === viewerPlayerProfileId;
  }

  if (challenge.status === "pending_creator_reapproval") {
    return challenge.challenger.playerProfileId === viewerPlayerProfileId;
  }

  if (challenge.status === "pending_cancellation_acceptance") {
    if (!challenge.cancellationRequestedByMembershipId) {
      return false;
    }

    if (
      challenge.cancellationRequestedByMembershipId ===
      challenge.challenger.membershipId
    ) {
      return challenge.challenged.playerProfileId === viewerPlayerProfileId;
    }

    return challenge.challenger.playerProfileId === viewerPlayerProfileId;
  }

  return [
    "confirmed",
    "pending_result_submission",
    "pending_result_confirmation",
    "pending_result_correction",
  ].includes(challenge.status);
}

export function buildChallengeTabCounts(input: {
  canManage?: boolean;
  challenges: ChallengeTabCountItem[];
  viewerPlayerProfileId?: string | null;
}) {
  if (input.canManage) {
    const pending = input.challenges.filter((challenge) =>
      ADMIN_PENDING_STATUSES.has(challenge.status)
    ).length;

    return {
      active: 0,
      corrections: 0,
      history: 0,
      incoming: 0,
      main: pending,
      outgoing: 0,
      pending,
    };
  }

  const active = input.challenges.filter((challenge) =>
    isPlayerActionRequired(challenge, input.viewerPlayerProfileId)
  ).length;

  return {
    active,
    corrections: 0,
    history: 0,
    incoming: 0,
    main: active,
    outgoing: 0,
    pending: 0,
  };
}
