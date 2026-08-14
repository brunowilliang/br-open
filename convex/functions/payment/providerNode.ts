"use node";

/**
 * Payment provider outbound API operations, running on the Convex Node.js
 * action runtime.
 *
 * This file has `"use node"` at the top and contains ONLY actions. It is the
 * ONLY place that imports `@woovi/node-sdk` (which depends on `node:crypto`).
 *
 * CRITICAL: callers must invoke these via `ctx.runAction(internal.payment.providerNode.*)`
 * — they must NOT import this file or its generated caller, because importing
 * a `"use node"` file from a non-`"use node"` file breaks Convex bundling.
 * `ctx.runAction` crosses the runtime boundary cleanly.
 *
 * Inbound webhook verification still lives in `webhook-signature.ts` (Web
 * Crypto) because the kitcn `publicRoute` HTTP handler runs in the V8 isolate.
 */

import WooviSDK from "@woovi/node-sdk";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import {
  buildDebitRequest,
  buildWithdrawRequest,
  providerFetch,
  resolveWithdrawalProviderId,
} from "../../domains/payment/provider-requests";
import { getEnv } from "../../lib/get-env";
import { privateAction } from "../../lib/crpc";

function providerClient() {
  const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
  if (!WOOVI_APP_ID) {
    throw new CRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "WOOVI_APP_ID must be configured.",
    });
  }
  return WooviSDK.createClient({
    appId: WOOVI_APP_ID,
    baseUrl: WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com",
  });
}

/**
 * Fetches the current status of a charge from the provider by correlationID.
 * Used by the reconciliation cron to catch payments that succeeded on the
 * provider side but whose webhook delivery was missed.
 *
 * Uses raw REST (not the SDK) because the SDK's `charge.get` typing doesn't
 * match the live API (same divergence pattern as the subaccount PascalCase
 * issue). The REST endpoint `GET /api/v1/charge/{correlationID}` was
 * validated in the 2026-07-02 PoC.
 */
