import type { ApiOutputs } from "@convex/shared/api";
import {
  ORGANIZER_ATTENTION_CHALLENGE_STATUSES,
  ADMIN_CANCELABLE_CHALLENGE_STATUSES,
  ADMIN_INVALIDATABLE_CHALLENGE_STATUSES,
  ORGANIZER_ONGOING_CHALLENGE_STATUSES,
  ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES,
  ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
} from "@convex/domains/league/challenge-status";

import {
  isChallengeAttention,
  isChallengeViewerParticipant,
} from "./challenge-attention";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

// Fonte da verdade de aba e de ação do organizador: cada status cai em UMA
// aba só. Ação visível exige guard no backend (`ADMIN_*_STATUSES`), e o status
// usado aqui é o derivado (computeEffectiveChallengeStatus), o mesmo que o
// backend valida.

type ChallengeOrganizerActionItem = {
  latestResultSubmission?: { id?: string | null } | null;
  status: ChallengeItem["status"];
};

export type ChallengeOrganizerMenuActionId =
  | "organizer_cancel"
  | "organizer_invalidate"
  | "approve_challenge"
  | "approve_result"
  | "reject_challenge"
  | "reopen_challenge"
  | "reopen_result"
  | "request_result_correction"
  | "request_result_reminder"
  | "submit_result";

// Abas unificadas entre admin e jogador; as abas são orientadas a AÇÃO
// (o admin vê as mesmas três, com "Em andamento" no lugar de "Aguardando").
export type ChallengeRouteTab = "active" | "attention" | "history" | "ongoing";

// Admin abre em "Atenção" quando há pendência, senão em "Em andamento";
// o jogador abre sempre em "Atenção" (o que ele precisa fazer agora).
export function buildChallengeRouteInitialTab(input: {
  canManage: boolean;
  pendingCount: number;
}): ChallengeRouteTab {
  if (input.canManage) {
    return input.pendingCount > 0 ? "attention" : "ongoing";
  }

  return "attention";
}

export function buildChallengeRouteVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  canManage: boolean;
  challenges: readonly ChallengeItem[];
  viewerPlayerProfileId: null | string;
}) {
  if (input.canManage) {
    return buildOrganizerVisibleChallenges(input);
  }

  return buildPlayerVisibleChallenges(input);
}

function buildOrganizerVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  challenges: readonly ChallengeItem[];
}) {
  switch (input.activeTab) {
    case "attention":
      return input.challenges.filter((challenge) =>
        ORGANIZER_ATTENTION_CHALLENGE_STATUSES.has(challenge.status)
      );
    case "ongoing":
      return input.challenges.filter((challenge) =>
        ORGANIZER_ONGOING_CHALLENGE_STATUSES.has(challenge.status)
      );
    case "history":
      return input.challenges.filter((challenge) =>
        CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter((challenge) =>
        ORGANIZER_ATTENTION_CHALLENGE_STATUSES.has(challenge.status)
      );
  }
}

function buildPlayerVisibleChallenges(input: {
  activeTab: ChallengeRouteTab | string;
  challenges: readonly ChallengeItem[];
  viewerPlayerProfileId: null | string;
}) {
  switch (input.activeTab) {
    case "attention":
      return input.challenges.filter((challenge) =>
        isChallengeAttention(challenge, input.viewerPlayerProfileId)
      );
    case "ongoing":
      // Desafios do viewer que estão vivos mas NÃO precisam da ação dele:
      // ele está esperando (o outro responder, o admin validar, o dia chegar).
      return input.challenges.filter(
        (challenge) =>
          isChallengeViewerParticipant(
            challenge,
            input.viewerPlayerProfileId
          ) &&
          !CLOSED_CHALLENGE_STATUSES.has(challenge.status) &&
          !isChallengeAttention(challenge, input.viewerPlayerProfileId)
      );
    case "history":
      return input.challenges.filter(
        (challenge) =>
          isChallengeViewerParticipant(
            challenge,
            input.viewerPlayerProfileId
          ) && CLOSED_CHALLENGE_STATUSES.has(challenge.status)
      );
    default:
      return input.challenges.filter((challenge) =>
        isChallengeAttention(challenge, input.viewerPlayerProfileId)
      );
  }
}

// As ações de perigo (invalidar/cancelar) ficam SEMPRE ao final da lista.
export function buildChallengeOrganizerMenuActionIds(
  challenge: ChallengeOrganizerActionItem
): ChallengeOrganizerMenuActionId[] {
  const actionIds: ChallengeOrganizerMenuActionId[] = [];
  const dangerActionIds: ChallengeOrganizerMenuActionId[] = [];
  const hasResult = Boolean(challenge.latestResultSubmission);

  // --- Ações específicas de validação (admin gate) ---

  if (challenge.status === "pending_organizer_challenge_validation") {
    actionIds.push("approve_challenge", "reject_challenge");
  }

  if (
    challenge.status === "pending_organizer_result_validation" &&
    challenge.latestResultSubmission
  ) {
    actionIds.push("approve_result", "request_result_correction");
  }

  // --- Ações de placar ---

  // Inclui pending_organizer_decision e pending_result_correction.
  if (ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    actionIds.push("submit_result");
  }

  // Admin pode cutucar os jogadores pra registrar o placar quando o jogo
  // ocorreu (ou passou do horário) sem placar.
  if (ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES.has(challenge.status)) {
    actionIds.push("request_result_reminder");
  }

  // --- Reaberturas (status fechados) ---

  if (["declined", "cancelled"].includes(challenge.status)) {
    actionIds.push("reopen_challenge");
  }

  if (challenge.status === "invalidated") {
    actionIds.push(hasResult ? "reopen_result" : "reopen_challenge");
  }

  if (challenge.status === "finished") {
    actionIds.push("reopen_result");
  }

  // --- Ações de perigo (sempre ao final) ---

  if (ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("organizer_invalidate");
  }

  if (ADMIN_CANCELABLE_CHALLENGE_STATUSES.has(challenge.status)) {
    dangerActionIds.push("organizer_cancel");
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
