import { convexTable, id, index, integer, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";
import * as leagueTables from "../league/tables";
import * as playerTables from "../player/tables";

/**
 * One row per PIX charge created for a league membership payment.
 * The charge is created when the player initiates payment and updated
 * by the webhook when payment is confirmed.
 */
export const paymentCharge = convexTable(
  "paymentCharge",
  {
    externalId: text().notNull(),
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
    amountCents: integer().notNull(),
    status: text().notNull(),
    providerChargeId: text(),
    brCode: text(),
    brCodeBase64: text(),
    platformFee: integer(),
    expiresAt: timestamp(),
    paidAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (paymentCharge) => [
    index("externalId").on(paymentCharge.externalId),
    index("membershipId").on(paymentCharge.membershipId),
    // Used by the webhook to find the charge by the AbacatePay id (pix_char_*).
    index("providerChargeId").on(paymentCharge.providerChargeId),
  ]
);
