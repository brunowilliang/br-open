import { describe, expect, it } from "bun:test";

import { LeagueChallengeStatusOptions } from "../contract";
import {
  ADMIN_CANCELABLE_STATUSES,
  ADMIN_INVALIDATABLE_STATUSES,
  ADMIN_RESULT_REMINDER_STATUSES,
  ADMIN_SCORE_EDITABLE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
  VIEWER_PROPOSAL_RESPONSE_STATUSES,
} from "../../../functions/league/challenges";

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

  it("VIEWER_PROPOSAL_RESPONSE_STATUSES contains the two pending-proposal statuses", () => {
    expect(VIEWER_PROPOSAL_RESPONSE_STATUSES).toEqual(
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

    checkSet("ADMIN_CANCELABLE_STATUSES", ADMIN_CANCELABLE_STATUSES);
    checkSet("ADMIN_INVALIDATABLE_STATUSES", ADMIN_INVALIDATABLE_STATUSES);
    checkSet("ADMIN_SCORE_EDITABLE_STATUSES", ADMIN_SCORE_EDITABLE_STATUSES);
    checkSet("ADMIN_RESULT_REMINDER_STATUSES", ADMIN_RESULT_REMINDER_STATUSES);
  });

  it("ADMIN_RESULT_REMINDER_STATUSES is a subset of ADMIN_SCORE_EDITABLE_STATUSES", () => {
    // A reminder only makes sense where the admin could also edit the score.
    for (const status of ADMIN_RESULT_REMINDER_STATUSES) {
      expect(ADMIN_SCORE_EDITABLE_STATUSES.has(status)).toBe(true);
    }
  });

  it("ADMIN_INVALIDATABLE_STATUSES excludes pending-proposal statuses (cancel covers those)", () => {
    // Semantic invariant confirmed with product: invalidar is reserved for
    // matches that have been played (or scheduled); cancelar covers the
    // pending-proposal phase. Frontend mirrors this in
    // ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.
    expect(ADMIN_INVALIDATABLE_STATUSES.has("pending_opponent_response")).toBe(
      false
    );
    expect(ADMIN_INVALIDATABLE_STATUSES.has("pending_creator_reapproval")).toBe(
      false
    );
  });
});
