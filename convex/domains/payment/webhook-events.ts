/**
 * Abacate Pay v2 webhook event payload types.
 *
 * Source of truth: official webhook docs + observed real payloads.
 *
 * IMPORTANT: the published `@abacatepay/types/v2` is STALE for webhooks —
 * it only models `billing.paid` / `payout.*` (v1 event names). The real v2
 * event names are `transparent.*`, `checkout.*`, `subscription.*`,
 * `transfer.*`, `payout.*`. Do NOT trust the package's `WebhookEvent`
 * type for v2 webhook routing.
 *
 * @see https://docs.abacatepay.com/pages/webhooks
 */

// ---------------------------------------------------------------------------
// Event name constants — single source of truth.
// ---------------------------------------------------------------------------

export const TRANSPARENT_COMPLETED = "transparent.completed" as const;
export const TRANSPARENT_REFUNDED = "transparent.refunded" as const;
export const TRANSPARENT_DISPUTED = "transparent.disputed" as const;

export const CHECKOUT_COMPLETED = "checkout.completed" as const;
export const CHECKOUT_REFUNDED = "checkout.refunded" as const;
export const CHECKOUT_DISPUTED = "checkout.disputed" as const;

export const SUBSCRIPTION_COMPLETED = "subscription.completed" as const;
export const SUBSCRIPTION_CANCELLED = "subscription.cancelled" as const;
export const SUBSCRIPTION_RENEWED = "subscription.renewed" as const;

export const TRANSFER_COMPLETED = "transfer.completed" as const;
export const TRANSFER_FAILED = "transfer.failed" as const;

export const PAYOUT_COMPLETED = "payout.completed" as const;
export const PAYOUT_FAILED = "payout.failed" as const;

// ---------------------------------------------------------------------------
// Payload shapes — only the fields we actually read.
// ---------------------------------------------------------------------------

export type TransparentCompletedPayload = {
  event: typeof TRANSPARENT_COMPLETED;
  data: {
    transparent: {
      id: string;
      externalId: null | string;
      amount: number;
      paidAmount: null | number;
      platformFee: null | number;
      status: string;
      metadata?: null | Record<string, unknown>;
    };
  };
};

export type TransparentRefundedPayload = {
  event: typeof TRANSPARENT_REFUNDED;
  data: {
    transparent: {
      id: string;
      status: string;
    };
  };
};

/**
 * Catch-all for events we acknowledge but don't process. Using a closed
 * union (not `string`) lets TS narrow the `transparent.*` variants above
 * by the literal `event` value.
 */
export type OtherEventPayload = {
  data?: unknown;
  event:
    | typeof CHECKOUT_COMPLETED
    | typeof CHECKOUT_REFUNDED
    | typeof CHECKOUT_DISPUTED
    | typeof TRANSPARENT_DISPUTED
    | typeof SUBSCRIPTION_COMPLETED
    | typeof SUBSCRIPTION_CANCELLED
    | typeof SUBSCRIPTION_RENEWED
    | typeof TRANSFER_COMPLETED
    | typeof TRANSFER_FAILED
    | typeof PAYOUT_COMPLETED
    | typeof PAYOUT_FAILED;
};

/**
 * Any inbound AbacatePay v2 webhook. Narrow with `payload.event === ...`
 * before reading `payload.data`.
 */
export type AbacatePayWebhookPayload =
  | OtherEventPayload
  | TransparentCompletedPayload
  | TransparentRefundedPayload;
