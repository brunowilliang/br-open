import type { ApiOutputs } from "@convex/shared/api";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

const CLOSED_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> = new Set(
  ["finished", "declined", "cancelled", "invalidated"] as const
);

const ADMIN_PENDING_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> =
  new Set([
    "pending_admin_challenge_validation",
    "pending_admin_result_validation",
    "pending_admin_decision",
  ] as const);

const ADMIN_ACTIVE_CHALLENGE_STATUSES: ReadonlySet<ChallengeItem["status"]> =
  new Set([
    "pending_opponent_response",
    "pending_creator_reapproval",
    "confirmed",
    "pending_cancellation_acceptance",
    "pending_result_submission",
    "pending_result_confirmation",
  ] as const);

function isViewerChallenge(
  challenge: ChallengeItem,
  viewerPlayerProfileId: null | string
) {
  return (
    challenge.challenger.playerProfileId === viewerPlayerProfileId ||
    challenge.challenged.playerProfileId === viewerPlayerProfileId
  );
}

export type ChallengeRouteTab =
  | "active"
  | "corrections"
  | "history"
  | "incoming"
  | "outgoing"
  | "pending";

export function buildChallengeRouteInitialTab(input: {
  canManage: boolean;
  pendingCount: number;
}): ChallengeRouteTab {
  if (input.canManage) {
    return input.pendingCount > 0 ? "pending" : "active";
  }

  return "active";
}

export function buildChallengeRouteVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  canManage: boolean;
  challenges: readonly ChallengeItem[];
  viewerPlayerProfileId: null | string;
}) {
  if (input.canManage) {
    switch (input.activeTab) {
      case "pending":
        return input.challenges.filter((challenge) =>
          ADMIN_PENDING_CHALLENGE_STATUSES.has(challenge.status)
        );
      case "active":
        return input.challenges.filter((challenge) =>
          ADMIN_ACTIVE_CHALLENGE_STATUSES.has(challenge.status)
        );
      case "corrections":
        return input.challenges.filter(
          (challenge) => challenge.status === "pending_result_correction"
        );
      case "history":
        return input.challenges.filter((challenge) =>
          CLOSED_CHALLENGE_STATUSES.has(challenge.status)
        );
      default:
        return input.challenges.filter((challenge) =>
          ADMIN_PENDING_CHALLENGE_STATUSES.has(challenge.status)
        );
    }
  }

  switch (input.activeTab) {
    case "outgoing":
      return input.challenges.filter(
        (challenge) =>
          challenge.challenger.playerProfileId === input.viewerPlayerProfileId
      );
    case "active":
      return input.challenges.filter(
        (challenge) =>
          isViewerChallenge(challenge, input.viewerPlayerProfileId) &&
          !CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    case "history":
      return input.challenges.filter(
        (challenge) =>
          isViewerChallenge(challenge, input.viewerPlayerProfileId) &&
          CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter(
        (challenge) =>
          challenge.challenged.playerProfileId === input.viewerPlayerProfileId
      );
  }
}

export function buildChallengeRouteEmptyState(input: {
  canManage: boolean;
  hasAnyChallenges: boolean;
}) {
  if (!input.hasAnyChallenges) {
    return {
      description: input.canManage
        ? "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui."
        : "Quando você abrir ou receber desafios, eles aparecerão aqui.",
      title: "Nenhum desafio encontrado",
    };
  }

  return {
    description: "Nenhum desafio corresponde ao filtro selecionado.",
    title: "Nada por aqui",
  };
}
