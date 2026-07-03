import { describe, expect, it } from "bun:test";

import {
  LEAGUE_MEMBERSHIP_STATUSES,
  LeagueChallengeStatusOptions,
  LeagueMembershipStatusOptions,
} from "../contract";
import {
  ADMIN_ATTENTION_CHALLENGE_STATUSES,
  ADMIN_CANCELABLE_CHALLENGE_STATUSES,
  ADMIN_INVALIDATABLE_CHALLENGE_STATUSES,
  ADMIN_ONGOING_CHALLENGE_STATUSES,
  ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES,
  ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
  VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES,
} from "../challenge-status";

/**
 * Status-set invariants for the backend challenge state machine.
 *
 * These guards exist to catch drift between:
 * - The canonical `LeagueChallengeStatusOptions` enum (contract.ts).
 * - The ad-hoc `Set<LeagueChallengeStatus>` constants used by the challenge
 *   mutations (challenges.ts).
 *
 * Frontend parity (challenge-route-view.ts vs these backend sets) is asserted
 * separately in `src/lib/leagues/challenge-status-parity.test.ts`.
 */

describe("backend challenge status sets", () => {
  it("CLOSED_CHALLENGE_STATUSES contains exactly the terminal statuses", () => {
    expect(CLOSED_CHALLENGE_STATUSES).toEqual(
      new Set(["finished", "declined", "cancelled", "invalidated"])
    );
  });

  it("VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES contains the two pending-proposal statuses", () => {
    expect(VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES).toEqual(
      new Set(["pending_opponent_response", "pending_creator_reapproval"])
    );
  });

  it("every status in ADMIN_* sets is a valid LeagueChallengeStatus", () => {
    const valid = new Set<string>(LeagueChallengeStatusOptions);
    const checkSet = (label: string, set: ReadonlySet<string>) => {
      for (const status of set) {
        if (!valid.has(status)) {
          throw new Error(
            `${label} contains unknown status: ${status}. ` +
              "Add it to LeagueChallengeStatusOptions or fix the set."
          );
        }
      }
    };

    checkSet(
      "ADMIN_CANCELABLE_CHALLENGE_STATUSES",
      ADMIN_CANCELABLE_CHALLENGE_STATUSES
    );
    checkSet(
      "ADMIN_INVALIDATABLE_CHALLENGE_STATUSES",
      ADMIN_INVALIDATABLE_CHALLENGE_STATUSES
    );
    checkSet(
      "ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES",
      ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES
    );
    checkSet(
      "ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES",
      ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES
    );
  });

  it("ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES is a subset of ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES", () => {
    // A reminder only makes sense where the admin could also edit the score.
    for (const status of ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES) {
      expect(ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(status)).toBe(true);
    }
  });

  it("ADMIN_INVALIDATABLE_CHALLENGE_STATUSES excludes pending-proposal statuses (cancel covers those)", () => {
    // Semantic invariant confirmed with product: invalidar is reserved for
    // matches that have been played (or scheduled); cancelar covers the
    // pending-proposal phase. Frontend mirrors this in
    // ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.
    expect(
      ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has("pending_opponent_response")
    ).toBe(false);
    expect(
      ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has("pending_creator_reapproval")
    ).toBe(false);
  });

  it("CLOSED + ADMIN_ATTENTION + ADMIN_ONGOING form a disjoint cover of all statuses", () => {
    // Every LeagueChallengeStatus must be in exactly one of these three sets.
    // (Drives the frontend admin tab partition — see challenge-status.ts.)
    const valid = new Set<string>(LeagueChallengeStatusOptions);
    const seen = new Map<string, string[]>();

    const recordBucket = (status: string, bucket: string) => {
      const arr = seen.get(status) ?? [];
      arr.push(bucket);
      seen.set(status, arr);
    };

    for (const status of CLOSED_CHALLENGE_STATUSES) {
      recordBucket(status, "CLOSED");
    }
    for (const status of ADMIN_ATTENTION_CHALLENGE_STATUSES) {
      recordBucket(status, "ADMIN_ATTENTION");
    }
    for (const status of ADMIN_ONGOING_CHALLENGE_STATUSES) {
      recordBucket(status, "ADMIN_ONGOING");
    }

    // 1. Every canonical status is covered.
    for (const status of valid) {
      const buckets = seen.get(status);
      if (!buckets || buckets.length === 0) {
        throw new Error(`Status ${status} not covered by any tab set.`);
      }
      // 2. Disjoint: appears in exactly one bucket.
      if (buckets.length > 1) {
        throw new Error(
          `Status ${status} appears in multiple buckets: ${buckets.join(", ")}`
        );
      }
    }

    // 3. No status in any set is outside the canonical enum.
    for (const [status] of seen) {
      if (!valid.has(status)) {
        throw new Error(`Unknown status ${status} in tab set.`);
      }
    }
  });
});

describe("LEAGUE_MEMBERSHIP_STATUSES", () => {
  it("every value is a valid LeagueMembershipStatus", () => {
    const valid = new Set<string>(LeagueMembershipStatusOptions);
    for (const value of Object.values(LEAGUE_MEMBERSHIP_STATUSES)) {
      if (!valid.has(value)) {
        throw new Error(
          `LEAGUE_MEMBERSHIP_STATUSES contains unknown value: ${value}`
        );
      }
    }
  });

  it("covers every LeagueMembershipStatusOptions entry", () => {
    const constants = new Set(Object.values(LEAGUE_MEMBERSHIP_STATUSES));
    for (const status of LeagueMembershipStatusOptions) {
      if (!constants.has(status)) {
        throw new Error(
          `LeagueMembershipStatusOptions.${status} has no corresponding LEAGUE_MEMBERSHIP_STATUSES entry`
        );
      }
    }
  });
});
