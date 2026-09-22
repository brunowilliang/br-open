/**
 * Woovi (OpenPix) webhook event payload types from the official docs —
 * `OPENPIX:*` names, routing by `event`. Real payloads must still be captured
 * end-to-end before these shapes are tightened.
 *
 * @see https://developers.woovi.com/docs/tags/webhook
 */

import { z } from "zod";

/**
 * The "paid" signal: carries the charge (`correlationID` is our idempotency
 * key) and the transaction details.
 */
export const OPENPIX_TRANSACTION_RECEIVED =
  "OPENPIX:TRANSACTION_RECEIVED" as const;

/** Mirrored locally; the player is told to generate a new PIX. */
export const OPENPIX_CHARGE_EXPIRED = "OPENPIX:CHARGE_EXPIRED" as const;

/**
 * Treated as an alias of TRANSACTION_RECEIVED (the two often arrive together);
 * the `status === "PAID"` short-circuit absorbs the duplicate.
 */
export const OPENPIX_CHARGE_COMPLETED = "OPENPIX:CHARGE_COMPLETED" as const;

/**
 * Refund issued from the Woovi dashboard; the payload mirrors the expired
 * event. `markChargeRefunded` already owns the membership side effect (leave
 * the league, free the ranking slot) and the notification.
 */
export const OPENPIX_CHARGE_REFUNDED = "OPENPIX:CHARGE_REFUNDED" as const;

/**
 * Failed withdrawal/movement (e.g. subaccount saque): carries the failed
 * payment (correlationID/endToEndId) and the error; marks the local withdrawal
 * `failed`.
 */
export const OPENPIX_MOVEMENT_FAILED = "OPENPIX:MOVEMENT_FAILED" as const;

/**
 * Catch-all for events we acknowledge but don't process: a closed union (not
 * `string`) is what lets TS narrow the variants above by `event`.
 */
export type OtherWooviEventPayload = {
  data?: unknown;
  event: string;
};

export type TransactionReceivedPayload = {
  event: typeof OPENPIX_TRANSACTION_RECEIVED;
  // We only read `charge.correlationID` (our idempotency key) and the
  // transaction's end-to-end identifier.
  charge: {
    correlationID: string;
    status: string;
    value: number;
  };
  transaction?: {
    status?: string;
    value?: number;
    // PIX end-to-end id (also exposed as `e2eId` on some payloads).
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

export type ChargeRefundedPayload = {
  event: typeof OPENPIX_CHARGE_REFUNDED;
  charge: {
    correlationID: string;
    status: string;
  };
};

export type MovementFailedPayload = {
  event: typeof OPENPIX_MOVEMENT_FAILED;
  payment?: {
    correlationID?: string;
    destinationAlias?: string;
    endToEndId?: string;
    status?: string;
    value?: number;
  };
  error?: {
    code?: string;
    description?: string;
  };
};

/** Narrow with `payload.event === ...` before reading `charge`/`transaction`. */
export type WooviWebhookPayload =
  | OtherWooviEventPayload
  | TransactionReceivedPayload
  | ChargeExpiredPayload
  | ChargeCompletedPayload
  | ChargeRefundedPayload
  | MovementFailedPayload;

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

const chargeRefundedPayloadSchema = z.object({
  charge: chargeBaseSchema,
  event: z.literal(OPENPIX_CHARGE_REFUNDED),
});

const movementFailedPayloadSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  event: z.literal(OPENPIX_MOVEMENT_FAILED),
  payment: z
    .object({
      correlationID: z.string().optional(),
      destinationAlias: z.string().optional(),
      endToEndId: z.string().optional(),
      status: z.string().optional(),
      value: z.number().optional(),
    })
    .optional(),
});

const otherEventPayloadSchema = z
  .object({
    data: z.unknown().optional(),
    event: z.string(),
  })
  .passthrough();

/**
 * Parses any inbound Woovi webhook payload; the caller handles `JSON.parse`
 * failures separately. The open `event: string` variant is the fallback, so
 * unknown events parse and are then ignored by the dispatcher.
 */
export const wooviWebhookPayloadSchema = z.union([
  chargeCompletedPayloadSchema,
  chargeExpiredPayloadSchema,
  chargeRefundedPayloadSchema,
  movementFailedPayloadSchema,
  otherEventPayloadSchema,
  transactionReceivedPayloadSchema,
]);
