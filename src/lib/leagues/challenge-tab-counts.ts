import type { ApiOutputs } from "@convex/shared/api";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

/**
 * ============================================================================
 * CHALLENGE TAB COUNTS
 * ============================================================================
 *
 * Contagens de badge para cada aba da tela de desafios. As contagens DEVEM
 * refletir exatamente o que cada aba mostra (reaproveitando a mesma lógica de
 * challenge-route-view.ts), para que o badge seja honesto: se disser "3", há
 * 3 desafios naquela aba.
 *
 * Antes, todas as abas exceto a principal retornavam 0 (mentindo), dando a
 * impressão de abas vazias quando não estavam. Agora cada aba tem contagem
 * real.
 *
 * Veja a tabela-verdade de status→aba em challenge-route-view.ts.
 * ============================================================================
 */

/**
 * Subset do ChallengeItem necessário para computar contagens. Manter mínimo
 * evita restringir os tipos nos callers e facilita testes.
 */
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
  status: ChallengeItem["status"];
};

const CLOSED_STATUSES = new Set<ChallengeTabCountItem["status"]>([
  "cancelled",
  "declined",
  "finished",
  "invalidated",
]);

export const ADMIN_ATTENTION_STATUSES = new Set<
  ChallengeTabCountItem["status"]
>([
  "pending_admin_challenge_validation",
  "pending_admin_result_validation",
  "pending_admin_decision",
  "pending_result_correction",
]);

export const ADMIN_ONGOING_STATUSES = new Set<ChallengeTabCountItem["status"]>([
  "pending_opponent_response",
  "pending_creator_reapproval",
  "confirmed",
  "pending_cancellation_acceptance",
  "pending_result_submission",
  "pending_result_confirmation",
]);

function isViewerParticipant(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
  return (
    challenge.challenger.playerProfileId === viewerPlayerProfileId ||
    challenge.challenged.playerProfileId === viewerPlayerProfileId
  );
}

/**
 * Determina se um desafio requer a AÇÃO IMEDIATA do participante (viewer).
 * Espelha isParticipantAttentionChallenge de challenge-route-view.ts.
 * Se alterar um, altere o outro.
 */
function isParticipantAttention(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
  if (!isViewerParticipant(challenge, viewerPlayerProfileId)) {
    return false;
  }

  switch (challenge.status) {
    case "pending_opponent_response":
      return challenge.challenged.playerProfileId === viewerPlayerProfileId;
    case "pending_creator_reapproval":
      return challenge.challenger.playerProfileId === viewerPlayerProfileId;
    case "pending_cancellation_acceptance":
      return isCancellationResponder(challenge, viewerPlayerProfileId);
    case "pending_result_submission":
    case "pending_result_correction":
      // Jogo acabou/corrigindo — qualquer participante pode agir.
      return true;
    case "pending_result_confirmation":
      // Quem NÃO publicou precisa confirmar.
      return isResultConfirmer(challenge, viewerPlayerProfileId);
    default:
      return false;
  }
}

function isCancellationResponder(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
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

function isResultConfirmer(
  challenge: ChallengeTabCountItem,
  viewerPlayerProfileId?: string | null
) {
  const submittedBy = challenge.latestResultSubmission?.submittedByMembershipId;

  if (!submittedBy) {
    return false;
  }

  let viewerMembershipId: string | null = null;

  if (challenge.challenger.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenger.membershipId ?? null;
  } else if (challenge.challenged.playerProfileId === viewerPlayerProfileId) {
    viewerMembershipId = challenge.challenged.membershipId ?? null;
  }

  return Boolean(viewerMembershipId && viewerMembershipId !== submittedBy);
}

export type ChallengeTabCounts = {
  /** Alias para a aba principal do role (attention). Usado pelo badge do header. */
  attention: number;
  history: number;
  /** Contagem da aba que demanda ação imediata — exibida no badge do header. */
  main: number;
  ongoing: number;
};

/**
 * Computa as contagens de badge de cada aba.
 *
 * `main` é o alias para a aba "Atenção" (a mais prioritária), usado por
 * badges de header/notificação fora da tela de desafios.
 */
export function buildChallengeTabCounts(input: {
  canManage?: boolean;
  challenges: ChallengeTabCountItem[];
  viewerPlayerProfileId?: string | null;
}): ChallengeTabCounts {
  if (input.canManage) {
    const attention = input.challenges.filter((challenge) =>
      ADMIN_ATTENTION_STATUSES.has(challenge.status)
    ).length;
    const ongoing = input.challenges.filter((challenge) =>
      ADMIN_ONGOING_STATUSES.has(challenge.status)
    ).length;
    const history = input.challenges.filter((challenge) =>
      CLOSED_STATUSES.has(challenge.status)
    ).length;

    return { attention, history, main: attention, ongoing };
  }

  const attention = input.challenges.filter((challenge) =>
    isParticipantAttention(challenge, input.viewerPlayerProfileId)
  ).length;
  const ongoing = input.challenges.filter(
    (challenge) =>
      isViewerParticipant(challenge, input.viewerPlayerProfileId) &&
      !CLOSED_STATUSES.has(challenge.status) &&
      !isParticipantAttention(challenge, input.viewerPlayerProfileId)
  ).length;
  const history = input.challenges.filter(
    (challenge) =>
      isViewerParticipant(challenge, input.viewerPlayerProfileId) &&
      CLOSED_STATUSES.has(challenge.status)
  ).length;

  return { attention, history, main: attention, ongoing };
}
