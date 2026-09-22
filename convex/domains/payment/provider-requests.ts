/**
 * Woovi subaccount request contracts, shared by the outbound actions and the
 * webhook matcher. `{id}` on both endpoints is the PIX key registered on the
 * subaccount, and the withdraw is PARTIAL: its payload has no `splits` and no
 * `correlationID`.
 */

export const DEBIT_FEE_DESCRIPTION = "Taxa de saque BR-Open";

/**
 * Canonical provider id of a withdrawal movement: `correlationID` falling back
 * to `endToEndId`. Both sides of the match must keep this precedence — storing
 * it one way and looking it up the other makes `OPENPIX:MOVEMENT_FAILED` miss
 * rows that carry both fields.
 */
export function resolveWithdrawalProviderId(tx: {
  correlationID?: string;
  endToEndId?: string;
}): string | null {
  return tx.correlationID ?? tx.endToEndId ?? null;
}

export type ProviderRequest = {
  path: string;
  body: unknown;
};

/**
 * Partial withdrawal: `valueCents` is the NET amount the organizer receives on
 * the registered key; the fee is collected separately by the debit.
 */
export function buildWithdrawRequest(
  pixKey: string,
  valueCents: number
): ProviderRequest {
  return {
    body: { value: valueCents },
    path: `/api/v1/subaccount/${encodeURIComponent(pixKey)}/withdraw`,
  };
}

/**
 * Fee debit: moves the fee from the organizer's subaccount to BR-Open's main
 * account. The endpoint takes no idempotency id, so retries are guarded by the
 * withdrawal row reserved before any provider call.
 */
export function buildDebitRequest(
  pixKey: string,
  valueCents: number
): ProviderRequest {
  return {
    body: { description: DEBIT_FEE_DESCRIPTION, value: valueCents },
    path: `/api/v1/subaccount/${encodeURIComponent(pixKey)}/debit`,
  };
}

/**
 * 20s covers the provider's usual ~1-2s while a hung call can't pin a Convex
 * action for minutes — the org stays gated behind its reservation until then.
 */
export const PROVIDER_FETCH_TIMEOUT_MS = 20_000;

/**
 * `fetch` bounded by `AbortSignal.timeout`. A timeout rejects with a legible
 * pt-BR `Error` for the caller's failure path; other network errors are
 * rethrown untouched. On a money-moving POST the outcome is ambiguous (the
 * provider may have processed it), so callers treat any throw as failure and
 * rely on their local retry guards.
 */
export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = PROVIDER_FETCH_TIMEOUT_MS
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        `Provedor de pagamento não respondeu em ${timeoutMs / 1000}s (timeout).`
      );
    }
    throw error;
  }
}
