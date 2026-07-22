/**
 * Payment charge business rules — pure functions only.
 *
 * These centralize the state-machine + validation + split-math logic that
 * used to live inline inside `functions/payment/charge.ts`. Each function
 * takes a small typed input object and returns a value or boolean, with no
 * side effects. This mirrors the pattern of
 * `convex/domains/league/membership-rules.ts`.
 *
 * Status reference: `PAYMENT_CHARGE_STATUSES` in `./contract.ts`
 * (`PENDING`, `PAID`, `EXPIRED`, `REFUNDED`, `FAILED`).
 */

import { LEAGUE_MEMBERSHIP_STATUSES } from "../league/contract";
import type { PaymentChargeStatus, SplitConfig } from "./contract";

/**
 * How long a PIX charge stays valid after creation, in seconds.
 * Used both when creating the charge (passed to Woovi as `expiresIn`) and
 * when computing the local `expiresAt` timestamp.
 */
export const CHARGE_EXPIRES_IN_SECONDS = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Status string constants — single source of truth, no magic strings in
// function files.
// ---------------------------------------------------------------------------

export const CHARGE_STATUS_PENDING =
  "PENDING" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_PAID = "PAID" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_EXPIRED =
  "EXPIRED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_REFUNDED =
  "REFUNDED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_FAILED =
  "FAILED" as const satisfies PaymentChargeStatus;

// ---------------------------------------------------------------------------
// Charge transition guards
// ---------------------------------------------------------------------------

type ChargeLike = { status: string };

/**
 * A charge can only be marked PAID when it is currently PENDING.
 * Refunded/expired/failed charges cannot be paid again.
 */
export function canChargeBePaid(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

/**
 * A charge can be marked EXPIRED only when it is still PENDING (avoid
 * expiring an already-PAID charge after the webhook lands late).
 */
export function canChargeBeExpired(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

/**
 * Refunds are allowed from PAID only (you can't refund a charge that was
 * never collected). We also accept EXPIRED defensively so a late refund
 * webhook for a charge we already expired locally still reconciles.
 */
export function canChargeBeRefunded(charge: ChargeLike): boolean {
  return (
    charge.status === CHARGE_STATUS_PAID ||
    charge.status === CHARGE_STATUS_EXPIRED
  );
}

// ---------------------------------------------------------------------------
// Membership charge precondition
// ---------------------------------------------------------------------------

type MembershipLike = { status: string };

const CHARGEABLE_MEMBERSHIP_STATUSES: ReadonlySet<string> = new Set([
  LEAGUE_MEMBERSHIP_STATUSES.AWAITING_PAYMENT,
  LEAGUE_MEMBERSHIP_STATUSES.PAYMENT_DUE,
  LEAGUE_MEMBERSHIP_STATUSES.SUSPENDED,
]);

/**
 * Whether a membership is in a state where a PIX charge can be created
 * or validated against it.
 *
 * Accepts `awaiting_payment` (initial charge), `payment_due` (grace period —
 * player is generating a new charge before the cycle lapses), and `suspended`
 * (player was suspended for non-payment and is re-paying to reactivate).
 */
export function canMembershipBeCharged(membership: MembershipLike): boolean {
  return CHARGEABLE_MEMBERSHIP_STATUSES.has(membership.status);
}

// ---------------------------------------------------------------------------
// Provider (Woovi) → domain status normalization
// ---------------------------------------------------------------------------

/**
 * Maps a provider charge status string onto our `PaymentChargeStatus` enum.
 *
 * Woovi statuses (from the 2026-07-02 PoC + developers.woovi.com):
 *   ACTIVE      — charge created, awaiting payment  → PENDING
 *   COMPLETED   — payment received                  → PAID
 *   EXPIRED     — charge expired unpaid             → EXPIRED
 *
 * Falls back to `PENDING` when the provider returns something we don't
 * recognize (defensive).
 */
export function normalizeProviderStatus(
  raw?: null | string
): PaymentChargeStatus {
  switch (raw) {
    case "ACTIVE":
      return CHARGE_STATUS_PENDING;
    case "COMPLETED":
      return CHARGE_STATUS_PAID;
    case "EXPIRED":
      return CHARGE_STATUS_EXPIRED;
    default:
      return CHARGE_STATUS_PENDING;
  }
}

// ---------------------------------------------------------------------------
// Split math
// ---------------------------------------------------------------------------

/**
 * Computes the split between organizer and BR-Open for a paid league charge.
 *
 * `feePercent` is the BR-Open platform cut (0-100); the organizer receives
 * the remainder. The organizer's share is rounded DOWN to the nearest cent
 * (BR-Open keeps any fractional remainder, which is at most R$0.0099 per
 * charge) so the split always sums exactly to `amountCents`.
 *
 * @example computeSplit(5000, 10) === {
 *   brOpenCents: 500,
 *   feePercent: 10,
 *   organizerCents: 4500,
 *   recipientPixKey: "<the org's woovi pix key>"
 * }
 */
export function computeSplit(args: {
  amountCents: number;
  feePercent: number;
  recipientPixKey: string;
}): SplitConfig {
  const brOpenCents = Math.round(args.amountCents * (args.feePercent / 100));
  return {
    brOpenCents,
    feePercent: args.feePercent,
    organizerCents: args.amountCents - brOpenCents,
    recipientPixKey: args.recipientPixKey,
  };
}

// ---------------------------------------------------------------------------
// Renewal timeline helpers (grace period + proactive reminders)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether the proactive renewal reminder should fire.
 *
 * True when `now` is within the `reminderDaysBefore` window before the due
 * date (i.e. due date is approaching but hasn't arrived yet).
 */
export function shouldSendRenewalReminder(args: {
  nextDueMs: number;
  nowMs: number;
  reminderDaysBefore: number;
}): boolean {
  const msUntilDue = args.nextDueMs - args.nowMs;
  return msUntilDue > 0 && msUntilDue <= args.reminderDaysBefore * MS_PER_DAY;
}

/**
 * Whether the billing due date has passed (the membership should enter
 * `payment_due` if it's still `active`).
 */
export function shouldMarkPaymentDue(args: {
  nextDueMs: number;
  nowMs: number;
}): boolean {
  return args.nextDueMs <= args.nowMs;
}

/**
 * Whether the grace period has elapsed (the membership should be suspended).
 *
 * True when `now` is past `nextDueMs + gracePeriodDays`.
 */
export function shouldSuspend(args: {
  nextDueMs: number;
  nowMs: number;
  gracePeriodDays: number;
}): boolean {
  const suspensionMs = args.nextDueMs + args.gracePeriodDays * MS_PER_DAY;
  return args.nowMs >= suspensionMs;
}
