import { LEAGUE_MEMBERSHIP_STATUSES } from "../league/contract";
import type { PaymentChargeStatus, SplitConfig } from "./contract";

/** PIX validity, in seconds: the same value goes to Woovi as `expiresIn`. */
export const CHARGE_EXPIRES_IN_SECONDS = 3600; // 1 hour

export const CHARGE_STATUS_PENDING =
  "PENDING" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_PAID = "PAID" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_EXPIRED =
  "EXPIRED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_REFUNDED =
  "REFUNDED" as const satisfies PaymentChargeStatus;
export const CHARGE_STATUS_FAILED =
  "FAILED" as const satisfies PaymentChargeStatus;

type ChargeLike = { status: string };

export function canChargeBePaid(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

export function canChargeBeExpired(charge: ChargeLike): boolean {
  return charge.status === CHARGE_STATUS_PENDING;
}

/** PAID only, plus EXPIRED defensively so a late refund webhook for a
 * locally-expired charge still reconciles. */
export function canChargeBeRefunded(charge: ChargeLike): boolean {
  return (
    charge.status === CHARGE_STATUS_PAID ||
    charge.status === CHARGE_STATUS_EXPIRED
  );
}

/** Single predicate behind both checkout ends (the charge `createCharge`
 * reuses and the screen's `pendingCharge`). A PENDING charge past `expiresAt`
 * is unusable already — the provider refuses it before the sweeper runs. */
export function hasUsablePix(args: {
  charge: { expiresAt: null | Date; status: string } | null | undefined;
  nowMs: number;
}): boolean {
  return Boolean(
    args.charge &&
      args.charge.status === CHARGE_STATUS_PENDING &&
      args.charge.expiresAt &&
      args.charge.expiresAt.getTime() > args.nowMs
  );
}

type MembershipLike = { status: string };

const CHARGEABLE_MEMBERSHIP_STATUSES: ReadonlySet<string> = new Set([
  LEAGUE_MEMBERSHIP_STATUSES.AWAITING_PAYMENT,
  LEAGUE_MEMBERSHIP_STATUSES.PAYMENT_DUE,
  LEAGUE_MEMBERSHIP_STATUSES.SUSPENDED,
]);

/** `awaiting_payment`, `payment_due` and `suspended` are chargeable; `active`
 * only with `renewal` (the current due date) inside the league window —
 * callers that don't resolve the billing cycle keep it non-chargeable. */
export function canMembershipBeCharged(
  membership: MembershipLike,
  renewal?: null | {
    nextDueMs: number;
    nowMs: number;
    reminderDaysBefore: number;
  }
): boolean {
  if (CHARGEABLE_MEMBERSHIP_STATUSES.has(membership.status)) {
    return true;
  }

  if (membership.status !== LEAGUE_MEMBERSHIP_STATUSES.ACTIVE || !renewal) {
    return false;
  }

  return isWithinRenewalWindow(renewal);
}

/** Unknown provider statuses fall back to PENDING, never to PAID. */
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

/** Floor of the BR-Open fee AFTER the Woovi fee: on cheap tickets the
 * organizer pays the difference when the percentage cut would net less. */
export const PLATFORM_FEE_MIN_MARGIN_CENTS = 100; // R$ 1,00

/** Woovi PIX-IN schedule (percentual plan): 0.80% per PIX, min R$ 0,50,
 * max R$ 5,00 — in bps + cents so the math stays exact. */
export const WOOVI_FEE_BPS = 80; // 0.80%
export const WOOVI_FEE_MIN_CENTS = 50; // R$ 0,50
export const WOOVI_FEE_MAX_CENTS = 500; // R$ 5,00

export function computeWooviFeeCents(amountCents: number): number {
  const pct = Math.round((amountCents * WOOVI_FEE_BPS) / 10_000);
  return Math.min(Math.max(pct, WOOVI_FEE_MIN_CENTS), WOOVI_FEE_MAX_CENTS);
}

export type ComputedSplit = Omit<SplitConfig, "wooviFeeCents"> & {
  wooviFeeCents: number;
};

/** BR-Open keeps `max(feePercent · amount, Woovi fee + margin)`; the organizer
 * gets the remainder, so the split always sums exactly to `amountCents`. */
export function computeSplit(args: {
  amountCents: number;
  feePercent: number;
  recipientPixKey: string;
}): ComputedSplit {
  const wooviFeeCents = computeWooviFeeCents(args.amountCents);
  // Fee capped at the ticket: the organizer share must stay >= 0, since a
  // negative split is invalid at the provider.
  const brOpenCents = Math.min(
    Math.max(
      Math.round(args.amountCents * (args.feePercent / 100)),
      wooviFeeCents + PLATFORM_FEE_MIN_MARGIN_CENTS
    ),
    args.amountCents
  );
  return {
    brOpenCents,
    feePercent: args.feePercent,
    organizerCents: args.amountCents - brOpenCents,
    recipientPixKey: args.recipientPixKey,
    wooviFeeCents,
  };
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function shouldSendRenewalReminder(args: {
  nextDueMs: number;
  nowMs: number;
  reminderDaysBefore: number;
}): boolean {
  const msUntilDue = args.nextDueMs - args.nowMs;
  return msUntilDue > 0 && msUntilDue <= args.reminderDaysBefore * MS_PER_DAY;
}

export function shouldMarkPaymentDue(args: {
  nextDueMs: number;
  nowMs: number;
}): boolean {
  return args.nextDueMs <= args.nowMs;
}

export function shouldSuspend(args: {
  nextDueMs: number;
  nowMs: number;
  gracePeriodDays: number;
}): boolean {
  const suspensionMs = args.nextDueMs + args.gracePeriodDays * MS_PER_DAY;
  return args.nowMs >= suspensionMs;
}

export const BILLING_INTERVAL_MS: Record<string, number> = {
  month: 30 * MS_PER_DAY,
  once: Number.POSITIVE_INFINITY,
  quarter: 90 * MS_PER_DAY,
  week: 7 * MS_PER_DAY,
  year: 365 * MS_PER_DAY,
};

export function resolveBillingIntervalMs(
  priceBillingInterval?: null | string
): number {
  return (
    BILLING_INTERVAL_MS[priceBillingInterval ?? "month"] ??
    (BILLING_INTERVAL_MS.month as number)
  );
}

/** Wider than `shouldSendRenewalReminder` and with no lower bound: also true
 * past the due date, while the cron hasn't flipped `active` yet. */
export function isWithinRenewalWindow(args: {
  nextDueMs: number;
  nowMs: number;
  reminderDaysBefore: number;
}): boolean {
  return args.nextDueMs - args.nowMs <= args.reminderDaysBefore * MS_PER_DAY;
}

/** Stacks on the due date already paid for (or `paidAt` on the first payment),
 * never on today: renewing early must not shrink the paid period. */
export function computeStackedPeriodEndMs(args: {
  currentDueMs: null | number | undefined;
  intervalMs: number;
  paidAtMs: number;
}): number {
  const baseMs = Math.max(args.paidAtMs, args.currentDueMs ?? 0);
  return baseMs + args.intervalMs;
}

/** Brazil dropped DST, so a fixed UTC-3 is exact; the app must label dates with
 * this same offset or they disagree near midnight. */
export const BRAZIL_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Calendar days, not a 24h window: a due date later today reads "vence
 * hoje". Both terms shift by BRT — counted in UTC, a 21:00-23:59 BRT due
 * instant lands a day ahead. */
export function renewalDaysLeft(args: {
  nextDueMs: number;
  nowMs: number;
}): number {
  return (
    Math.floor((args.nextDueMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY) -
    Math.floor((args.nowMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY)
  );
}

/** Month bucket on the Brazilian calendar: a charge paid 23:59 BRT on the
 * month's last day belongs to that month, not the next. */
export function buildBrazilMonthKey(ms: number): string {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fixed x-axis: every month of the window is present, so empty months render
 * as zero instead of disappearing. */
export function buildRecentMonthKeys(args: {
  months: number;
  nowMs: number;
}): string[] {
  const current = new Date(args.nowMs + BRAZIL_UTC_OFFSET_MS);
  const keys: string[] = [];
  let year = current.getUTCFullYear();
  let month = current.getUTCMonth();
  for (let index = 0; index < args.months; index += 1) {
    keys.unshift(`${year}-${String(month + 1).padStart(2, "0")}`);
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return keys;
}

export function monthKeyWindowStartMs(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1) - BRAZIL_UTC_OFFSET_MS;
}

/** `otherActiveMembers` excludes the membership being charged, and a renewal
 * holds the slot it owns — refunding it would evict a paying member. */
export function wouldExceedLeagueCapacity(args: {
  isRenewal: boolean;
  maxPlayers: null | number | undefined;
  otherActiveMembers: number;
}): boolean {
  if (args.isRenewal) {
    return false;
  }

  if (args.maxPlayers === null || args.maxPlayers === undefined) {
    return false;
  }

  return args.otherActiveMembers >= args.maxPlayers;
}

/** Only the owner of the source (membership player / entry payer) may create
 * or reuse its charge; a caller with no player profile never owns one. */
export function ownsPayableSource(args: {
  callerProfileId: null | string | undefined;
  ownerProfileId: null | string | undefined;
}): boolean {
  return Boolean(
    args.callerProfileId &&
      args.ownerProfileId &&
      args.callerProfileId === args.ownerProfileId
  );
}
