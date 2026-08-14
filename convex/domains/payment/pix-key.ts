/**
 * Masks a pix key for display: keeps the first 2 and last 2 characters,
 * replacing the middle with `*` (capped at 8 stars). Short keys (≤ 4
 * characters) are returned verbatim.
 *
 * Shared by `payment.onboarding.getStatus` and `payment.withdraw.getBalance`
 * so the withdraw destination never exposes the full key.
 */
export function maskPixKey(key: string): string {
  if (key.length <= 4) {
    return key;
  }
  return `${key.slice(0, 2)}${"*".repeat(Math.min(key.length - 4, 8))}${key.slice(-2)}`;
}