export const getChargeStatusAction = privateAction
  .input(z.object({ correlationId: z.string().min(1) }))
  .output(z.object({ status: z.string() }))
  .action(async ({ input }) => {
    const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
    if (!WOOVI_APP_ID) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "WOOVI_APP_ID must be configured.",
      });
    }
    const baseUrl = WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com";
    const response = await providerFetch(
      `${baseUrl}/api/v1/charge/${input.correlationId}`,
      {
        headers: {
          Authorization: WOOVI_APP_ID,
        },
      }
    );
    if (!response.ok) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Provider returned ${response.status}`,
      });
    }
    const data = (await response.json()) as {
      charge?: { status?: string };
    };
    return { status: data?.charge?.status ?? "ACTIVE" };
  });

// ---------------------------------------------------------------------------
// Subaccount provisioning
// ---------------------------------------------------------------------------

export const createSubaccountAction = privateAction
  .input(
    z.object({
      name: z.string().min(1),
      pixKey: z.string().min(1),
    })
  )
  .output(
    z.object({
      name: z.string(),
      pixKey: z.string(),
    })
  )
  .action(async ({ input }) => {
    const client = providerClient();
    const response = await client.subAccount.create({
      name: input.name,
      pixKey: input.pixKey,
    });

    // The Woovi SDK types declare `response.SubAccount` (PascalCase), but the
    // live API actually returns `response.subAccount` (camelCase). Accept both.
    const sub =
      response?.SubAccount ??
      ((response as Record<string, unknown>)?.subAccount as
        | { name: string; pixKey: string }
        | undefined);
    if (!sub) {
      const body = JSON.stringify(response);
      console.error(
        "[providerNode] subAccount.create unexpected response:",
        body
      );
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível conectar a conta de pagamento.",
      });
    }

    return {
      name: sub.name,
      pixKey: sub.pixKey,
    };
  });

// ---------------------------------------------------------------------------
// Charge creation with split
// ---------------------------------------------------------------------------

export const createChargeWithSplitAction = privateAction
  .input(
    z.object({
      amountCents: z.number().int().positive(),
      comment: z.string(),
      correlationId: z.string().min(1),
      expiresInSeconds: z.number().int().positive(),
      organizerCents: z.number().int().nonnegative(),
      recipientPixKey: z.string().min(1),
    })
  )
  .output(
    z.object({
      brCode: z.string(),
      correlationId: z.string(),
      expiresDate: z.string().nullable(),
      paymentLinkUrl: z.string(),
      qrCodeImage: z.string(),
      status: z.string(),
      transactionID: z.string(),
      value: z.number(),
    })
  )
  .action(async ({ input }) => {
    const client = providerClient();
    const response = await client.charge.create({
      comment: input.comment,
      correlationID: input.correlationId,
      expiresIn: input.expiresInSeconds,
      splits: [
        {
          pixKey: input.recipientPixKey,
          splitType: "SPLIT_SUB_ACCOUNT",
          value: input.organizerCents,
        },
      ],
      value: input.amountCents,
    });
    const charge = response.charge;
    return {
      brCode: charge.brCode ?? "",
      correlationId: charge.correlationID,
      expiresDate: charge.expiresDate ?? null,
      paymentLinkUrl: charge.paymentLinkUrl ?? "",
      qrCodeImage: charge.qrCodeImage ?? "",
      status: charge.status ?? "ACTIVE",
      transactionID: charge.transactionID ?? "",
      value: charge.value,
    };
  });

// ---------------------------------------------------------------------------
// Subaccount balance & withdrawal
// ---------------------------------------------------------------------------

/**
 * Legible pt-BR messages for known withdrawal failure codes (Woovi docs:
 * "Tratamento de erros" — saque de subconta). Anything unknown falls back
 * to the raw description/code, never "[object Object]" (BUG-002 lesson).
 */
const WITHDRAW_ERROR_MESSAGES: Record<string, string> = {
  ENTRY_ASSOCIATED_WITH_RESTRICTED_ACCOUNT_OR_USER:
    "A conta da chave PIX está restrita por fraude (Banco Central).",
  INVALID_PIX_KEY: "A chave PIX da subconta é inválida.",
  NOT_ENOUGH_BALANCE: "Saldo insuficiente na subconta.",
  PIX_KEY_INFO_NOT_FOUND:
    "A chave PIX da subconta não está registrada em nenhum banco.",
};

async function toLegibleProviderError(response: Response): Promise<string> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON — fall through to the generic message.
  }
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") {
    return WITHDRAW_ERROR_MESSAGES[error] ?? error;
  }
  if (error !== null && typeof error === "object") {
    const e = error as {
      code?: unknown;
      description?: unknown;
      message?: unknown;
    };
    const code = typeof e.code === "string" ? e.code : undefined;
    const description =
      typeof e.description === "string"
        ? e.description
        : typeof e.message === "string"
          ? e.message
          : undefined;
    if (description) {
      return description;
    }
    if (code) {
      return WITHDRAW_ERROR_MESSAGES[code] ?? code;
    }
  }
  if (body !== null) {
    try {
      return JSON.stringify(body);
    } catch {
      // Circular/odd payload — fall through.
    }
  }
  return `Erro do provedor de pagamento (HTTP ${response.status}).`;
}

/**
 * Fetches the real subaccount balance + withdrawal-block flag from the
 * provider. `GET /api/v1/subaccount/{pixKey}` — the path param is the PIX
 * key registered on the subaccount (official docs:
 * developers.woovi.com/docs/subaccount/how-to-get-balance-and-details-of-subaccount-using-api).
 * The API returns `subAccount` (camelCase) — accept PascalCase too.
 */
export const getSubaccountBalanceAction = privateAction
  .input(z.object({ pixKey: z.string().min(1) }))
  .output(
    z.object({
      balanceCents: z.number().int().nonnegative(),
      withdrawBlocked: z.boolean(),
    })
  )
  .action(async ({ input }) => {
    const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
    if (!WOOVI_APP_ID) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "WOOVI_APP_ID must be configured.",
      });
    }
    const baseUrl = WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com";
    const response = await providerFetch(
      `${baseUrl}/api/v1/subaccount/${encodeURIComponent(input.pixKey)}`,
      { headers: { Authorization: WOOVI_APP_ID } }
    );
    if (!response.ok) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: await toLegibleProviderError(response),
      });
    }
    const data = (await response.json()) as {
      SubAccount?: { balance?: number; withdrawBlocked?: boolean };
      subAccount?: { balance?: number; withdrawBlocked?: boolean };
    };
    const sub = data.subAccount ?? data.SubAccount;
    if (!sub) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Resposta inesperada da Woovi ao consultar a subconta.",
      });
    }
    return {
      balanceCents: typeof sub.balance === "number" ? sub.balance : 0,
      withdrawBlocked: Boolean(sub.withdrawBlocked),
    };
  });

/**
 * Requests a PARTIAL withdrawal from the organization's subaccount to the
 * PIX key registered on it. `POST /api/v1/subaccount/{pixKey}/withdraw`
 * with `{ value }` in cents — the path param is the pix key registered on
 * the subaccount and the payload supports NO splits and NO correlationID
 * (official docs: developers.woovi.com/docs/subaccount/how-to-withdraw-from-subaccount-using-api
 * + OpenAPI `SubAccountWithdrawPayload`).
 *
 * DECISAO-003 (fee collection): the caller passes the NET amount — the
 * organizer receives exactly `valueCents` on their registered pix key and
 * the tiered fee is collected separately via `debitSubaccountAction`
 * (subaccount → BR-Open main account).
 *
 * The returned `transactionId` uses `correlationID` first and `endToEndId`
 * as fallback (same precedence as the webhook matcher — the official
 * `OPENPIX:MOVEMENT_FAILED` payload echoes `payment.correlationID`).
 */
export const withdrawSubaccountAction = privateAction
  .input(
    z.object({
      pixKey: z.string().min(1),
      valueCents: z.number().int().positive(),
    })
  )
  .output(
    z.object({
      status: z.string(),
      transactionId: z.string().nullable(),
    })
  )
  .action(async ({ input }) => {
    const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
    if (!WOOVI_APP_ID) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "WOOVI_APP_ID must be configured.",
      });
    }
    const baseUrl = WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com";
    const request = buildWithdrawRequest(input.pixKey, input.valueCents);
    const response = await providerFetch(`${baseUrl}${request.path}`, {
      body: JSON.stringify(request.body),
      headers: {
        Authorization: WOOVI_APP_ID,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: await toLegibleProviderError(response),
      });
    }
    const data = (await response.json()) as {
      transaction?: {
        correlationID?: string;
        endToEndId?: string;
        status?: string;
      };
      withdraw?: {
        transaction?: {
          correlationID?: string;
          endToEndId?: string;
          status?: string;
        };
      };
    };
    const tx = data.transaction ?? data.withdraw?.transaction;
    if (!tx) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Resposta inesperada da Woovi ao sacar.",
      });
    }
    return {
      status: tx.status ?? "CREATED",
      transactionId: resolveWithdrawalProviderId(tx),
    };
  });

/**
 * Collects the withdrawal fee for BR-Open: `POST /api/v1/subaccount/{pixKey}/debit`
 * moves `valueCents` from the organizer's subaccount to the MAIN account —
 * the same account that already receives the charge split remainder
 * (official docs: developers.woovi.com/api — "Transfers the amount from the
 * subaccount to the main account"). The endpoint supports no idempotency id,
 * so callers MUST guard retries locally (reserved withdrawal row).
 */
export const debitSubaccountAction = privateAction
  .input(
    z.object({
      pixKey: z.string().min(1),
      valueCents: z.number().int().positive(),
    })
  )
  .output(z.object({ value: z.number().int().nonnegative() }))
  .action(async ({ input }) => {
    const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
    if (!WOOVI_APP_ID) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "WOOVI_APP_ID must be configured.",
      });
    }
    const baseUrl = WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com";
    const request = buildDebitRequest(input.pixKey, input.valueCents);
    const response = await providerFetch(`${baseUrl}${request.path}`, {
      body: JSON.stringify(request.body),
      headers: {
        Authorization: WOOVI_APP_ID,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: await toLegibleProviderError(response),
      });
    }
    const data = (await response.json()) as {
      pixKey?: string;
      value?: number;
      success?: string;
    };
    if (typeof data.value !== "number") {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Resposta inesperada da Woovi ao debitar a taxa.",
      });
    }
    return { value: data.value };
  });
