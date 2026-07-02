/**
 * Abacate Pay webhook HTTP endpoint.
 *
 * This file contains ONLY the HTTP route: secret check, raw-body read,
 * signature verification (delegated to the domain), and dispatch to the
 * internal mutations (`markChargePaid` / `markChargeRefunded` /
 * `activateMembership`). All pure helpers (signature verification, event
 * payload types, event-name constants) live in `convex/domains/payment/`.
 *
 * @see https://docs.abacatepay.com/pages/webhooks
 */

import { CRPCError } from "kitcn/server";
import { internal } from "../_generated/api";
import {
  type AbacatePayWebhookPayload,
  TRANSPARENT_COMPLETED,
  TRANSPARENT_REFUNDED,
} from "../../domains/payment/webhook-events";
import { verifyWebhookSignature } from "../../domains/payment/webhook-signature";
import { getEnv } from "../../lib/get-env";
import { publicRoute, router } from "../../lib/crpc";

export const handleAbacatepayWebhook = publicRoute
  .post("/api/webhooks/abacatepay")
  .mutation(async ({ ctx, c }) => {
    // 1. Verify the webhook secret from the query parameter.
    const webhookSecret = getEnv().ABACATEPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Webhook secret not configured.",
      });
    }

    const url = new URL(c.req.url);
    const receivedSecret = url.searchParams.get("webhookSecret");
    if (!receivedSecret || receivedSecret !== webhookSecret) {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid webhook secret.",
      });
    }

    // 2. Read raw body for HMAC verification.
    const rawBody = await c.req.text();

    // 3. Verify HMAC-SHA256 signature (delegated to the domain).
    const signatureHeader = c.req.header("X-Webhook-Signature");
    if (!signatureHeader) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Missing signature header.",
      });
    }

    const valid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!valid) {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid signature.",
      });
    }

    // 4. Parse and dispatch the event.
    const payload = JSON.parse(rawBody) as AbacatePayWebhookPayload;

    // Payment confirmed → mark charge PAID + activate the membership.
    // We match the charge by `data.transparent.id` (the pix_char_* stored as
    // providerChargeId). The v2 API returns externalId = null for charges
    // created without an explicit customer (our case), so we cannot rely on
    // externalId — the previous implementation gated on it and silently
    // dropped every real webhook.
    if (payload.event === TRANSPARENT_COMPLETED) {
      const transparent = payload.data.transparent;
      if (transparent?.id) {
        const membershipId = await ctx.runMutation(
          internal.payment.charge.markChargePaid,
          {
            platformFee: transparent.platformFee ?? null,
            providerChargeId: transparent.id,
          }
        );

        if (membershipId) {
          await ctx.runMutation(internal.payment.charge.activateMembership, {
            membershipId,
          });
        }
      }
    }

    // Refund issued → mark charge REFUNDED locally so it stops showing as
    // PAID. Membership state is untouched (refund handling is a separate
    // concern — e.g. suspending the player is a product decision).
    if (payload.event === TRANSPARENT_REFUNDED) {
      const transparent = payload.data.transparent;
      if (transparent?.id) {
        await ctx.runMutation(internal.payment.charge.markChargeRefunded, {
          providerChargeId: transparent.id,
        });
      }
    }

    // Always return 200 OK — even for unhandled events.
    // Per AbacatePay docs, returning 200 prevents retries.
    return c.text("OK", 200);
  });

// ---------------------------------------------------------------------------
// Router (grouped under `payment` namespace)
// ---------------------------------------------------------------------------

export const paymentWebhookRouter = router({
  handleAbacatepayWebhook,
});
