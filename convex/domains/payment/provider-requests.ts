/**
 * Provider (Woovi) request contracts for subaccount withdrawals — pure
 * functions only, so the request shapes are unit-testable and shared
 * between the outbound actions (providerNode.ts) and the webhook
 * matcher (webhook.ts).
 *
 * Source of truth (official docs, confirmed 2026-08-10):
 * - `POST /api/v1/subaccount/{id}/withdraw` — `id` is the PIX key
 *   registered on the subaccount ("pix key registered to the subaccount",
 *   OpenAPI: developers.woovi.com/api#tag/sub-account). Body is
 *   `{ value }` in cents for a PARTIAL withdrawal; the payload schema
 *   (`SubAccountWithdrawPayload`) has NO `splits` and NO `correlationID`.
 * - `POST /api/v1/subaccount/{id}/debit` — "Transfers the amount from the
 *   subaccount to the main account" (`{ value }` in cents). This is how the
 *   withdrawal fee reaches BR-Open's account: the main account already
 *   receives the charge split remainder, so a debit keeps the fee in the
 *   same place.
 * - Response ids: the withdraw response carries `transaction.correlationID`
 *   (provider-generated) and `OPENPIX:MOVEMENT_FAILED` webhooks echo the
 *   failed movement as `payment.correlationID` — correlationID is the
 *   canonical match key; endToEndId is a fallback only.
 */

/** Human-legible description sent on the fee debit (Woovi dashboard). */
export const DEBIT_FEE_DESCRIPTION = "Taxa de saque BR-Open";

/**
 * Canonical provider id for a withdrawal movement: `correlationID` wins,
 * `endToEndId` is the fallback. MUST be used on BOTH sides of the match —
 * storing the id with a different precedence than the webhook lookup makes
 * `OPENPIX:MOVEMENT_FAILED` miss pending withdrawals that carry both fields
 * (found in code review 2026-08-10).
 */
export function resolveWithdrawalProviderId(tx: {
  correlationID?: string;
  endToEndId?: string;
}): string | null {
  return tx.correlationID ?? tx.endToEndId ?? null;
}

/** Outbound request descriptor for a provider call. */
export type ProviderRequest = {
  path: string;
  body: unknown;
};

/**
 * Partial withdrawal request. The caller passes the NET amount — the
 * organizer receives exactly `value` on the pix key registered on the
 * subaccount, and the fee is collected separately via the debit
 * (DECISAO-003, decision 2026-08-10).
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
 * Fee debit request: moves the fee from the organizer's subaccount to
 * BR-Open's main account (the same account that receives the charge split
 * remainder). The debit endpoint supports no idempotency id, so retries are
 * guarded locally (withdrawal row reserved before any provider call).
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

// ---------------------------------------------------------------------------
// Outbound fetch with a hard timeout (BUG-0007)
// ---------------------------------------------------------------------------

/**
 * Hard timeout for provider calls. The Woovi API answers in ~1-2s; 20s
 * covers slow spikes while keeping a hung provider from pinning a Convex
 * action for minutes (the action runtime cap would eventually kill it, but
 * the org stays gated behind a pending reservation until then).
 */
export const PROVIDER_FETCH_TIMEOUT_MS = 20_000;

/**
 * `fetch` with `AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS)` (BUG-0007).
 * A timeout rejects with a legible pt-BR `Error` so callers' existing
 * failure paths (failWithdrawal / cron error logs) surface something the
 * organizer can read. Any other network error is rethrown untouched.
 *
 * NOTE: a timeout on a money-moving POST (withdraw/debit) is an ambiguous
 * outcome — the provider may have processed it. Callers already treat any
 * throw as failure and guard retries locally (reserved row / feeStatus);
 * this only bounds how long they wait.
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
