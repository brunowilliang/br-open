import {
  convexTable,
  id,
  index,
  integer,
  json,
  text,
  timestamp,
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
    // creation). Stored for diagnostics; matching is via `correlationId`.
    providerChargeId: text(),
    // Provider's PIX transaction id (end-to-end identifier), returned on
    // `OPENPIX:TRANSACTION_RECEIVED`. Distinct from `providerChargeId`.
    providerTransactionId: text(),
    // HTTPS URL of the QR PNG (provider returns a URL, not base64).
    qrCodeImage: text(),
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
