import { z } from "zod";

export const LeaguePaymentStatusOptions = [
  "pending_payment",
  "paid",
  "expired",
  "failed",
] as const;
export type LeaguePaymentStatus = (typeof LeaguePaymentStatusOptions)[number];

export const OrganizationWooviAccountStatusOptions = [
  "active",
  "rejected",
] as const;
export type OrganizationWooviAccountStatus =
  (typeof OrganizationWooviAccountStatusOptions)[number];

export const BILLING_INTERVALS = ["week", "month", "quarter", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const leaguePaymentStatusSchema = z.enum([
  ...LeaguePaymentStatusOptions,
]);
export const organizationWooviAccountStatusSchema = z.enum([
  ...OrganizationWooviAccountStatusOptions,
]);
export const billingIntervalSchema = z.enum([...BILLING_INTERVALS]);

export const splitConfigSchema = z.object({
  pixKey: z.string().min(1),
  percent: z.number().min(0).max(100),
  brOpenCents: z.number().int().min(0),
  organizerCents: z.number().int().min(0),
});
export type SplitConfig = z.infer<typeof splitConfigSchema>;

/**
 * Splits a charge amount between BR-Open (platform fee) and the organizer.
 * The platform cut is floored to the cent so the organizer is never
 * overcharged by rounding; the organizer gets the remainder.
 */
export function computeSplit(args: {
  amountCents: number;
  platformFeePercent: number;
}): { brOpenCents: number; organizerCents: number } {
  if (args.amountCents < 0) {
    throw new Error("amountCents must be non-negative");
  }
  if (args.platformFeePercent < 0 || args.platformFeePercent > 100) {
    throw new Error("platformFeePercent must be between 0 and 100");
  }
  const brOpenCents = Math.floor(
    (args.amountCents * args.platformFeePercent) / 100
  );
  return {
    brOpenCents,
    organizerCents: args.amountCents - brOpenCents,
  };
}

/**
 * Deterministic correlationID for a membership + billing cycle so retries
 * are idempotent at the Woovi layer (same correlationID returns the same
 * charge) and the webhook can resolve the payment back to a membership.
 */
export function buildPaymentCorrelationId(args: {
  leagueMembershipId: string;
  cycleAnchor: string;
}): string {
  return `mem:${args.leagueMembershipId}:${args.cycleAnchor}`;
}
