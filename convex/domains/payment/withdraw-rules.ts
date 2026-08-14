/**
 * Withdrawal rules — DECISAO-003 (approved).
 *
 * Fee model: tiered ("faixas escalonadas"). The fee table comes from the
 * backend — never hardcoded on the frontend — and is exposed through
 * `payment/withdraw:getBalance`. The frontend mirrors this logic in
 * `src/lib/withdraw/calculations.ts` (keep both in sync).
 */

export type WithdrawFeeTier = { upToCents: number; feeCents: number };

/**
 * Fee tiers, ordered by `upToCents` ascending. The applied fee is the first
 * tier whose `upToCents >= amountCents` (inclusive upper bound). Above the
 * last tier the last tier's fee applies (cap); from
 * `FREE_WITHDRAW_FROM_CENTS` up the withdrawal is free.
 */
export const WITHDRAW_FEE_TIERS: readonly WithdrawFeeTier[] = [
  { feeCents: 500, upToCents: 100_000 }, // até R$ 1.000,00 → R$ 5,00
  { feeCents: 300, upToCents: 200_000 }, // até R$ 2.000,00 → R$ 3,00
  { feeCents: 200, upToCents: 300_000 }, // até R$ 3.000,00 → R$ 2,00
];

/** Saques a partir deste valor (centavos) são gratuitos. */
export const FREE_WITHDRAW_FROM_CENTS = 300_000; // R$ 3.000,00

/** Valor mínimo de saque, em centavos. */
export const MIN_WITHDRAW_CENTS = 2000; // R$ 20,00

/**
 * Fee for a withdrawal of `amountCents` (centavos), per DECISAO-003:
 * free at/above `FREE_WITHDRAW_FROM_CENTS`; otherwise the fee of the first
 * tier whose `upToCents >= amountCents`; above the last tier the last
 * tier's fee applies; no tiers → zero.
 */
export function computeWithdrawFee(amountCents: number): number {
  if (amountCents >= FREE_WITHDRAW_FROM_CENTS) {
    return 0;
  }
  const tier = WITHDRAW_FEE_TIERS.find((t) => amountCents <= t.upToCents);
  return tier?.feeCents ?? WITHDRAW_FEE_TIERS.at(-1)?.feeCents ?? 0;
}

/** Net amount transferred after the fee. */
export function computeLiquidAmountCents(
  amountCents: number,
  feeCents: number
): number {
  return amountCents - feeCents;
}

/**
 * Local idempotency key for a withdrawal request chain. The Woovi withdraw
 * endpoint accepts NO correlationID (payload is only `{ value }`), so
 * idempotency is enforced locally: the key is reserved on the `withdrawals`
 * row BEFORE any provider call, and a retry that reuses the key replays the
 * stored result instead of POSTing again. Format is namespaced per
 * organization so keys stay readable in the dashboard.
 */
export function generateWithdrawIdempotencyKey(organizationId: string): string {
  return `bropen:withdraw:${organizationId}:${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Withdrawal lifecycle (pending → completed | failed)
// ---------------------------------------------------------------------------

/** Status constants — single source of truth for transition guards. */
export const WITHDRAW_STATUS_PENDING = "pending" as const;
export const WITHDRAW_STATUS_COMPLETED = "completed" as const;
export const WITHDRAW_STATUS_FAILED = "failed" as const;

/** Shape of a `withdrawals` row as seen by the reservation decision. */
export type WithdrawalReservationRow = {
  failureReason: string | null;
  feeCents: number;
  liquidAmountCents: number;
  status: string;
  wooviWithdrawId?: string | null;
};

/**
 * Whether the row still represents an IN-FLIGHT withdrawal request: reserved
 * (pending) but the provider call has not returned an id yet.
 *
 * A pending row that ALREADY has `wooviWithdrawId` is an executed withdrawal
 * awaiting a possible `OPENPIX:MOVEMENT_FAILED` — it must NOT gate a new
 * withdrawal (BUG-0001: with completed rows staying pending, the org gate
 * would turn every second withdrawal into a silent replay).
 */
export function isPendingInFlight(
  row: WithdrawalReservationRow | null
): boolean {
  return (
    row !== null &&
    row.status === WITHDRAW_STATUS_PENDING &&
    !row.wooviWithdrawId
  );
}

/**
 * Reservation decision (idempotent replay vs fresh insert), pure so the
 * gate is unit-testable:
 *   - same `idempotencyKey` already reserved → replay that row (any status);
 *   - a different row is still IN-FLIGHT for the org (pending without a
 *     provider id) → replay it (blocks a second concurrent withdrawal);
 *   - otherwise → create a fresh row.
 * Returns the row to replay, or `null` to create.
 */
export function resolveWithdrawalReservation(args: {
  byKey: WithdrawalReservationRow | null;
  pendingForOrg: WithdrawalReservationRow | null;
}): WithdrawalReservationRow | null {
  if (args.byKey) {
    return args.byKey;
  }
  if (isPendingInFlight(args.pendingForOrg)) {
    return args.pendingForOrg;
  }
  return null;
}

/** A withdrawal can only be completed from `pending` (provider accepted the PIX out). */
export function canCompleteWithdrawal(currentStatus: string): boolean {
  return currentStatus === WITHDRAW_STATUS_PENDING;
}

/**
 * A withdrawal can be marked failed from `pending` (provider rejected the
 * PIX out) or `completed` (provider accepted, then the movement failed on
 * the SPI — `OPENPIX:MOVEMENT_FAILED`). Never from `failed`.
 */
export function canFailWithdrawal(currentStatus: string): boolean {
  return (
    currentStatus === WITHDRAW_STATUS_PENDING ||
    currentStatus === WITHDRAW_STATUS_COMPLETED
  );
}

// ---------------------------------------------------------------------------
// Fee collection lifecycle (BUG-0006)
// ---------------------------------------------------------------------------

/** Fee status constants — single source of truth for the fee sweep guards. */
export const WITHDRAW_FEE_STATUS_PENDING = "pending" as const;
export const WITHDRAW_FEE_STATUS_COLLECTED = "collected" as const;
export const WITHDRAW_FEE_STATUS_NOT_OWED = "not_owed" as const;

/**
 * Fee status of a freshly reserved row: a tiered fee is owed (debit pending);
 * free-tier withdrawals (feeCents 0) owe nothing.
 */
export function initialFeeStatus(feeCents: number): string {
  return feeCents > 0
    ? WITHDRAW_FEE_STATUS_PENDING
    : WITHDRAW_FEE_STATUS_NOT_OWED;
}

/**
 * Whether the fee sweep should retry this row's debit: only COMPLETED
 * withdrawals (PIX out executed, fee unambiguously owed) whose fee debit is
 * still pending. In-flight (pending) rows belong to the running action, and
 * failed rows owe nothing — the sweep must never debit those.
 */
export function isFeeCollectionDue(row: {
  feeStatus: string | null | undefined;
  status: string;
}): boolean {
  return (
    row.status === WITHDRAW_STATUS_COMPLETED &&
    row.feeStatus === WITHDRAW_FEE_STATUS_PENDING
  );
}

/**
 * Fee status to write when a withdrawal transitions to `failed`, or `null`
 * when nothing should change: a still-pending fee is no longer owed (the PIX
 * out failed / the movement returned), but an already-collected fee is kept
 * as-is (moved money is out of scope here — pre-existing semantics).
 */
export function feeStatusAfterFailure(
  currentFeeStatus: string | null | undefined
): string | null {
  return currentFeeStatus === WITHDRAW_FEE_STATUS_PENDING
    ? WITHDRAW_FEE_STATUS_NOT_OWED
    : null;
}
