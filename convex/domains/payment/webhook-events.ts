/**
 * Woovi (OpenPix) webhook event payload types.
 *
 * Source of truth: developers.woovi.com/docs/tags/webhook + the recovered
 * `woovi-client.ts@572dc61` design intent. Real payloads will be captured
 * end-to-end in the Phase 1.5 manual validation step (once a tunnel is up);
 * the shapes here are derived from the Woovi docs and may be tightened then.
 *
 * Woovi event names use the `OPENPIX:*` prefix (the previous AbacatePay
 * migration used `transparent.*`). Webhook routing keys off `event`.
 *
 * @see https://developers.woovi.com/docs/tags/webhook
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Event name constants — single source of truth.
// ---------------------------------------------------------------------------

/**
 * Fired when a PIX payment is received for a charge. Payload includes the
 * charge (with `correlationID` — our idempotency key) and the transaction
 * details. This is the "paid" signal.
 */
export const OPENPIX_TRANSACTION_RECEIVED =
  "OPENPIX:TRANSACTION_RECEIVED" as const;

/**
 * Fired when a charge expires unpaid. We mirror it locally and notify the
 * player to generate a new PIX.
 */
export const OPENPIX_CHARGE_EXPIRED = "OPENPIX:CHARGE_EXPIRED" as const;

/**
 * Fired when a charge is completed (often paired with TRANSACTION_RECEIVED).
 * Treated as an alias of TRANSACTION_RECEIVED for activation purposes —
 * idempotency is enforced by the `status === "PAID"` short-circuit.
 */
export const OPENPIX_CHARGE_COMPLETED = "OPENPIX:CHARGE_COMPLETED" as const;

/**
 * Catch-all for events we acknowledge but don't process. Using a closed
 * union (not `string`) lets TS narrow the handled variants above by the
 * literal `event` value.
 */
export type OtherWooviEventPayload = {
  data?: unknown;
  event: string;
};

export type TransactionReceivedPayload = {
  event: typeof OPENPIX_TRANSACTION_RECEIVED;
  // Woovi wraps the relevant entities under `charge` and `transaction`.
  // We only read `charge.correlationID` (our idempotency key) and the
  // transaction's end-to-end identifier for reconciliation.
  charge: {
    correlationID: string;
    status: string;
    value: number;
  };
  transaction?: {
    status?: string;
    value?: number;
    // PIX end-to-end id (also exposed as `e2eId` on some payloads). Captured
    // as `wooviTransactionId` when the webhook confirms payment.
    transactionID?: string;
    e2eId?: string;
  };
};

export type ChargeExpiredPayload = {
  event: typeof OPENPIX_CHARGE_EXPIRED;
  charge: {
    correlationID: string;
    status: string;
  };
};

export type ChargeCompletedPayload = {
  event: typeof OPENPIX_CHARGE_COMPLETED;
  charge: {
    correlationID: string;
    status: string;
    value: number;
  };
  transaction?: {
    status?: string;
    value?: number;
    transactionID?: string;
    e2eId?: string;
  };
};

/**
 * Any inbound Woovi webhook. Narrow with `payload.event === ...` before
 * reading `payload.charge` / `payload.transaction`.
 */
export type WooviWebhookPayload =
  | OtherWooviEventPayload
  | TransactionReceivedPayload
  | ChargeExpiredPayload
  | ChargeCompletedPayload;

// ---------------------------------------------------------------------------
// Runtime validators — used by webhook.ts to parse incoming payloads safely.
// ---------------------------------------------------------------------------

const chargeBaseSchema = z.object({
  correlationID: z.string().min(1),
  status: z.string(),
});

const chargeWithValueSchema = chargeBaseSchema.extend({
  value: z.number(),
});

const transactionSchema = z
  .object({
    e2eId: z.string().optional(),
    status: z.string().optional(),
    transactionID: z.string().optional(),
    value: z.number().optional(),
  })
  .optional();

const transactionReceivedPayloadSchema = z.object({
  charge: chargeWithValueSchema,
  event: z.literal(OPENPIX_TRANSACTION_RECEIVED),
  transaction: transactionSchema,
});

const chargeExpiredPayloadSchema = z.object({
  charge: chargeBaseSchema,
  event: z.literal(OPENPIX_CHARGE_EXPIRED),
});

const chargeCompletedPayloadSchema = z.object({
  charge: chargeWithValueSchema,
  event: z.literal(OPENPIX_CHARGE_COMPLETED),
  transaction: transactionSchema,
});

const otherEventPayloadSchema = z
  .object({
    data: z.unknown().optional(),
    event: z.string(),
  })
  .passthrough();

/**
 * Parses any inbound Woovi webhook payload. Use
 * `wooviWebhookPayloadSchema.parse(JSON.parse(rawBody))` — the wrapper handles
 * `JSON.parse` failures separately.
 *
 * Note: `OtherWooviEventPayload` (open `event: string`) is the fallback; the
 * webhook handler dispatches on `event` after parse and silently ignores
 * unknown events.
 */
export const wooviWebhookPayloadSchema = z.union([
  chargeCompletedPayloadSchema,
  chargeExpiredPayloadSchema,
  otherEventPayloadSchema,
  transactionReceivedPayloadSchema,
]);
