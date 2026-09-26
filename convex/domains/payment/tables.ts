import {
  convexTable,
  id,
  index,
  integer,
  json,
  text,
  timestamp,
  uniqueIndex,
} from "kitcn/orm";

import * as authTables from "../auth/tables";
import * as playerTables from "../player/tables";

import type { SplitConfig } from "./contract";

/**
 * One row per PIX charge; `sourceType` + `sourceId` identify what was paid for
 * and pick the webhook side effect. `correlationId` is the idempotency key:
 * sent to Woovi as `correlationID` and echoed back by the webhook.
 */
export const paymentCharge = convexTable(
  "paymentCharge",
  {
    amountCents: integer().notNull(),
    brCode: text(),
    // Cancelamento no provedor: "pending" (comando pedido, sweep retenta),
    // "failed" (recusado ou sem resposta), "canceled" (confirmado: a cobranca
    // nao existe mais la); null = nunca cancelada. `status: CANCELED` e
    // imediato, este campo diz se o PIX realmente morreu.
    cancelStatus: text(),
    correlationId: text().notNull(),
    createdAt: timestamp().notNull(),
    expiresAt: timestamp(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    paidAt: timestamp(),
    // Period this charge bought, snapshotted when applied so an early renewal
    // stacks on the due date already paid for instead of restarting from
    // `paidAt`. Null for non-recurring sources and older rows (fallback:
    // `paidAt + billingInterval`).
    periodEndAt: timestamp(),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    // Provider's internal charge id (`transactionID`/`identifier`).
    providerChargeId: text(),
    // PIX end-to-end id from `OPENPIX:TRANSACTION_RECEIVED`, not the charge id.
    providerTransactionId: text(),
    // HTTPS URL of the QR PNG (provider returns a URL, not base64).
    qrCodeImage: text(),
    // Estorno "pending"/"failed"/"refunded"; o RECOLHIMENTO da parte do
    // organizador fecha junto: "pending" (devido), "collected", "not_owed".
    refundRecoveryStatus: text(),
    refundStatus: text(),
    sourceId: text().notNull(),
    // Source name snapshot taken at charge time, so list/history skip a join.
    sourceLabel: text(),
    sourceType: text().notNull(),
    splitConfig: json<SplitConfig>(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (paymentCharge) => [
    index("sourceType_sourceId_status").on(
      paymentCharge.sourceType,
      paymentCharge.sourceId,
      paymentCharge.status
    ),
    // Sweep de cancelamentos ainda nao confirmados pelo provedor.
    index("cancelStatus").on(paymentCharge.cancelStatus),
    index("playerProfileId_status").on(
      paymentCharge.playerProfileId,
      paymentCharge.status
    ),
    index("correlationId").on(paymentCharge.correlationId),
    index("organizationId_refundStatus").on(
      paymentCharge.organizationId,
      paymentCharge.refundStatus
    ),
    index("refundRecoveryStatus").on(paymentCharge.refundRecoveryStatus),
    index("organizationId_refundRecoveryStatus").on(
      paymentCharge.organizationId,
      paymentCharge.refundRecoveryStatus
    ),
  ]
);

/**
 * One row per organizer withdrawal: a partial PIX out from the organization's
 * subaccount to the key registered on it; `status` mirrors the local lifecycle.
 */
export const withdrawals = convexTable(
  "withdrawals",
  {
    amountCents: integer().notNull(),
    createdAt: timestamp().notNull(),
    // Reason reported by the provider (or by a fee debit that failed after the
    // PIX out went through).
    failureReason: text(),
    feeCents: integer().notNull(),
    // Fee lifecycle: "pending" (owed, sweep retries), "collected", "not_owed"
    // (free tier or failed PIX out). Null only on pre-migration rows.
    feeStatus: text(),
    // The withdraw endpoint accepts no correlationID, so idempotency is local:
    // the row is reserved with this key before any provider call, and a retry
    // replays the stored result instead of POSTing a duplicate.
    idempotencyKey: text().notNull(),
    liquidAmountCents: integer().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
    // Provider's withdrawal transaction id (correlationID / endToEndId).
    wooviWithdrawId: text(),
  },
  (withdrawals) => [
    index("organizationId_status").on(
      withdrawals.organizationId,
      withdrawals.status
    ),
    // Fee sweep: rows with a fee still owed.
    index("feeStatus").on(withdrawals.feeStatus),
    // Idempotent replay lookup + duplicate-insert backstop.
    uniqueIndex("idempotencyKey").on(withdrawals.idempotencyKey),
    // Two rows must never reference the same provider transaction; undefined
    // values aren't indexed, so not-yet-executed rows coexist.
    uniqueIndex("wooviWithdrawId").on(withdrawals.wooviWithdrawId),
  ]
);

/**
 * Balance cache per organization: Convex queries can't call the provider, so a
 * cron refreshes it and a withdrawal adjusts it right after.
 */
export const subaccountBalance = convexTable(
  "subaccountBalance",
  {
    balanceCents: integer().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    updatedAt: timestamp().notNull(),
  },
  (subaccountBalance) => [
    index("organizationId").on(subaccountBalance.organizationId),
  ]
);
