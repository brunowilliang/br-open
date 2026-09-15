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
 * One row per PIX charge created for a payable source (today: a league
 * membership; in the future: event registrations, tournament entries, ...).
 *
 * The charge is polymorphic over its `sourceType` + `sourceId` pair — the
 * pair identifies what was paid for (e.g. a `leagueMembership` row). The
 * webhook/handlers dispatch on `sourceType` to apply the side effect
 * appropriate for that source (e.g. activate a membership, confirm a
 * registration).
 *
 * `correlationId` is our idempotency key (sent as `correlationID` to Woovi,
 * echoed back, referenced by the webhook as `charge.correlationID`).
 */
export const paymentCharge = convexTable(
  "paymentCharge",
  {
    amountCents: integer().notNull(),
    brCode: text(),
    // Our idempotency key. Sent as `correlationID` to the provider, echoed
    // back, and referenced by the webhook as `charge.correlationID`.
    correlationId: text().notNull(),
    createdAt: timestamp().notNull(),
    expiresAt: timestamp(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    paidAt: timestamp(),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    // Provider's internal charge id (`transactionID`/`identifier` at charge
    providerChargeId: text(),
    // Provider's PIX transaction id (end-to-end identifier), returned on
    // `OPENPIX:TRANSACTION_RECEIVED`. Distinct from `providerChargeId`.
    providerTransactionId: text(),
    // HTTPS URL of the QR PNG (provider returns a URL, not base64).
    qrCodeImage: text(),
    // Refund lifecycle (IBX-0010): "pending" — refund requested at the
    // provider, not confirmed yet; "failed" — provider rejected (sweep
    // retries); "refunded" — provider confirmed. Null = never refunded.
    refundStatus: text(),
    sourceId: text().notNull(),
    // Snapshot of the source's human label (e.g. the league name) captured
    // at charge time so list/history views don't need a join.
    sourceLabel: text(),
    // Polymorphic source pair. Today only "league_membership" exists; the
    // pair is ready for future sources (event_registration, ...).
    sourceType: text().notNull(),
    // Snapshot of how the split was computed at charge time.
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
    index("playerProfileId_status").on(
      paymentCharge.playerProfileId,
      paymentCharge.status
    ),
    // Used by the webhook to find the charge by our correlationId.
    index("correlationId").on(paymentCharge.correlationId),
  ]
);

/**
 * One row per organizer withdrawal request (DECISAO-003). The provider
 * executes a partial PIX out from the organization's subaccount to the PIX
 * key registered on it. `status` mirrors the local lifecycle (pending →
 * failed via OPENPIX:MOVEMENT_FAILED; completed reserved).
 */
export const withdrawals = convexTable(
  "withdrawals",
  {
    amountCents: integer().notNull(),
    createdAt: timestamp().notNull(),
    // Legible failure reason when the provider reports a failed movement
    // (or when the fee debit failed after the PIX out succeeded).
    failureReason: text(),
    feeCents: integer().notNull(),
    // Fee collection lifecycle (BUG-0006): "pending" — fee owed, debit not
    // confirmed yet (sweep retries); "collected" — debit confirmed;
    // "not_owed" — no fee (free tier) or the PIX out failed. Null only on
    // pre-migration rows (backfilled to explicit values).
    feeStatus: text(),
    // Local idempotency key (the Woovi withdraw endpoint accepts no
    // correlationID). The row is reserved with this key BEFORE any provider
    // call; a retry that reuses the key replays the stored result instead of
    // POSTing a duplicate withdrawal. Unique per chain.
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
    // Fee sweep lookup (BUG-0006): rows with a fee still owed.
    index("feeStatus").on(withdrawals.feeStatus),
    // Idempotent replay lookup + duplicate-insert backstop.
    uniqueIndex("idempotencyKey").on(withdrawals.idempotencyKey),
    // Defense in depth: two rows must never reference the same provider
    // transaction (undefined values are not indexed, so reserved rows with
    // no id yet coexist fine).
    uniqueIndex("wooviWithdrawId").on(withdrawals.wooviWithdrawId),
  ]
);

/**
 * Short-lived cache of the real subaccount balance per organization
 * (DECISAO-003). Convex queries can't call the provider, so the balance is
 * refreshed by the `refresh-subaccount-balances` cron (5 min) and adjusted
 * immediately after a withdrawal. One row per organization.
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
