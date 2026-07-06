import { z } from "zod";

// ---------------------------------------------------------------------------
// Payment charge statuses
// ---------------------------------------------------------------------------
//
// Provider-agnostic. Woovi maps onto this as:
//   ACTIVE      -> PENDING  (charge awaiting payment)
//   COMPLETED   -> PAID     (webhook OPENPIX:TRANSACTION_RECEIVED)
//   EXPIRED     -> EXPIRED  (webhook OPENPIX:CHARGE_EXPIRED)
//
// REFUNDED is reached via the over-enrollment guard or a manual dashboard
// refund reconciled by webhook. FAILED is reserved for charge-creation
// failures (kept for diagnostics; the player retries with a new charge).

export const PAYMENT_CHARGE_STATUSES = [
  "PENDING",
  "PAID",
  "EXPIRED",
  "REFUNDED",
  "FAILED",
] as const;

export type PaymentChargeStatus = (typeof PAYMENT_CHARGE_STATUSES)[number];

export const paymentChargeStatusSchema = z.enum([...PAYMENT_CHARGE_STATUSES]);

// ---------------------------------------------------------------------------
// Woovi account statuses (organization onboarding)
// ---------------------------------------------------------------------------
//
// Woovi creates the subaccount synchronously and it is usable immediately
// (no async KYC for subaccounts — validated in the 2026-07-02 PoC). The
// `pending` -> `active` transition is therefore immediate in practice, but
// we keep the enum so a future stricter Woovi KYC flow can fit in without
// schema changes.

export const WOOVI_ACCOUNT_STATUSES = [
  "pending",
  "active",
  "rejected",
] as const;

export type WooviAccountStatus = (typeof WOOVI_ACCOUNT_STATUSES)[number];

export const wooviAccountStatusSchema = z.enum([...WOOVI_ACCOUNT_STATUSES]);

// ---------------------------------------------------------------------------
// Split config snapshot
// ---------------------------------------------------------------------------
//
// Stored on each leaguePayment at charge time so historical payments stay
// correct even if the platform fee percent changes later. The actual split
// is enforced by Woovi from the charge payload; this is informational.

export const splitConfigSchema = z.object({
  brOpenCents: z.number().int().nonnegative(),
  feePercent: z.number().min(0).max(100),
  organizerCents: z.number().int().nonnegative(),
  recipientPixKey: z.string().min(1),
});

export type SplitConfig = z.infer<typeof splitConfigSchema>;

// ---------------------------------------------------------------------------
// Charge output (returned to the client after creating a PIX charge)
// ---------------------------------------------------------------------------
//
// Field names are kept stable with the previous AbacatePay shape so the
// checkout screen needs no changes. `brCodeBase64` is a misnomer now — it
// holds the Woovi `qrCodeImage` HTTPS URL (React Native <Image> accepts
// both data: and https:// URIs). Kept under the old name to avoid a
// frontend migration in this slice.

export const createChargeOutputSchema = z.object({
  brCode: z.string(),
  brCodeBase64: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  status: paymentChargeStatusSchema,
});

export type CreateChargeOutput = z.infer<typeof createChargeOutputSchema>;

// ---------------------------------------------------------------------------
// My payments list item (player-facing payment hub)
// ---------------------------------------------------------------------------

export const myPaymentItemSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  leagueId: z.string(),
  leagueName: z.string().nullable(),
  membershipId: z.string(),
  paidAt: z.string().nullable(),
  status: paymentChargeStatusSchema,
});

export type MyPaymentItem = z.infer<typeof myPaymentItemSchema>;

export const listMyPaymentsOutputSchema = z.object({
  items: z.array(myPaymentItemSchema),
});

export type ListMyPaymentsOutput = z.infer<typeof listMyPaymentsOutputSchema>;
