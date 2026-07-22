import { describe, expect, it } from "bun:test";

import {
  buildChallengeOrganizerMenuActionIds,
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "./challenge-route-view";

type SampleChallenge = {
  cancellationRequestedByMembershipId?: string | null;
  challenged: { membershipId: string; playerProfileId: string };
  challenger: { membershipId: string; playerProfileId: string };
  id: string;
  latestResultSubmission?: {
    id?: string | null;
    submittedByMembershipId?: string | null;
  } | null;
  status: string;
};

const sampleChallenges: SampleChallenge[] = [
  // Viewer é o DESAFIADO: precisa responder.
  {
    challenged: { membershipId: "challenged-a", playerProfileId: "viewer" },
    challenger: { membershipId: "challenger-a", playerProfileId: "other-a" },
    id: "challenge-a",
    status: "pending_opponent_response",
  },
  // Viewer participa; jogo confirmado (esperando o dia).
  {
    challenged: { membershipId: "challenged-b", playerProfileId: "other-b" },
    challenger: { membershipId: "challenger-b", playerProfileId: "viewer" },
    id: "challenge-b",
    status: "confirmed",
  },
  // Não envolve viewer; esperando validação do organizador.
  {
    challenged: { membershipId: "challenged-c", playerProfileId: "other-c" },
    challenger: { membershipId: "challenger-c", playerProfileId: "other-d" },
    id: "challenge-c",
    status: "pending_organizer_result_validation",
  },
  // Não envolve viewer; finalizado.
  {
    challenged: { membershipId: "challenged-d", playerProfileId: "other-e" },
    challenger: { membershipId: "challenger-d", playerProfileId: "other-f" },
    id: "challenge-d",
    status: "finished",
  },
  // Viewer participa; jogo confirmado.
  {
    challenged: { membershipId: "challenged-e", playerProfileId: "other-g" },
    challenger: { membershipId: "challenger-e", playerProfileId: "viewer" },
    id: "challenge-e",
    status: "confirmed",
  },
];

describe("buildChallengeRouteInitialTab", () => {
  it("starts owners on the attention tab when there are pending items", () => {
    expect(
      buildChallengeRouteInitialTab({ canManage: true, pendingCount: 1 })
    ).toBe("attention");
  });

  it("starts owners on the ongoing tab when nothing needs attention", () => {
    expect(
      buildChallengeRouteInitialTab({ canManage: true, pendingCount: 0 })
    ).toBe("ongoing");
  });

  it("starts participants on the attention tab", () => {
    expect(
      buildChallengeRouteInitialTab({ canManage: false, pendingCount: 0 })
    ).toBe("attention");
  });
});

describe("buildChallengeRouteVisibleChallenges (organizer)", () => {
  it("shows only admin-attention challenges on the attention tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "attention",
      canManage: true,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-c"]);
  });

  it("shows only operationally active challenges on the ongoing tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "ongoing",
      canManage: true,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual([
      "challenge-a",
      "challenge-b",
      "challenge-e",
    ]);
  });

  it("shows only closed challenges on the history tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "history",
      canManage: true,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-d"]);
  });
});

describe("buildChallengeRouteVisibleChallenges (participant)", () => {
  it("shows only viewer challenges requiring action on the attention tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "attention",
      canManage: false,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    // pending_opponent_response onde viewer é desafiado → 1.
    expect(visible.map((item) => item.id)).toEqual(["challenge-a"]);
  });

  it("shows viewer non-closed, non-attention challenges on the ongoing tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "ongoing",
      canManage: false,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    // confirmed (challenge-b, challenge-e) → aguardando o dia.
    expect(visible.map((item) => item.id)).toEqual([
      "challenge-b",
      "challenge-e",
    ]);
  });

  it("shows closed viewer challenges on the history tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "history",
      canManage: false,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual([]);
  });
});

describe("buildChallengeOrganizerMenuActionIds", () => {
  it("lets managers launch a score for challenges waiting on a score", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: null,
        status: "pending_result_submission",
      })
    ).toContain("submit_result");
  });

  it("lets managers launch a score when players never submitted (admin decision)", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: null,
        status: "pending_organizer_decision",
      })
    ).toContain("submit_result");
  });

  it("lets managers nudge players to submit the score on admin decision", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: null,
        status: "pending_organizer_decision",
      })
    ).toContain("request_result_reminder");
  });

  it("lets managers edit score and reopen result for finished challenges", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: { id: "result-1" },
        status: "finished",
      })
    ).toEqual(["submit_result", "reopen_result", "organizer_invalidate"]);
  });

  it("keeps response-only challenges limited to cancellation (not invalidation)", () => {
    // pending_opponent_response is NOT invalidatable on the backend — cancel
    // is the only admin stop action for the proposal phase. Mirrors
    // ADMIN_INVALIDATABLE_STATUSES (excludes pending-proposal statuses).
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: null,
        status: "pending_opponent_response",
      })
    ).toEqual(["organizer_cancel"]);
  });

  it("keeps cancel as the last danger action when invalidate is also available", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: null,
        status: "confirmed",
      }).slice(-2)
    ).toEqual(["organizer_invalidate", "organizer_cancel"]);
  });

  it("keeps pending_result_correction in the attention bucket with score edit", () => {
    expect(
      buildChallengeOrganizerMenuActionIds({
        latestResultSubmission: { id: "result-2" },
        status: "pending_result_correction",
      })
    ).toContain("submit_result");
  });
});

describe("buildChallengeRouteEmptyState", () => {
  it("uses the owner-specific empty state when there are no challenges", () => {
    expect(
      buildChallengeRouteEmptyState({
        canManage: true,
        hasAnyChallenges: false,
      })
    ).toEqual({
      description:
        "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui.",
      title: "Nenhum desafio encontrado",
    });
  });

  it("uses a filter empty state when challenges exist but none match the tab", () => {
    expect(
      buildChallengeRouteEmptyState({
        canManage: false,
        hasAnyChallenges: true,
      })
    ).toEqual({
      description: "Nenhum desafio corresponde ao filtro selecionado.",
      title: "Nada por aqui",
    });
  });
});
