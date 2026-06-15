import { describe, expect, it } from "bun:test";

import {
  buildChallengeTabCounts,
  type ChallengeTabCountItem,
} from "./challenge-tab-counts";

const sampleChallenges: ChallengeTabCountItem[] = [
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
  {
    cancellationRequestedByMembershipId: "membership-other-h",
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

describe("buildChallengeTabCounts", () => {
  it("builds player badge counts only from challenges that require viewer action", () => {
    const result = buildChallengeTabCounts({
      challenges: sampleChallenges,
      viewerPlayerProfileId: "viewer",
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
      viewerPlayerProfileId: "viewer",
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
