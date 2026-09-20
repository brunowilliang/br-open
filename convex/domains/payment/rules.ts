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

/**
 * Whether a charge still carries a usable PIX: PENDING and not past its
 * `expiresAt`.
 *
 * One rule behind both ends of the checkout (BUG-0025): the charge
 * `createCharge` reuses and the `pendingCharge` the checkout resolves, so the
 * screen can only ever show a PIX that "Gerar novo Pix" would also hand back.
 *
 * A PENDING charge past its expiration is NOT usable even before the hourly
 * sweeper flips it to EXPIRED — the provider refuses the payment.
 */
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
 *
 * Early renewal (IBX-0039): an `active` membership is also chargeable while the
 * league renewal window is open — pass `renewal` with the current due date to
 * enable it. Without `renewal` (callers that don't resolve the billing cycle),
 * `active` stays non-chargeable, which is the pre-IBX-0039 behaviour.
 */
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
// Split math (DECISAO-004)
// ---------------------------------------------------------------------------

/**
 * BR-Open platform fee floor per charge: the platform never nets less than
 * this margin after paying the Woovi PIX-IN fee. The organizer pays the
 * difference when the percentage cut would be smaller (tickets below ~R$15
 * at the default 10%).
 */
export const PLATFORM_FEE_MIN_MARGIN_CENTS = 100; // R$ 1,00

/**
 * Woovi PIX-IN fee schedule (percentual plan, woovi.com/planos-e-precos):
 * 0.80% per confirmed PIX, minimum R$ 0.50, maximum R$ 5.00. Kept in
 * integer-friendly units (basis points + cents) so the math stays exact.
 */
export const WOOVI_FEE_BPS = 80; // 0.80%
export const WOOVI_FEE_MIN_CENTS = 50; // R$ 0,50
export const WOOVI_FEE_MAX_CENTS = 500; // R$ 5,00

/**
 * Woovi PIX-IN fee for a charge of `amountCents`, in cents:
 * `clamp(0.8% · amount, R$ 0,50, R$ 5,00)`.
 */
export function computeWooviFeeCents(amountCents: number): number {
  const pct = Math.round((amountCents * WOOVI_FEE_BPS) / 10_000);
  return Math.min(Math.max(pct, WOOVI_FEE_MIN_CENTS), WOOVI_FEE_MAX_CENTS);
}

/**
 * Split as computed at charge time: same shape as `SplitConfig`, but with
 * `wooviFeeCents` always present (computeSplit always fills it).
 */
export type ComputedSplit = Omit<SplitConfig, "wooviFeeCents"> & {
  wooviFeeCents: number;
};

/**
 * Computes the split between organizer and BR-Open for a paid league charge.
 *
 * `feePercent` is the BR-Open platform cut (0-100). The final BR-Open fee is
 * `max(feePercent · amount, Woovi fee + margin)`: the platform keeps its
 * percentage cut, and never nets less than `PLATFORM_FEE_MIN_MARGIN_CENTS`
 * after the Woovi PIX-IN fee is debited from the main account. The organizer
 * receives the remainder (`amount - fee`), so the split always sums exactly
 * to `amountCents`.
 *
 * @example computeSplit({ amountCents: 5000, feePercent: 10, recipientPixKey: "<org pix key>" }) === {
 *   brOpenCents: 500,
 *   feePercent: 10,
 *   organizerCents: 4500,
 *   recipientPixKey: "<the org's woovi pix key>",
 *   wooviFeeCents: 50,
 * }
 */
export function computeSplit(args: {
  amountCents: number;
  feePercent: number;
  recipientPixKey: string;
}): ComputedSplit {
  const wooviFeeCents = computeWooviFeeCents(args.amountCents);
  // Fee never exceeds the ticket (organizer share stays >= 0 — a negative
  // split would be invalid at the provider). Only reachable for tickets
  // below the R$1.50 floor, which are not real league prices.
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

// ---------------------------------------------------------------------------
// Renewal timeline helpers (grace period + proactive reminders)
// ---------------------------------------------------------------------------

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// ---------------------------------------------------------------------------
// Billing cycle helpers (IBX-0039: early renewal + period stacking)
// ---------------------------------------------------------------------------

/**
 * Billing interval in ms per league `priceBillingInterval` value. `once` means
 * the charge never renews (`Infinity`) — callers must skip cycle math for it.
 *
 * Lives in the domain (not in the payment cron file) because the league detail
 * query also needs it, to expose the viewer's due date
 * (`viewerMembershipDueAt`).
 */
export const BILLING_INTERVAL_MS: Record<string, number> = {
  month: 30 * MS_PER_DAY,
  once: Number.POSITIVE_INFINITY,
  quarter: 90 * MS_PER_DAY,
  week: 7 * MS_PER_DAY,
  year: 365 * MS_PER_DAY,
};

/**
 * Billing interval of a league, defaulting to `month` when the league has no
 * interval or an unknown one (mirrors the league serializer default).
 */
export function resolveBillingIntervalMs(
  priceBillingInterval?: null | string
): number {
  return (
    BILLING_INTERVAL_MS[priceBillingInterval ?? "month"] ??
    (BILLING_INTERVAL_MS.month as number)
  );
}

/**
 * Whether the membership is inside the league renewal window — the due date is
 * at most `reminderDaysBefore` days away.
 *
 * This is the *charging* window (early renewal is allowed inside it) and is
 * deliberately wider than `shouldSendRenewalReminder`: it also true after the
 * due date, covering the gap where a membership is still `active` only because
 * the daily cron has not flipped it to `payment_due` yet.
 */
export function isWithinRenewalWindow(args: {
  nextDueMs: number;
  nowMs: number;
  reminderDaysBefore: number;
}): boolean {
  return args.nextDueMs - args.nowMs <= args.reminderDaysBefore * MS_PER_DAY;
}

/**
 * End of the period the next PAID charge buys: the new period stacks on top of
 * the due date the member already paid for (`currentDueMs + intervalMs`), never
 * on the payment date — renewing early must not shrink the current period (and
 * paying late must not gift a full interval from today).
 *
 * Falls back to `paidAtMs + intervalMs` on the first payment, when there is no
 * cycle yet.
 */
export function computeStackedPeriodEndMs(args: {
  currentDueMs: null | number | undefined;
  intervalMs: number;
  paidAtMs: number;
}): number {
  const baseMs = Math.max(args.paidAtMs, args.currentDueMs ?? 0);
  return baseMs + args.intervalMs;
}

/**
 * Fixed offset of the Brazilian calendar (UTC-3). Brazil dropped DST in 2019,
 * so a constant is exact — and the app must use THE SAME offset when it labels
 * the renewal date, otherwise the notification and the league screen would
 * disagree near midnight.
 */
export const BRAZIL_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Whole days between now and `nextDueMs` on the Brazilian calendar: 0 means
 * "due today", 1 "due tomorrow", negative once the due day has passed.
 *
 * Calendar days (not a 24h window) are what the reminder text needs: a due date
 * later today must read "vence hoje", never "vence amanhã". The day boundary is
 * the Brazilian one (`BRAZIL_UTC_OFFSET_MS`) applied to both terms — counting in
 * UTC would call a due instant in the 21:00-23:59 BRT window "tomorrow", one day
 * ahead of what the member sees in the app (review MEDIUM).
 */
export function renewalDaysLeft(args: {
  nextDueMs: number;
  nowMs: number;
}): number {
  return (
    Math.floor((args.nextDueMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY) -
    Math.floor((args.nowMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY)
  );
}

/**
 * Month key ("YYYY-MM") of an instant on the Brazilian calendar. The dash
 * series (IBX-0071) bucket by month: a charge paid 23:59 BRT on the month's
 * last day must land in that month, not the next (same reasoning as
 * `renewalDaysLeft`, one bucket up).
 */
export function buildBrazilMonthKey(ms: number): string {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The last `months` month keys ("YYYY-MM", Brazilian calendar) ending at the
 * month of `nowMs`, ascending. The x-axis of every dash series: fixed keys so
 * empty months render as zero instead of disappearing.
 */
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

/**
 * First instant of a month key on the Brazilian calendar: "2026-04" starts at
 * 2026-04-01 00:00 BRT = 03:00 UTC. Inclusive window start for "results since
 * month X".
 */
export function monthKeyWindowStartMs(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1) - BRAZIL_UTC_OFFSET_MS;
}

/**
 * Whether applying a paid charge would push the league over its player cap —
 * i.e. whether the over-enrollment guard must refund instead of activating
 * (BUG-0023).
 *
 * `otherActiveMembers` counts the league's *other* `active` memberships: the
 * membership being charged is never counted as a new occupant of the slot it
 * already owns. A renewal of an already-`active` membership holds its slot, so
 * it can never overfill the league and is always allowed — refunding it would
 * evict a paying member (the regression this rule encodes).
 */
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

/**
 * Whether the caller owns the payable source of a charge (BUG-0022).
 *
 * A charge may only be created — or an existing PENDING one reused — by the
 * player who owns the source: the membership's player, or the tournament
 * entry's payer (`playerAId`, always the entry creator). A caller without a
 * player profile never owns a source, so nobody charges on someone else's
 * behalf.
 */
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
