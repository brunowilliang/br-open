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
 * A Woovi subaccount is created synchronously via
 * `POST /api/v1/subaccount { name, pixKey }` and is identified by its `pixKey`
 * — there is no separate `walletId` and no async KYC state machine. The
 * organization owner supplies the PIX key that will receive split payouts.
 */
export const organizationWooviAccount = convexTable(
  "organizationWooviAccount",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    pixKey: text().notNull(),
    name: text().notNull(),
    status: text().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (organizationWooviAccount) => [
    index("organizationId").on(organizationWooviAccount.organizationId),
  ]
);

/**
 * One row per charge per billing cycle for a membership. The `correlationId`
 * is our idempotency key (also Woovi's) and is used by the webhook to resolve
 * the payment back to a membership.
 */
export const leaguePayment = convexTable(
  "leaguePayment",
  {
    leagueId: id("league")
      .notNull()
      .references(() => leagueTables.league.id, { onDelete: "cascade" }),
    leagueMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueTables.leagueMembership.id, {
        onDelete: "cascade",
      }),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    correlationId: text().notNull(),
    amountCents: integer().notNull(),
    billingInterval: text().notNull(),
    splitConfig: json<SplitConfig>().notNull(),
    pixBrCode: text(),
    pixQrCodeUrl: text(),
    status: text().notNull(),
    paidAt: timestamp(),
    expiresAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (leaguePayment) => [
    index("leagueMembershipId_status").on(
      leaguePayment.leagueMembershipId,
      leaguePayment.status
    ),
    index("playerProfileId_status").on(
      leaguePayment.playerProfileId,
      leaguePayment.status
    ),
    index("correlationId").on(leaguePayment.correlationId),
  ]
);
