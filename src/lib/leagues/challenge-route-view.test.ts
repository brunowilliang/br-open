import { describe, expect, it } from "bun:test";

import {
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "./challenge-route-view";

const sampleChallenges = [
  {
    challenged: { membershipId: "challenged-a", playerProfileId: "viewer" },
    challenger: { membershipId: "challenger-a", playerProfileId: "other-a" },
    id: "challenge-a",
    status: "pending_opponent_response",
  },
  {
    challenged: { membershipId: "challenged-b", playerProfileId: "other-b" },
    challenger: { membershipId: "challenger-b", playerProfileId: "viewer" },
    id: "challenge-b",
    status: "confirmed",
  },
  {
    challenged: { membershipId: "challenged-c", playerProfileId: "other-c" },
    challenger: { membershipId: "challenger-c", playerProfileId: "other-d" },
    id: "challenge-c",
    status: "pending_admin_result_validation",
  },
  {
    challenged: { membershipId: "challenged-d", playerProfileId: "other-e" },
    challenger: { membershipId: "challenger-d", playerProfileId: "other-f" },
    id: "challenge-d",
    status: "finished",
  },
  {
    challenged: { membershipId: "challenged-e", playerProfileId: "other-g" },
    challenger: { membershipId: "challenger-e", playerProfileId: "other-h" },
    id: "challenge-e",
    status: "confirmed",
  },
] as const;

describe("buildChallengeRouteInitialTab", () => {
  it("starts owners on the pending tab only when a pending bucket exists", () => {
    expect(
      buildChallengeRouteInitialTab({ canManage: true, pendingCount: 1 })
    ).toBe("pending");
    expect(
      buildChallengeRouteInitialTab({ canManage: true, pendingCount: 0 })
    ).toBe("active");
  });

  it("starts participants on the active tab", () => {
    expect(
      buildChallengeRouteInitialTab({ canManage: false, pendingCount: 0 })
    ).toBe("active");
  });
});

describe("buildChallengeRouteVisibleChallenges", () => {
  it("shows only admin-pending challenges on the pending tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "pending",
      canManage: true,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-c"]);
  });

  it("shows only viewer incoming challenges on the incoming tab", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "incoming",
      canManage: false,
      challenges: sampleChallenges as any,
      viewerPlayerProfileId: "viewer",
    });

    expect(visible.map((item) => item.id)).toEqual(["challenge-a"]);
  });

  it("keeps the admin active tab limited to operationally active statuses", () => {
    const visible = buildChallengeRouteVisibleChallenges({
      activeTab: "active",
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
});
