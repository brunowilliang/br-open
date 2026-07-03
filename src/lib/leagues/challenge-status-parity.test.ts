import { describe, expect, it } from "bun:test";

import { LeagueChallengeStatusOptions } from "@convex/domains/league/contract";

import {
  ADMIN_CANCELABLE_CHALLENGE_STATUSES,
  ADMIN_INVALIDATABLE_CHALLENGE_STATUSES,
  ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES,
  ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
} from "@convex/domains/league/challenge-status";

/**
 * Frontend parity with the backend challenge status sets.
 *
 * The backend sets live in `convex/functions/league/challenges.ts`. They are
 * exported there and re-asserted in
 * `convex/domains/league/tests/challenge-status-parity.test.ts`.
 *
 * The sets below are hand-mirrored: this test guards against drift between
 * the two sides. If a status moves between sets on the backend, this test
 * must be updated in lockstep — there is no compile-time link today.
 */

describe("frontend challenge status sets vs backend canonical enum", () => {
  it("every status in frontend sets is a valid LeagueChallengeStatus", () => {
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

    checkSet("CLOSED_CHALLENGE_STATUSES", CLOSED_CHALLENGE_STATUSES);
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

  it("CLOSED_CHALLENGE_STATUSES mirrors backend (4 terminal statuses)", () => {
    expect(CLOSED_CHALLENGE_STATUSES).toEqual(
      new Set(["finished", "declined", "cancelled", "invalidated"])
    );
  });

  it("ADMIN_CANCELABLE_CHALLENGE_STATUSES mirrors backend (10 statuses)", () => {
    // Backend ADMIN_CANCELABLE_STATUSES accepts all 10 active statuses.
    // Cancel is the universal "stop this challenge" admin action.
    expect(ADMIN_CANCELABLE_CHALLENGE_STATUSES).toEqual(
      new Set([
        "pending_opponent_response",
        "pending_creator_reapproval",
        "pending_admin_challenge_validation",
        "confirmed",
        "pending_cancellation_acceptance",
        "pending_result_submission",
        "pending_result_confirmation",
        "pending_admin_result_validation",
        "pending_result_correction",
        "pending_admin_decision",
      ])
    );
  });

  it("ADMIN_INVALIDATABLE_CHALLENGE_STATUSES mirrors backend (8 statuses — excludes pending-proposal)", () => {
    // Drift fixed: pending_opponent_response and pending_creator_reapproval
    // are NOT invalidatable on the backend (cancel covers those). This test
    // ensures the frontend stays in lockstep.
    expect(ADMIN_INVALIDATABLE_CHALLENGE_STATUSES).toEqual(
      new Set([
        "confirmed",
        "pending_cancellation_acceptance",
        "pending_result_submission",
        "pending_result_confirmation",
        "pending_admin_result_validation",
        "pending_result_correction",
        "pending_admin_decision",
        "finished",
      ])
    );
    expect(
      ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has("pending_opponent_response")
    ).toBe(false);
    expect(
      ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has("pending_creator_reapproval")
    ).toBe(false);
  });

  it("ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES mirrors backend (8 statuses)", () => {
    expect(ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES).toEqual(
      new Set([
        "confirmed",
        "pending_result_submission",
        "pending_result_confirmation",
        "pending_admin_result_validation",
        "pending_result_correction",
        "pending_admin_decision",
        "finished",
        "invalidated",
      ])
    );
  });

  it("ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES mirrors backend (3 statuses)", () => {
    expect(ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES).toEqual(
      new Set([
        "pending_result_submission",
        "pending_result_confirmation",
        "pending_admin_decision",
      ])
    );
  });
});
