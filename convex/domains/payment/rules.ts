/**
 * Payment charge business rules — pure functions only.
 *
 * These centralize the state-machine + validation logic that used to live
 * inline inside `functions/payment/charge.ts`. Each function takes a small
 * typed input object and returns a value or boolean, with no side effects.
 * This mirrors the pattern of `convex/domains/league/membership-rules.ts`.
 *
 * Status reference: `PAYMENT_CHARGE_STATUSES` in `./contract.ts`
 * (`PENDING`, `PAID`, `EXPIRED`, `REFUNDED`, `FAILED`).
 */

import type { PaymentChargeStatus } from "./contract";

/**
 * How long a PIX charge stays valid after creation, in seconds.
 * Used both when creating the charge (passed to AbacatePay as `expiresIn`)
 * and when computing the local `expiresAt` timestamp.
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

/**
 * The membership status that means "this player needs to pay before being
 * activated". Lives here (not in `league/contract.ts`) because it is the
 * payment domain's precondition for creating a charge.
 */
export const MEMBERSHIP_STATUS_AWAITING_PAYMENT = "awaiting_payment" as const;

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

/**
 * Whether a membership is in the state where a PIX charge can be created
 * or validated against it.
 */
export function canMembershipBeCharged(membership: MembershipLike): boolean {
  return membership.status === MEMBERSHIP_STATUS_AWAITING_PAYMENT;
}

// ---------------------------------------------------------------------------
// Provider → domain status normalization
// ---------------------------------------------------------------------------

/**
 * Maps an AbacatePay status string (from `APIQRCodePIX.status`) onto our
 * `PaymentChargeStatus` enum. Falls back to `PENDING` when the provider
 * returns something we don't recognize (defensive — the provider has
 * shipped undocumented statuses before).
 *
 * The inverse is not needed: we never send status to the provider, only
 * receive it.
 */
export function normalizeProviderStatus(
  raw?: null | string
): PaymentChargeStatus {
  switch (raw) {
    case "PENDING":
      return CHARGE_STATUS_PENDING;
    case "PAID":
      return CHARGE_STATUS_PAID;
    case "EXPIRED":
      return CHARGE_STATUS_EXPIRED;
    case "REFUNDED":
      return CHARGE_STATUS_REFUNDED;
    case "FAILED":
    case "CANCELLED": // AbacatePay uses CANCELLED for failed card charges
      return CHARGE_STATUS_FAILED;
    default:
      return CHARGE_STATUS_PENDING;
  }
}
