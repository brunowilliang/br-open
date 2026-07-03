"use node";

/**
 * Woovi outbound API operations, running on the Convex Node.js action runtime.
 *
 * This file has `"use node"` at the top and contains ONLY actions. It is the
 * ONLY place that imports `@woovi/node-sdk` (which depends on `node:crypto`).
 *
 * CRITICAL: callers must invoke these via `ctx.runAction(internal.payment.wooviNode.*)`
 * — they must NOT import this file or its generated caller (`createPaymentWooviNodeCaller`),
 * because importing a `"use node"` file from a non-`"use node"` file breaks Convex
 * bundling. `ctx.runAction` crosses the runtime boundary cleanly.
 *
 * Inbound webhook verification still lives in `webhook-signature.ts` (Web Crypto)
 * because the kitcn `publicRoute` HTTP handler runs in the V8 isolate.
 */

import WooviSDK from "@woovi/node-sdk";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import { getEnv } from "../../lib/get-env";
import { privateAction } from "../../lib/crpc";

function wooviClient() {
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
    const client = wooviClient();
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
      console.error("[wooviNode] subAccount.create unexpected response:", body);
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
    const client = wooviClient();
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
