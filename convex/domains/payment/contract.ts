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
  onboardedAt: z.string().nullable(),
  name: z.string(),
  pixKey: z.string(),
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
});

export type SplitConfig = z.infer<typeof splitConfigSchema>;

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
  chargeId: z.string(),
  playerName: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  organizerCents: z.number().int().nonnegative(),
  status: paymentChargeStatusSchema,
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});

export type DashboardRecentCharge = z.infer<typeof dashboardRecentChargeSchema>;

export const dashboardOverviewSchema = z.object({
  account: z.object({
    name: z.string().nullable(),
    pixKey: z.string().nullable(),
    status: paymentAccountStatusSchema.nullable(),
  }),
  metrics: z.object({
    receivedThisMonthCents: z.number().int().nonnegative(),
    receivedLastMonthCents: z.number().int().nonnegative(),
    activeSubscribers: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    paymentsThisMonth: z.number().int().nonnegative(),
    projectedMonthlyCents: z.number().int().nonnegative(),
  }),
  recentCharges: z.array(dashboardRecentChargeSchema),
});

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
