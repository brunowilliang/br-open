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

const ADMIN_CANCELABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
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

const ADMIN_INVALIDATABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "pending_admin_decision",
  "finished",
] as const);

const ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES: ReadonlySet<
  ChallengeItem["status"]
> = new Set([
  "confirmed",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_result_correction",
  "finished",
  "invalidated",
] as const);

type ChallengeAdminActionItem = {
  latestResultSubmission?: { id?: string | null } | null;
  status: ChallengeItem["status"];
};

export type ChallengeAdminMenuActionId =
  | "admin_cancel"
  | "admin_invalidate"
  | "approve_challenge"
  | "approve_result"
  | "reject_challenge"
  | "reopen_challenge"
  | "reopen_result"
  | "request_result_correction"
  | "submit_result";

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

export function buildChallengeAdminMenuActionIds(
  challenge: ChallengeAdminActionItem
): ChallengeAdminMenuActionId[] {
  const actionIds: ChallengeAdminMenuActionId[] = [];
  const dangerActionIds: ChallengeAdminMenuActionId[] = [];
  const hasResult = Boolean(challenge.latestResultSubmission);

  if (challenge.status === "pending_admin_challenge_validation") {
    actionIds.push("approve_challenge", "reject_challenge");
  }

  if (
    challenge.status === "pending_admin_result_validation" &&
    challenge.latestResultSubmission
  ) {
    actionIds.push("approve_result", "request_result_correction");
  }

  if (ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    actionIds.push("submit_result");
  }

  if (["declined", "cancelled"].includes(challenge.status)) {
    actionIds.push("reopen_challenge");
  }

  if (challenge.status === "invalidated") {
    actionIds.push(hasResult ? "reopen_result" : "reopen_challenge");
  }

  if (challenge.status === "finished") {
    actionIds.push("reopen_result");
  }

  if (ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("admin_invalidate");
  }

  if (ADMIN_CANCELABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("admin_cancel");
  }

  return [...actionIds, ...dangerActionIds];
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
