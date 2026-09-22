import type { ApiOutputs } from "@convex/shared/api";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

// Fonte ÚNICA da atenção: a lista (challenge-route-view.ts) e o badge
// (challenge-tab-counts.ts) chamam isChallengeAttention, então a aba "Atenção"
// e o alerta saem do MESMO dado por construção.

export type ChallengeAttentionItem = {
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

/**
 * O viewer participa do desafio (como desafiante ou como desafiado).
 * Não é jogador do desafio? Nunca é atenção (nem aparece para o jogador).
 */
export function isChallengeViewerParticipant(
  challenge: ChallengeAttentionItem,
  viewerPlayerProfileId: null | string | undefined
) {
  return (
    challenge.challenger.playerProfileId === viewerPlayerProfileId ||
    challenge.challenged.playerProfileId === viewerPlayerProfileId
  );
}

/**
 * Ação IMEDIATA do viewer: combina status + papel, pois o mesmo status pode
 * exigir ação de um lado e não do outro (ex.: pending_result_confirmation).
 */
export function isChallengeAttention(
  challenge: ChallengeAttentionItem,
  viewerPlayerProfileId: null | string | undefined
) {
  if (!isChallengeViewerParticipant(challenge, viewerPlayerProfileId)) {
    return false;
  }

  switch (challenge.status) {
    case "pending_opponent_response":
      // O desafiado precisa responder à proposta.
      return challenge.challenged.playerProfileId === viewerPlayerProfileId;
    case "pending_creator_reapproval":
      // O desafiante precisa reaprovar a contraproposta.
      return challenge.challenger.playerProfileId === viewerPlayerProfileId;
    case "pending_cancellation_acceptance":
      // O lado que NÃO pediu o cancelamento precisa responder.
      return isViewerCancellationResponder(challenge, viewerPlayerProfileId);
    case "pending_result_submission":
      // Jogo acabou, ninguém lançou — qualquer lado pode lançar.
      return true;
    case "pending_result_confirmation":
      // Quem NÃO publicou o placar precisa confirmar o do adversário.
      return isViewerResultConfirmer(challenge, viewerPlayerProfileId);
    case "pending_result_correction":
      // O admin pediu correção; o jogador que lançou precisa corrigir.
      return true;
    default:
      // Status de organizador (validação/decisão), confirmed, e fechados não
      // requerem ação do jogador.
      return false;
  }
}

function isViewerCancellationResponder(
  challenge: ChallengeAttentionItem,
  viewerPlayerProfileId: null | string | undefined
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

function isViewerResultConfirmer(
  challenge: ChallengeAttentionItem,
  viewerPlayerProfileId: null | string | undefined
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
