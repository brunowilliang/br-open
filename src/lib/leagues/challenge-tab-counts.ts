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

// Contagens de badge que DEVEM bater com o que cada aba mostra. A atenção do
// jogador sai de `isChallengeAttention` (mesma fonte da lista), nunca de cópia
// local — é o que mantém o badge honesto.
export type ChallengeTabCountItem = ChallengeAttentionItem;

export type ChallengeTabCounts = {
  attention: number;
  history: number;
  /** Alias de `attention` — o badge do header, usado fora da tela de desafios. */
  main: number;
  ongoing: number;
};

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
