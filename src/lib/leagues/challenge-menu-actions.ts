import type { ApiOutputs } from "@convex/shared/api";
import {
  Cancel01Icon,
  Edit02Icon,
  Megaphone01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { buildChallengeOrganizerMenuActionIds } from "./challenge-route-view";

export type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type ChallengeMenuAction = {
  icon: typeof Cancel01Icon;
  id: string;
  isDanger?: boolean;
  label: string;
  onPress: () => void;
};

export type ChallengeMenuCallbacks = {
  onAccept: (challengeId: string) => void;
  onAdminManage: (target: {
    action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
    challenge: ChallengeItem;
  }) => void;
  onCancel: (challengeId: string) => void;
  onConfirmResult: (challengeId: string) => void;
  onDecline: (challengeId: string) => void;
  onRequestCancellation: (challengeId: string) => void;
  onRespondCancellation: (input: {
    action: "accept" | "reject";
    challengeId: string;
  }) => void;
  onReviewChallenge: (input: {
    action: "approve" | "reject";
    challengeId: string;
  }) => void;
  onReviewResult: (input: {
    action: "approve" | "request_correction";
    challengeId: string;
    resultSubmissionId: string;
  }) => void;
  onRequestResultReminder: (challengeId: string) => void;
  setCounterProposalTarget: (challenge: ChallengeItem) => void;
  setResultTarget: (challenge: ChallengeItem) => void;
};

const CLOSED_STATUSES = new Set([
  "cancelled",
  "declined",
  "finished",
  "invalidated",
]);

export function buildScheduledStartAt(challenge: ChallengeItem): Date | null {
  const scheduledStartAt = new Date(
    `${challenge.currentProposal.matchDate}T00:00:00.000Z`
  );

  if (Number.isNaN(scheduledStartAt.getTime())) {
    return null;
  }

  scheduledStartAt.setUTCMinutes(challenge.currentProposal.startMinute, 0, 0);

  return scheduledStartAt;
}

function isViewerReceiver(
  challenge: ChallengeItem,
  viewerPlayerProfileId: string | null,
  canManage: boolean
) {
  if (canManage) {
    return false;
  }

  if (challenge.status === "pending_opponent_response") {
    return challenge.challenged.playerProfileId === viewerPlayerProfileId;
  }

  if (challenge.status === "pending_creator_reapproval") {
    return challenge.challenger.playerProfileId === viewerPlayerProfileId;
  }

  return false;
}

function canSubmitScore(challenge: ChallengeItem, canManage: boolean) {
  return (
    !canManage &&
    [
      "confirmed",
      "pending_result_confirmation",
      "pending_result_correction",
      "pending_result_submission",
    ].includes(challenge.status)
  );
}

function canConfirmScore(
  challenge: ChallengeItem,
  viewerPlayerProfileId: string | null,
  canManage: boolean
) {
  if (canManage || challenge.status !== "pending_result_confirmation") {
    return false;
  }

  const submittedBy = challenge.latestResultSubmission?.submittedByMembershipId;

  if (!submittedBy) {
    return false;
  }

  let viewerMembershipId: string | null = null;

  if (challenge.challenger.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenger.membershipId;
  } else if (challenge.challenged.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenged.membershipId;
  }

  return Boolean(viewerMembershipId && viewerMembershipId !== submittedBy);
}

function canRequestCancellation(challenge: ChallengeItem, canManage: boolean) {
  if (canManage || challenge.status !== "confirmed") {
    return false;
  }

  const scheduledStartAt = buildScheduledStartAt(challenge);

  if (!scheduledStartAt) {
    return false;
  }

  return Date.now() < scheduledStartAt.getTime();
}

function isViewerCancellationResponder(
  challenge: ChallengeItem,
  viewerPlayerProfileId: string | null,
  canManage: boolean
) {
  if (
    canManage ||
    challenge.status !== "pending_cancellation_acceptance" ||
    !challenge.cancellationRequestedByMembershipId
  ) {
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

/**
 * Builds the per-challenge menu action list for the challenges screen. Pure:
 * depends only on its inputs (challenge, viewer context, and callbacks), so it
 * can be memoized by the caller instead of being rebuilt on every render.
 */
export function buildChallengeMenuActions(input: {
  callbacks: ChallengeMenuCallbacks;
  canManage: boolean;
  challenge: ChallengeItem;
  viewerPlayerProfileId: string | null;
}): ChallengeMenuAction[] {
  const { callbacks, canManage, challenge, viewerPlayerProfileId } = input;
  const viewerIsReceiver = isViewerReceiver(
    challenge,
    viewerPlayerProfileId,
    canManage
  );
  const viewerIsCancellationResponder = isViewerCancellationResponder(
    challenge,
    viewerPlayerProfileId,
    canManage
  );
  const actions: ChallengeMenuAction[] = [];

  if (!canManage && viewerIsReceiver) {
    actions.push(
      {
        icon: Tick02Icon,
        id: `${challenge.id}-accept`,
        label: "Aceitar",
        onPress: () => {
          callbacks.onAccept(challenge.id);
        },
      },
      {
        icon: Edit02Icon,
        id: `${challenge.id}-counter-propose`,
        label: "Reenviar",
        onPress: () => {
          callbacks.setCounterProposalTarget(challenge);
        },
      },
      {
        icon: Cancel01Icon,
        id: `${challenge.id}-decline`,
        isDanger: true,
        label: "Recusar",
        onPress: () => {
          callbacks.onDecline(challenge.id);
        },
      }
    );
  }

  if (!canManage && viewerIsCancellationResponder) {
    actions.push(
      {
        icon: Tick02Icon,
        id: `${challenge.id}-accept-cancellation`,
        label: "Aceitar cancelamento",
        onPress: () => {
          callbacks.onRespondCancellation({
            action: "accept",
            challengeId: challenge.id,
          });
        },
      },
      {
        icon: Cancel01Icon,
        id: `${challenge.id}-reject-cancellation`,
        isDanger: true,
        label: "Recusar cancelamento",
        onPress: () => {
          callbacks.onRespondCancellation({
            action: "reject",
            challengeId: challenge.id,
          });
        },
      }
    );
  }

  const viewerCanRequestCancellation = canRequestCancellation(
    challenge,
    canManage
  );

  if (
    !(
      canManage ||
      viewerIsReceiver ||
      viewerIsCancellationResponder ||
      viewerCanRequestCancellation ||
      challenge.status === "confirmed" ||
      challenge.status === "pending_cancellation_acceptance" ||
      challenge.status === "pending_result_confirmation" ||
      challenge.status === "pending_result_correction" ||
      CLOSED_STATUSES.has(challenge.status)
    )
  ) {
    actions.push({
      icon: Cancel01Icon,
      id: `${challenge.id}-cancel`,
      isDanger: true,
      label: "Cancelar",
      onPress: () => {
        callbacks.onCancel(challenge.id);
      },
    });
  }

  if (viewerCanRequestCancellation) {
    actions.push({
      icon: Cancel01Icon,
      id: `${challenge.id}-request-cancellation`,
      isDanger: true,
      label: "Solicitar cancelamento",
      onPress: () => {
        callbacks.onRequestCancellation(challenge.id);
      },
    });
  }

  if (canSubmitScore(challenge, canManage)) {
    actions.push({
      icon: Edit02Icon,
      id: `${challenge.id}-submit-result`,
      label:
        challenge.status === "pending_result_confirmation"
          ? "Reeditar placar"
          : "Enviar placar",
      onPress: () => {
        callbacks.setResultTarget(challenge);
      },
    });
  }

  if (canConfirmScore(challenge, viewerPlayerProfileId, canManage)) {
    actions.push({
      icon: Tick02Icon,
      id: `${challenge.id}-confirm-result`,
      label: "Confirmar placar",
      onPress: () => {
        callbacks.onConfirmResult(challenge.id);
      },
    });
  }

  if (canManage) {
    pushAdminMenuActions(actions, challenge, callbacks);
  }

  return actions;
}

function pushAdminMenuActions(
  actions: ChallengeMenuAction[],
  challenge: ChallengeItem,
  callbacks: ChallengeMenuCallbacks
) {
  for (const actionId of buildChallengeOrganizerMenuActionIds(challenge)) {
    switch (actionId) {
      case "approve_challenge":
        actions.push({
          icon: Tick02Icon,
          id: `${challenge.id}-approve-challenge`,
          label: "Aprovar desafio",
          onPress: () => {
            callbacks.onReviewChallenge({
              action: "approve",
              challengeId: challenge.id,
            });
          },
        });
        break;
      case "reject_challenge":
        actions.push({
          icon: Cancel01Icon,
          id: `${challenge.id}-reject-challenge`,
          isDanger: true,
          label: "Rejeitar",
          onPress: () => {
            callbacks.onReviewChallenge({
              action: "reject",
              challengeId: challenge.id,
            });
          },
        });
        break;
      case "approve_result":
        actions.push({
          icon: Tick02Icon,
          id: `${challenge.id}-approve-result`,
          label: "Aprovar resultado",
          onPress: () => {
            callbacks.onReviewResult({
              action: "approve",
              challengeId: challenge.id,
              resultSubmissionId: challenge.latestResultSubmission?.id ?? "",
            });
          },
        });
        break;
      case "request_result_correction":
        actions.push({
          icon: Edit02Icon,
          id: `${challenge.id}-request-correction`,
          label: "Solicitar correção",
          onPress: () => {
            callbacks.onReviewResult({
              action: "request_correction",
              challengeId: challenge.id,
              resultSubmissionId: challenge.latestResultSubmission?.id ?? "",
            });
          },
        });
        break;
      case "submit_result":
        actions.push({
          icon: Edit02Icon,
          id: `${challenge.id}-organizer-submit-result`,
          label: challenge.latestResultSubmission
            ? "Editar placar"
            : "Lançar placar",
          onPress: () => {
            callbacks.setResultTarget(challenge);
          },
        });
        break;
      case "request_result_reminder":
        actions.push({
          icon: Megaphone01Icon,
          id: `${challenge.id}-request-result-reminder`,
          label: "Pedir placar",
          onPress: () => {
            callbacks.onRequestResultReminder(challenge.id);
          },
        });
        break;
      case "organizer_cancel":
        actions.push({
          icon: Cancel01Icon,
          id: `${challenge.id}-organizer-cancel`,
          isDanger: true,
          label: "Cancelar",
          onPress: () => {
            callbacks.onAdminManage({
              action: "cancel",
              challenge,
            });
          },
        });
        break;
      case "organizer_invalidate":
        actions.push({
          icon: Cancel01Icon,
          id: `${challenge.id}-organizer-invalidate`,
          isDanger: true,
          label: "Invalidar",
          onPress: () => {
            callbacks.onAdminManage({
              action: "invalidate",
              challenge,
            });
          },
        });
        break;
      case "reopen_challenge":
        actions.push({
          icon: Edit02Icon,
          id: `${challenge.id}-reopen-challenge`,
          label: "Reabrir desafio",
          onPress: () => {
            callbacks.onAdminManage({
              action: "reopen_challenge",
              challenge,
            });
          },
        });
        break;
      case "reopen_result":
        actions.push({
          icon: Edit02Icon,
          id: `${challenge.id}-reopen-result`,
          label: "Reabrir resultado",
          onPress: () => {
            callbacks.onAdminManage({
              action: "reopen_result",
              challenge,
            });
          },
        });
        break;
      default:
        break;
    }
  }
}
