import { z } from "zod";

export const PAYMENT_CHARGE_STATUSES = [
  "PENDING",
  "PAID",
  "EXPIRED",
  "REFUNDED",
  "FAILED",
] as const;

export type PaymentChargeStatus = (typeof PAYMENT_CHARGE_STATUSES)[number];

export const paymentChargeStatusSchema = z.enum([...PAYMENT_CHARGE_STATUSES]);

// Lives in the contract (not in a function file) so domain modules can read a
// source without importing a Convex function file.

export const SOURCE_TYPE_TOURNAMENT_ENTRY = "tournament_entry";

// The provider creates the subaccount synchronously and it is usable right
// away (no async KYC); the enum stays for a future stricter KYC flow.

export const PAYMENT_ACCOUNT_STATUSES = [
  "pending",
  "active",
  "rejected",
] as const;

export type PaymentAccountStatus = (typeof PAYMENT_ACCOUNT_STATUSES)[number];

export const paymentAccountStatusSchema = z.enum([...PAYMENT_ACCOUNT_STATUSES]);

// Embedded JSON (one account per organization) validated by this zod schema in
// the organization serializer.

export const paymentAccountSchema = z.object({
  // Withdraw destination label ("account name + pix key"); nullable with
  // default so snapshots saved before the field existed keep parsing.
  accountName: z.string().nullable().default(null),
  name: z.string(),
  onboardedAt: z.string().nullable(),
  // min(1) mirrors splitConfigSchema.recipientPixKey: an empty key is an
  // invalid account.
  pixKey: z.string().min(1),
  status: paymentAccountStatusSchema,
});

export type PaymentAccount = z.infer<typeof paymentAccountSchema>;

// Snapshotted at charge time so historical payments stay correct when the fee
// percent changes; the provider enforces the real split from its own payload.

export const splitConfigSchema = z.object({
  brOpenCents: z.number().int().nonnegative(),
  feePercent: z.number().min(0).max(100),
  organizerCents: z.number().int().nonnegative(),
  recipientPixKey: z.string().min(1),
  // Optional so charges snapshotted before this field keep parsing — absent
  // means unknown platform revenue, not zero.
  wooviFeeCents: z.number().int().nonnegative().optional(),
});

export type SplitConfig = z.infer<typeof splitConfigSchema>;

/** `pending` — reserved, PIX out in flight before the provider returns an id;
 * `completed` — provider accepted it; `failed` — rejected or hit by
 * `OPENPIX:MOVEMENT_FAILED`. Completed rows are NOT in flight: they never gate
 * a new withdrawal. */
export const WITHDRAW_STATUSES = ["pending", "failed", "completed"] as const;

export type WithdrawStatus = (typeof WITHDRAW_STATUSES)[number];

export const withdrawStatusSchema = z.enum(WITHDRAW_STATUSES);

export const withdrawFeeTierSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  upToCents: z.number().int().positive(),
});

/** Mirrors `src/lib/withdraw/contract.ts` (WithdrawBalance). */
export const withdrawBalanceSchema = z.object({
  // `accountName` is null for keys registered before the field existed (the
  // client then shows a generic label); `pixKey` is masked.
  accountName: z.string().nullable(),
  balanceCents: z.number().int().nonnegative(),
  feeTiers: z.array(withdrawFeeTierSchema),
  freeFromCents: z.number().int().positive(),
  minWithdrawCents: z.number().int().positive(),
  pixKey: z.string().min(1),
});

export type WithdrawBalance = z.infer<typeof withdrawBalanceSchema>;

/** Mirrors `src/lib/withdraw/contract.ts` (WithdrawRequestResult). */
export const requestWithdrawOutputSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  liquidAmountCents: z.number().int().nonnegative(),
  status: withdrawStatusSchema,
});

export type RequestWithdrawOutput = z.infer<typeof requestWithdrawOutputSchema>;

export const createChargeOutputSchema = z.object({
  brCode: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  qrCodeUrl: z.string(),
  status: paymentChargeStatusSchema,
});

export type CreateChargeOutput = z.infer<typeof createChargeOutputSchema>;

/** Returned FLAT for the charge the link points at and nested under
 * `pendingCharge` for the live obligation of the source — the screen swaps the
 * whole projection, never fields from both. */
export const checkoutChargeSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  brCode: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  qrCodeUrl: z.string(),
  status: paymentChargeStatusSchema,
});

export type CheckoutCharge = z.infer<typeof checkoutChargeSchema>;

export const checkoutContextSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  brCode: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  // The caller's own PENDING charge with a usable PIX, so a link carrying a
  // terminal charge still renders the newer open one. Null means nothing beyond
  // the link's charge; reading it never creates a charge.
  pendingCharge: checkoutChargeSchema.nullable(),
  qrCodeUrl: z.string(),
  sourceId: z.string(),
  sourceLabel: z.string().nullable(),
  sourceType: z.string(),
  status: paymentChargeStatusSchema,
});

export type CheckoutContext = z.infer<typeof checkoutContextSchema>;

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
    paymentsThisMonth: z.number().int().nonnegative(),
    receivedLastMonthCents: z.number().int().nonnegative(),
    receivedThisMonthCents: z.number().int().nonnegative(),
  }),
  recentCharges: z.array(dashboardRecentChargeSchema),
});

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;

// All months of the window are always present (empty = zero) so charts don't
// drop gaps; `bySource` breaks the same window down by competition.

export const dashboardRevenuePointSchema = z.object({
  month: z.string(),
  receivedCents: z.number().int().nonnegative(),
});

export const dashboardRevenueSourceSchema = z.object({
  sourceId: z.string(),
  sourceLabel: z.string().nullable(),
  sourceType: z.string(),
  totalCents: z.number().int().nonnegative(),
});

export const dashboardRevenueSeriesSchema = z.object({
  bySource: z.array(dashboardRevenueSourceSchema),
  series: z.array(dashboardRevenuePointSchema),
  totalCents: z.number().int().nonnegative(),
});

export type DashboardRevenuePoint = z.infer<typeof dashboardRevenuePointSchema>;
export type DashboardRevenueSource = z.infer<
  typeof dashboardRevenueSourceSchema
>;
export type DashboardRevenueSeries = z.infer<
  typeof dashboardRevenueSeriesSchema
>;
