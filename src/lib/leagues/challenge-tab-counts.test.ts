import { describe, expect, it } from "bun:test";

import {
  buildChallengeTabCounts,
  type ChallengeTabCountItem,
} from "./challenge-tab-counts";

const sampleChallenges: ChallengeTabCountItem[] = [
  // Viewer é o DESAFIADO: precisa responder → Atenção.
  {
    challenged: {
      membershipId: "membership-viewer",
      playerProfileId: "viewer",
    },
    challenger: {
      membershipId: "membership-other-a",
      playerProfileId: "other-a",
    },
    status: "pending_opponent_response",
  },
  // Viewer é participante, jogo confirmado (antes do dia) → Aguardando.
  {
    challenged: {
      membershipId: "membership-other-b",
      playerProfileId: "other-b",
    },
    challenger: {
      membershipId: "membership-viewer",
      playerProfileId: "viewer",
    },
    status: "confirmed",
  },
  // Viewer é participante, jogo finalizado → Histórico.
  {
    challenged: {
      membershipId: "membership-other-c",
      playerProfileId: "other-c",
    },
    challenger: {
      membershipId: "membership-viewer",
      playerProfileId: "viewer",
    },
    status: "finished",
  },
  // Não envolve o viewer; esperando validação do admin.
  {
    challenged: {
      membershipId: "membership-other-d",
      playerProfileId: "other-d",
    },
    challenger: {
      membershipId: "membership-other-e",
      playerProfileId: "other-e",
    },
    status: "pending_admin_result_validation",
  },
  // Não envolve o viewer; admin pediu correção de placar.
  {
    challenged: {
      membershipId: "membership-other-f",
      playerProfileId: "other-f",
    },
    challenger: {
      membershipId: "membership-other-g",
      playerProfileId: "other-g",
    },
    status: "pending_result_correction",
  },
  // Viewer pediu cancelamento; precisa da resposta do adversário → Aguardando.
  {
    cancellationRequestedByMembershipId: "membership-viewer",
    challenged: {
      membershipId: "membership-other-i",
      playerProfileId: "other-i",
    },
    challenger: {
      membershipId: "membership-viewer",
      playerProfileId: "viewer",
    },
    status: "pending_cancellation_acceptance",
  },
];

describe("buildChallengeTabCounts (participant)", () => {
  it("counts attention from challenges requiring viewer action", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // pending_opponent_response (viewer é desafiado) → 1 atenção.
    expect(result.attention).toBe(1);
    expect(result.main).toBe(1);
  });

  it("counts ongoing from viewer challenges not requiring action and not closed", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // confirmed (viewer espera o dia) + pending_cancellation_acceptance
    // (viewer pediu, espera resposta) → 2 aguardando.
    expect(result.ongoing).toBe(2);
  });

  it("counts history from closed viewer challenges", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // finished → 1 histórico.
    expect(result.history).toBe(1);
  });

  it("ignores challenges the viewer does not participate in", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerPlayerProfileId: "someone-else",
    });

    expect(result).toEqual({
      attention: 0,
      history: 0,
      main: 0,
      ongoing: 0,
    });
  });
});

describe("buildChallengeTabCounts (admin)", () => {
  it("counts attention from admin-gated statuses", () => {
    const result = buildChallengeTabCounts({
      canManage: true,
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // pending_admin_result_validation + pending_result_correction → 2 atenção.
    expect(result.attention).toBe(2);
    expect(result.main).toBe(2);
  });

  it("counts ongoing from operationally active statuses", () => {
    const result = buildChallengeTabCounts({
      canManage: true,
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // pending_opponent_response + confirmed + pending_cancellation_acceptance
    // → 3 em andamento.
    expect(result.ongoing).toBe(3);
  });

  it("counts history from closed statuses", () => {
    const result = buildChallengeTabCounts({
      canManage: true,
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
    });

    // finished → 1 histórico.
    expect(result.history).toBe(1);
  });
});
