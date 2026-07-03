/**
 * Single source of truth for challenge status sets.
 *
 * Imported from:
 * - Backend: `convex/functions/league/challenges.ts` (action gating).
 * - Frontend: `src/lib/leagues/challenge-route-view.ts` (tab routing),
 *   `src/lib/leagues/challenge-tab-counts.ts` (badge counts).
 *
 * Why a shared module: the backend and frontend hand-mirrored these sets for
 * months, which produced concrete drift (frontend showed an admin action the
 * backend rejected). Centralizing + parity tests closes that hole at compile
 * time. See `convex/domains/league/tests/challenge-status-parity.test.ts`
 * and `src/lib/leagues/challenge-status-parity.test.ts`.
 *
 * This module is pure types/constants — no runtime Convex code, safe to
 * import from both `convex/` and `src/` (via `@convex/domains/league/*`).
 */

import type { LeagueChallengeStatusOptions } from "./contract";

export type LeagueChallengeStatus =
  (typeof LeagueChallengeStatusOptions)[number];

// ---------------------------------------------------------------------------
// Backend-validated action sets (who can act on which status).
// ---------------------------------------------------------------------------

export const CLOSED_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "finished",
    "declined",
    "cancelled",
    "invalidated",
  ]);

export const VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_opponent_response",
    "pending_creator_reapproval",
  ]);

/**
 * Admin cancel: any active challenge (10 statuses). Cancel is the universal
 * "stop this challenge" action and covers the pending-proposal phase too.
 */
export const ADMIN_CANCELABLE_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
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
  ]);

/**
 * Admin invalidate: reserved for matches that have been played (or
 * scheduled). Excludes pending-proposal statuses — cancel covers those.
 */
export const ADMIN_INVALIDATABLE_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "confirmed",
    "pending_cancellation_acceptance",
    "pending_result_submission",
    "pending_result_confirmation",
    "pending_admin_result_validation",
    "pending_result_correction",
    "pending_admin_decision",
    "finished",
  ]);

export const ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "confirmed",
    "pending_result_submission",
    "pending_result_confirmation",
    "pending_admin_result_validation",
    "pending_result_correction",
    "pending_admin_decision",
    "finished",
    "invalidated",
  ]);

export const ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_result_submission",
    "pending_result_confirmation",
    "pending_admin_decision",
  ]);

// ---------------------------------------------------------------------------
// Frontend-only tab routing sets (derived concepts; not used by backend).
//
// The admin "Atenção" / "Em andamento" tabs partition the active statuses
// by whether the organizer must act (attention) vs. only observe (ongoing).
// Together with CLOSED they form a disjoint cover over
// LeagueChallengeStatusOptions — asserted in the parity test.
// ---------------------------------------------------------------------------

export const ADMIN_ATTENTION_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_admin_challenge_validation",
    "pending_admin_result_validation",
    "pending_admin_decision",
    "pending_result_correction",
  ]);

export const ADMIN_ONGOING_CHALLENGE_STATUSES: ReadonlySet<LeagueChallengeStatus> =
  new Set<LeagueChallengeStatus>([
    "pending_opponent_response",
    "pending_creator_reapproval",
    "confirmed",
    "pending_cancellation_acceptance",
    "pending_result_submission",
    "pending_result_confirmation",
  ]);
