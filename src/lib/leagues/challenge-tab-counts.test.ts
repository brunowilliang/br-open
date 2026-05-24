import { describe, expect, it } from "bun:test";

import {
  buildChallengeTabCounts,
  type ChallengeTabCountItem,
} from "./challenge-tab-counts";

const sampleChallenges: ChallengeTabCountItem[] = [
  {
    challenged: { membershipId: "membership-viewer", userId: "viewer" },
    challenger: { membershipId: "membership-other-a", userId: "other-a" },
    status: "pending_opponent_response",
  },
  {
    challenged: { membershipId: "membership-other-b", userId: "other-b" },
    challenger: { membershipId: "membership-viewer", userId: "viewer" },
    status: "confirmed",
  },
  {
    challenged: { membershipId: "membership-other-c", userId: "other-c" },
    challenger: { membershipId: "membership-viewer", userId: "viewer" },
    status: "finished",
  },
  {
    challenged: { membershipId: "membership-other-d", userId: "other-d" },
    challenger: { membershipId: "membership-other-e", userId: "other-e" },
    status: "pending_admin_result_validation",
  },
  {
    challenged: { membershipId: "membership-other-f", userId: "other-f" },
    challenger: { membershipId: "membership-other-g", userId: "other-g" },
    status: "pending_result_correction",
  },
  {
    cancellationRequestedByMembershipId: "membership-other-h",
    challenged: { membershipId: "membership-other-i", userId: "other-i" },
    challenger: { membershipId: "membership-viewer", userId: "viewer" },
    status: "pending_cancellation_acceptance",
  },
];

describe("buildChallengeTabCounts", () => {
  it("builds player badge counts only from challenges that require viewer action", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerUserId: "viewer",
    });

    expect(result).toEqual({
      active: 3,
      corrections: 0,
      history: 0,
      incoming: 0,
      main: 3,
      outgoing: 0,
      pending: 0,
    });
  });

  it("builds admin badge counts only from challenges that require admin action", () => {
    const result = buildChallengeTabCounts({
      canManage: true,
      challenges: sampleChallenges,
      viewerUserId: "viewer",
    });

    expect(result).toEqual({
      active: 0,
      corrections: 0,
      history: 0,
      incoming: 0,
      main: 1,
      outgoing: 0,
      pending: 1,
    });
  });
});
