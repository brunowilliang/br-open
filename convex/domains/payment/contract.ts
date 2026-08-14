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
// Payment account statuses (organization onboarding)
// ---------------------------------------------------------------------------
//
// The provider creates the subaccount synchronously and it is usable
// immediately (no async KYC for subaccounts — validated in the 2026-07-02
// PoC). The `pending` -> `active` transition is therefore immediate in
// practice, but we keep the enum so a future stricter KYC flow can fit in
// without schema changes.

export const PAYMENT_ACCOUNT_STATUSES = [
  "pending",
  "active",
  "rejected",
] as const;

export type PaymentAccountStatus = (typeof PAYMENT_ACCOUNT_STATUSES)[number];

export const paymentAccountStatusSchema = z.enum([...PAYMENT_ACCOUNT_STATUSES]);

// ---------------------------------------------------------------------------
// Payment account snapshot — embedded JSON on `organization.paymentAccount`
// ---------------------------------------------------------------------------
//
// Mirrors the `metadata` pattern: raw JSON at the schema level, validated
// by this zod schema in the organization serializer. One organization has
// at most one payment account (1:1), so the JSON embed replaces the old
// `organizationWooviAccount` table.

export const paymentAccountSchema = z.object({
  // Display name of the account holder (IBX-0002) — the organizer-facing
  // label shown on the withdraw destination ("account name + pix key").
  // Nullable with default so pre-existing snapshots (no field) keep parsing;
  // the withdraw screen falls back to "Chave PIX" when null.
  accountName: z.string().nullable().default(null),
  name: z.string(),
  onboardedAt: z.string().nullable(),
  // min(1) mirrors splitConfigSchema.recipientPixKey: a snapshot with an
  // empty key is an invalid account (getStatus/getBalance fall back to
  // "not configured").
  pixKey: z.string().min(1),
  status: paymentAccountStatusSchema,
});

export type PaymentAccount = z.infer<typeof paymentAccountSchema>;

// ---------------------------------------------------------------------------
// Split config snapshot
// ---------------------------------------------------------------------------
//
// Stored on each paymentCharge at charge time so historical payments stay
// correct even if the platform fee percent changes later. The actual split
// is enforced by the provider from the charge payload; this is informational.

export const splitConfigSchema = z.object({
  brOpenCents: z.number().int().nonnegative(),
  feePercent: z.number().min(0).max(100),
  organizerCents: z.number().int().nonnegative(),
  recipientPixKey: z.string().min(1),
  // Woovi PIX-IN fee snapshot (DECISAO-004): clamp(0.8% · amount, R$ 0,50,
  // R$ 5,00). Always present on charges created after DECISAO-004; optional
  // in the parse so legacy charges (no value) don't fail validation — treat
  // the absence as unknown platform revenue (null), not zero.
  wooviFeeCents: z.number().int().nonnegative().optional(),
});

export type SplitConfig = z.infer<typeof splitConfigSchema>;

// ---------------------------------------------------------------------------
// Withdrawals (DECISAO-003)
// ---------------------------------------------------------------------------

/**
 * Local lifecycle of a withdrawal request. `pending` — row reserved, PIX out
 * in flight (before the provider returns an id); `completed` — provider
 * accepted the PIX out (set by `completeWithdrawal`); `failed` — provider
 * rejected it or `OPENPIX:MOVEMENT_FAILED` arrived (from `pending` or
 * `completed`). `completed` rows are NOT "in flight": they never gate a new
 * withdrawal (BUG-0001).
 */
export const WITHDRAW_STATUSES = ["pending", "failed", "completed"] as const;

export type WithdrawStatus = (typeof WITHDRAW_STATUSES)[number];

export const withdrawStatusSchema = z.enum(WITHDRAW_STATUSES);

export const withdrawFeeTierSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  upToCents: z.number().int().positive(),
});

/**
 * `payment/withdraw:getBalance` output — mirrors
 * `src/lib/withdraw/contract.ts` (WithdrawBalance).
 */
export const withdrawBalanceSchema = z.object({
  // Withdraw destination (IBX-0002): account display name + masked pix key.
  // accountName is null for keys registered before the field existed — the
  // client falls back to a generic "Chave PIX" label. pixKey is masked
  // (same as payment.onboarding.getStatus).
  accountName: z.string().nullable(),
  balanceCents: z.number().int().nonnegative(),
  feeTiers: z.array(withdrawFeeTierSchema),
  freeFromCents: z.number().int().positive(),
  minWithdrawCents: z.number().int().positive(),
  pixKey: z.string().min(1),
});

export type WithdrawBalance = z.infer<typeof withdrawBalanceSchema>;

/**
 * `payment/withdraw:requestWithdraw` output — mirrors
 * `src/lib/withdraw/contract.ts` (WithdrawRequestResult).
 */
export const requestWithdrawOutputSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  liquidAmountCents: z.number().int().nonnegative(),
  status: withdrawStatusSchema,
});

export type RequestWithdrawOutput = z.infer<typeof requestWithdrawOutputSchema>;

// ---------------------------------------------------------------------------
// Charge output (returned to the client after creating a PIX charge)
// ---------------------------------------------------------------------------

export const createChargeOutputSchema = z.object({
  brCode: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  qrCodeUrl: z.string(),
  status: paymentChargeStatusSchema,
});

export type CreateChargeOutput = z.infer<typeof createChargeOutputSchema>;

// ---------------------------------------------------------------------------
// Checkout context (returned by getCheckoutContext for /checkout/[chargeId])
// ---------------------------------------------------------------------------

export const checkoutContextSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  brCode: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  qrCodeUrl: z.string(),
  sourceId: z.string(),
  sourceLabel: z.string().nullable(),
  sourceType: z.string(),
  status: paymentChargeStatusSchema,
});

export type CheckoutContext = z.infer<typeof checkoutContextSchema>;

// ---------------------------------------------------------------------------
// My payments list item (player-facing payment hub)
// ---------------------------------------------------------------------------

export const myPaymentItemSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  canRegenerate: z.boolean(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  sourceId: z.string(),
  sourceLabel: z.string().nullable(),
  sourceType: z.string(),
  status: paymentChargeStatusSchema,
});

export type MyPaymentItem = z.infer<typeof myPaymentItemSchema>;

export const listMyPaymentsOutputSchema = z.object({
  items: z.array(myPaymentItemSchema),
});

export type ListMyPaymentsOutput = z.infer<typeof listMyPaymentsOutputSchema>;

// ---------------------------------------------------------------------------
// Organizer dashboard overview (Home screen in organizer mode)
// ---------------------------------------------------------------------------

export const dashboardRecentChargeSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  chargeId: z.string(),
  createdAt: z.string(),
  organizerCents: z.number().int().nonnegative(),
  paidAt: z.string().nullable(),
  playerName: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  status: paymentChargeStatusSchema,
});

export type DashboardRecentCharge = z.infer<typeof dashboardRecentChargeSchema>;

export const dashboardOverviewSchema = z.object({
  account: z.object({
    name: z.string().nullable(),
    pixKey: z.string().nullable(),
    status: paymentAccountStatusSchema.nullable(),
  }),
  metrics: z.object({
    activeSubscribers: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    paymentsThisMonth: z.number().int().nonnegative(),
    projectedMonthlyCents: z.number().int().nonnegative(),
    receivedLastMonthCents: z.number().int().nonnegative(),
    receivedThisMonthCents: z.number().int().nonnegative(),
  }),
  recentCharges: z.array(dashboardRecentChargeSchema),
});

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
