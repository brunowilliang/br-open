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
import * as leagueTables from "../league/tables";
import * as playerTables from "../player/tables";

import type { SplitConfig } from "./contract";

/**
 * Onboards an organization as a Woovi split recipient (subaccount).
 *
 * One row per organization. The subaccount is created synchronously via
 * `POST /api/v1/subaccount` and is usable immediately (validated in the
 * 2026-07-02 PoC). The `wooviPixKey` is the value used as the recipient
 * in a charge's `splits` array.
 */
export const organizationWooviAccount = convexTable(
  "organizationWooviAccount",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    // PIX key supplied at subaccount creation — IS the split recipient.
    wooviPixKey: text().notNull(),
    name: text().notNull(),
    status: text().notNull(),
    onboardedAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (organizationWooviAccount) => [
    index("organizationId").on(organizationWooviAccount.organizationId),
  ]
);

/**
 * One row per PIX charge created for a league membership payment.
 *
 * Created when the player initiates payment; updated by the webhook when
 * payment is confirmed (`OPENPIX:TRANSACTION_RECEIVED`) or expired
 * (`OPENPIX:CHARGE_EXPIRED`). `wooviCorrelationID` is our idempotency key
 * (we generate it, Woovi echoes it, the webhook references it).
 */
export const leaguePayment = convexTable(
  "leaguePayment",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    leagueId: id("league")
      .notNull()
      .references(() => leagueTables.league.id, { onDelete: "cascade" }),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    membershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueTables.leagueMembership.id, {
        onDelete: "cascade",
      }),
    // Our idempotency key. Sent as `correlationID` to Woovi, echoed back,
    // and referenced by the webhook as `charge.correlationID`.
    wooviCorrelationId: text().notNull(),
    // Woovi's internal charge id (`transactionID`/`identifier` at charge
    // creation). Stored for diagnostics; matching is via `wooviCorrelationId`.
    wooviChargeId: text(),
    // Woovi's PIX transaction id (end-to-end identifier), returned on
    // `OPENPIX:TRANSACTION_RECEIVED`. Distinct from `wooviChargeId` (which is
    // the *charge* id). Captured only when the webhook confirms payment.
    wooviTransactionId: text(),
    amountCents: integer().notNull(),
    status: text().notNull(),
    brCode: text(),
    // HTTPS URL of the QR PNG (Woovi returns a URL, not base64).
    qrCodeImage: text(),
    // Snapshot of how the split was computed at charge time.
    splitConfig: json<SplitConfig>(),
    expiresAt: timestamp(),
    paidAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (leaguePayment) => [
    index("membershipId_status").on(
      leaguePayment.membershipId,
      leaguePayment.status
    ),
    index("playerProfileId_status").on(
      leaguePayment.playerProfileId,
      leaguePayment.status
    ),
    // Used by the webhook to find the charge by our correlationID.
    index("wooviCorrelationId").on(leaguePayment.wooviCorrelationId),
  ]
);
