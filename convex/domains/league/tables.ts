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

export const league = convexTable(
  "league",
  {
    managerUserId: id("user")
      .notNull()
      .references(() => authTables.user.id),
    name: text().notNull(),
    description: text(),
    city: text().notNull(),
    state: text().notNull(),
    locationNotes: text(),
    visibility: text().notNull(),
    categories: json<string[]>().notNull(),
    courts: json<Record<string, unknown>[]>(),
    mode: text().notNull(),
    ruleConfig: json<Record<string, unknown>>().notNull(),
    coverStorageId: text().notNull(),
    avatarStorageId: text().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (league) => [index("managerUserId").on(league.managerUserId)]
);

export const leagueMembership = convexTable(
  "leagueMembership",
  {
    leagueId: id("league")
      .notNull()
      .references(() => league.id),
    userId: id("user")
      .notNull()
      .references(() => authTables.user.id),
    status: text().notNull(),
    rankingPosition: integer(),
    reviewedAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (leagueMembership) => [
    index("leagueId_status").on(
      leagueMembership.leagueId,
      leagueMembership.status
    ),
    index("leagueId_userId").on(
      leagueMembership.leagueId,
      leagueMembership.userId
    ),
    index("leagueId_rankingPosition").on(
      leagueMembership.leagueId,
      leagueMembership.rankingPosition
    ),
    index("userId_status").on(leagueMembership.userId, leagueMembership.status),
  ]
);
