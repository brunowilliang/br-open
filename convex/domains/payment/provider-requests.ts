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

/** `DELETE /api/v1/charge/{id}` com o NOSSO `correlationID` (o `transactionID`
 * responde "não encontrada"). O 2xx ja prova o cancelamento; quando ele nao vem,
 * o desfecho e decidido pelo probe de status (cancel-rules.ts). */
export function buildChargeDeleteRequest(
  correlationId: string
): ProviderRequest {
  return {
    body: null,
    path: `/api/v1/charge/${encodeURIComponent(correlationId)}`,
  };
}

/** Mensagem de erro da Woovi nos formatos conhecidos: `error` string,
 * `error.description`/`error.message` (o do DELETE) ou `message`. */
export function providerErrorMessage(body: unknown): null | string {
  if (typeof body === "string") {
    return body;
  }
  if (!body || typeof body !== "object") {
    return null;
  }

  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const nested = error as { description?: unknown; message?: unknown };
    if (typeof nested.description === "string") {
      return nested.description;
    }
    if (typeof nested.message === "string") {
      return nested.message;
    }
  }

  return typeof message === "string" ? message : null;
}

/** "Cobrança não encontrada" e o unico sinal de que a cobranca nao existe mais
 * no provedor — 400 de DELETE, 400 de GET e 404 de outros recursos. */
export function isProviderMissingMessage(message: null | string): boolean {
  return message !== null && /n[ãa]o\s+encontrad/i.test(message);
}

/** O 400 "ja reembolsou todo o valor" e CONFIRMACAO do estorno, nao falha. */
const ALREADY_REFUNDED_CORE = "reembolsou todo o valor";

export function isAlreadyRefundedMessage(message: null | string): boolean {
  return (
    message
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .includes(ALREADY_REFUNDED_CORE) ?? false
  );
}

export function resolveRefundResponseOutcome(input: {
  errorMessage?: null | string;
  ok: boolean;
  providerStatus?: null | string;
}): { error: string } | { status: string } {
  if (input.ok) {
    return { status: input.providerStatus ?? "IN_PROCESSING" };
  }
  return isAlreadyRefundedMessage(input.errorMessage ?? null)
    ? { status: "CONFIRMED" }
    : { error: input.errorMessage ?? "Estorno recusado pelo provedor." };
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
