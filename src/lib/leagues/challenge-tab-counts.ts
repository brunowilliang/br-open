import {
  ORGANIZER_ATTENTION_CHALLENGE_STATUSES as ORGANIZER_ATTENTION_STATUSES,
  ORGANIZER_ONGOING_CHALLENGE_STATUSES as ORGANIZER_ONGOING_STATUSES,
  CLOSED_CHALLENGE_STATUSES as CLOSED_STATUSES,
} from "@convex/domains/league/challenge-status";

import {
  isChallengeAttention,
  isChallengeViewerParticipant,
  type ChallengeAttentionItem,
} from "./challenge-attention";

export { ORGANIZER_ATTENTION_STATUSES, ORGANIZER_ONGOING_STATUSES };

/**
 * ============================================================================
 * CHALLENGE TAB COUNTS
 * ============================================================================
 *
 * Contagens de badge para cada aba da tela de desafios. As contagens DEVEM
 * refletir exatamente o que cada aba mostra, para que o badge seja honesto: se
 * disser "3", há 3 desafios naquela aba.
 *
 * A regra de atenção do jogador NÃO mora mais aqui: ela é a mesma função que a
 * lista usa (`isChallengeAttention` em challenge-attention.ts), então badge e
 * aba saem da mesma fonte por construção (BUG-0043: antes o badge contava 3 e
 * a aba mostrava 6).
 *
 * Veja a tabela-verdade de status→aba em challenge-route-view.ts.
 * ============================================================================
 */

/**
 * Subset do ChallengeItem necessário para computar contagens. Mantém os
 * mesmos campos mínimos de `ChallengeAttentionItem` (a regra única).
 */
export type ChallengeTabCountItem = ChallengeAttentionItem;

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
      ORGANIZER_ATTENTION_STATUSES.has(challenge.status)
    ).length;
    const ongoing = input.challenges.filter((challenge) =>
      ORGANIZER_ONGOING_STATUSES.has(challenge.status)
    ).length;
    const history = input.challenges.filter((challenge) =>
      CLOSED_STATUSES.has(challenge.status)
    ).length;

    return { attention, history, main: attention, ongoing };
  }

  const attention = input.challenges.filter((challenge) =>
    isChallengeAttention(challenge, input.viewerPlayerProfileId)
  ).length;
  const ongoing = input.challenges.filter(
    (challenge) =>
      isChallengeViewerParticipant(challenge, input.viewerPlayerProfileId) &&
      !CLOSED_STATUSES.has(challenge.status) &&
      !isChallengeAttention(challenge, input.viewerPlayerProfileId)
  ).length;
  const history = input.challenges.filter(
    (challenge) =>
      isChallengeViewerParticipant(challenge, input.viewerPlayerProfileId) &&
      CLOSED_STATUSES.has(challenge.status)
  ).length;

  return { attention, history, main: attention, ongoing };
}
