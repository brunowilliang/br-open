/**
 * Withdrawal rules. The fee table lives in the backend and is exposed through
 * `payment/withdraw:getBalance` (never hardcoded on the frontend); the frontend
 * mirrors this logic in `src/lib/withdraw/calculations.ts` (keep both in sync).
 */

export type WithdrawFeeTier = { upToCents: number; feeCents: number };

/** Ordered by `upToCents` ascending; the fee is that of the first tier whose
 * `upToCents >= amountCents`, the last tier acting as the cap above it. */
export const WITHDRAW_FEE_TIERS: readonly WithdrawFeeTier[] = [
  { feeCents: 500, upToCents: 100_000 }, // até R$ 1.000,00 → R$ 5,00
  { feeCents: 300, upToCents: 200_000 }, // até R$ 2.000,00 → R$ 3,00
  { feeCents: 200, upToCents: 300_000 }, // até R$ 3.000,00 → R$ 2,00
];

export const FREE_WITHDRAW_FROM_CENTS = 300_000; // R$ 3.000,00

export const MIN_WITHDRAW_CENTS = 2000; // R$ 20,00

export function computeWithdrawFee(amountCents: number): number {
  if (amountCents >= FREE_WITHDRAW_FROM_CENTS) {
    return 0;
  }
  const tier = WITHDRAW_FEE_TIERS.find((t) => amountCents <= t.upToCents);
  return tier?.feeCents ?? WITHDRAW_FEE_TIERS.at(-1)?.feeCents ?? 0;
}

export function computeLiquidAmountCents(
  amountCents: number,
  feeCents: number
): number {
  return amountCents - feeCents;
}

/** The withdraw endpoint accepts no correlationID, so idempotency is local: the
 * key is reserved on the `withdrawals` row before any provider call, and a retry
 * replays the stored result instead of POSTing again. */
export function generateWithdrawIdempotencyKey(organizationId: string): string {
  return `bropen:withdraw:${organizationId}:${crypto.randomUUID()}`;
}

export const WITHDRAW_STATUS_PENDING = "pending" as const;
export const WITHDRAW_STATUS_COMPLETED = "completed" as const;
export const WITHDRAW_STATUS_FAILED = "failed" as const;

export type WithdrawalReservationRow = {
  failureReason: string | null;
  feeCents: number;
  liquidAmountCents: number;
  status: string;
  wooviWithdrawId?: string | null;
};

/** In flight = reserved (pending) without a provider id yet. A pending row that
 * already has `wooviWithdrawId` is an executed withdrawal awaiting a possible
 * `OPENPIX:MOVEMENT_FAILED`: it must NOT gate a new one (silent replay). */
export function isPendingInFlight(
  row: WithdrawalReservationRow | null
): boolean {
  return (
    row !== null &&
    row.status === WITHDRAW_STATUS_PENDING &&
    !row.wooviWithdrawId
  );
}

/** Replays `byKey` whenever that chain was already reserved (any status), else
 * replays `pendingForOrg` while it is still in flight — which blocks a second
 * concurrent withdrawal. `null` means create a fresh row. */
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

export function canCompleteWithdrawal(currentStatus: string): boolean {
  return currentStatus === WITHDRAW_STATUS_PENDING;
}

/** From `pending` or `completed` (accepted, then the movement failed on the
 * SPI) — never from `failed`. */
export function canFailWithdrawal(currentStatus: string): boolean {
  return (
    currentStatus === WITHDRAW_STATUS_PENDING ||
    currentStatus === WITHDRAW_STATUS_COMPLETED
  );
}

export const WITHDRAW_FEE_STATUS_PENDING = "pending" as const;
export const WITHDRAW_FEE_STATUS_COLLECTED = "collected" as const;
export const WITHDRAW_FEE_STATUS_NOT_OWED = "not_owed" as const;

export function initialFeeStatus(feeCents: number): string {
  return feeCents > 0
    ? WITHDRAW_FEE_STATUS_PENDING
    : WITHDRAW_FEE_STATUS_NOT_OWED;
}

/** Only completed withdrawals with a pending fee debit: in-flight rows belong to
 * the running action and failed rows owe nothing, so the sweep must never debit
 * either. */
export function isFeeCollectionDue(row: {
  feeStatus: string | null | undefined;
  status: string;
}): boolean {
  return (
    row.status === WITHDRAW_STATUS_COMPLETED &&
    row.feeStatus === WITHDRAW_FEE_STATUS_PENDING
  );
}

/** `null` when nothing should change: a still-pending fee stops being owed once
 * the PIX out fails, while an already-collected fee stays as-is (money already
 * moved). */
export function feeStatusAfterFailure(
  currentFeeStatus: string | null | undefined
): string | null {
  return currentFeeStatus === WITHDRAW_FEE_STATUS_PENDING
    ? WITHDRAW_FEE_STATUS_NOT_OWED
    : null;
}
