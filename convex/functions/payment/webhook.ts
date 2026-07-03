/**
 * Woovi (OpenPix) webhook HTTP endpoint.
 *
 * Verifies the HMAC-SHA256 signature (header `x-webhook-signature`, secret
 * from `WOOVI_WEBHOOK_SECRET`), then dispatches via ctx.runMutation:
 *   OPENPIX:TRANSACTION_RECEIVED -> applyPaidCharge (atomic)
 *   OPENPIX:CHARGE_COMPLETED    -> applyPaidCharge (atomic)
 *   OPENPIX:CHARGE_EXPIRED      -> markChargeExpired
 *
 * Always returns 200 OK to prevent Woovi retries (per the docs).
 *
 * @see https://developers.woovi.com/docs/tags/webhook
 */

import { CRPCError } from "kitcn/server";
import {
  type WooviWebhookPayload,
  OPENPIX_CHARGE_COMPLETED,
  OPENPIX_CHARGE_EXPIRED,
  OPENPIX_TRANSACTION_RECEIVED,
} from "../../domains/payment/webhook-events";
import { verifyWooviWebhookSignature } from "../../domains/payment/webhook-signature";
import { publicRoute, router } from "../../lib/crpc";
import { internal } from "../_generated/api";

export const handleWooviWebhook = publicRoute
  .post("/api/webhooks/woovi")
  .mutation(async ({ ctx, c }) => {
    // No per-merchant secret: Woovi signs with RSA-SHA256 using their
    // fixed public key (see webhook-signature.ts). The signature alone proves
    // the request came from Woovi.
    const rawBody = await c.req.text();
    const signatureHeader =
      c.req.header("x-webhook-signature") ??
      c.req.header("X-Webhook-Signature");
    if (!signatureHeader) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Missing signature header.",
      });
    }

    const valid = await verifyWooviWebhookSignature(rawBody, signatureHeader);
    if (!valid) {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid signature.",
      });
    }

    const payload = JSON.parse(rawBody) as WooviWebhookPayload;

    if (
      (payload.event === OPENPIX_TRANSACTION_RECEIVED ||
        payload.event === OPENPIX_CHARGE_COMPLETED) &&
      "charge" in payload &&
      payload.charge?.correlationID
    ) {
      await ctx.runMutation(internal.payment.charge.applyPaidCharge, {
        correlationId: payload.charge.correlationID,
        wooviTransactionStatus:
          "transaction" in payload ? payload.transaction?.status : undefined,
      });
    }

    if (
      payload.event === OPENPIX_CHARGE_EXPIRED &&
      "charge" in payload &&
      payload.charge?.correlationID
    ) {
      await ctx.runMutation(internal.payment.charge.markChargeExpired, {
        correlationId: payload.charge.correlationID,
      });
    }

    return c.text("OK", 200);
  });

export const paymentWebhookRouter = router({
  handleWooviWebhook,
});
