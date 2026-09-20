import {
  boolean,
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

export const tournament = convexTable(
  "tournament",
  {
    approvalMode: text(),
    avatarStorageId: text(),
    city: text().notNull(),
    courts: json<Record<string, unknown>[]>(),
    coverStorageId: text(),
    createdAt: timestamp().notNull(),
    description: text(),
    locationNotes: text(),
    // Format of the matches (reuse of the league's match config).
    matchConfig: json<Record<string, unknown>>().notNull(),
    maxEntriesHint: integer(),
    name: text().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    // BR-Open platform fee override for this tournament (0-100), same
    // pattern as `league.platformFeePercent` (DECISAO-004). Null falls back
    // to DEFAULT_PLATFORM_FEE_PERCENT; set via Convex dashboard.
    platformFeePercent: integer(),
    // Inscriptions open until this instant (draw closes them earlier).
    registrationDeadlineAt: timestamp().notNull(),
    startDate: timestamp().notNull(),
    state: text().notNull(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
    visibility: text().notNull(),
  },
  (tournament) => [
    index("organizationId").on(tournament.organizationId),
    index("status").on(tournament.status),
  ]
);

export const tournamentCategory = convexTable(
  "tournamentCategory",
  {
    createdAt: timestamp().notNull(),
    displayName: text().notNull(),
    entryFeeCents: integer().notNull(),
    gender: text().notNull(),
    maxEntries: integer(),
    modality: text().notNull(),
    tournamentId: id("tournament")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    updatedAt: timestamp().notNull(),
  },
  (tournamentCategory) => [
    index("tournamentId").on(tournamentCategory.tournamentId),
    // One category per modality×gender pair per tournament.
    uniqueIndex("tournamentId_modality_gender").on(
      tournamentCategory.tournamentId,
      tournamentCategory.modality,
      tournamentCategory.gender
    ),
  ]
);

export const tournamentEntry = convexTable(
  "tournamentEntry",
  {
    // IBX-0074 r19: slot reservation mirrors — set while the entry is live
    // (see ENTRY_LIVE_STATUSES), cleared with unsetToken when it goes
    // terminal. The unique indexes below key on THESE columns so cancelled/
    // rejected entries leave the index and re-registration works (a player
    // id can never be removed from the index while sitting on playerAId —
    // that column is NOT NULL on purpose, history keeps it).
    activeAId: id("playerProfile"),
    activeBId: id("playerProfile"),
    categoryId: id("tournamentCategory")
      .notNull()
      .references(() => tournamentCategory.id, { onDelete: "cascade" }),
    createdAt: timestamp().notNull(),
    // Who created (and pays for) the entry.
    createdByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    // IBX-0035 (PLN-0004): round where the entry enters the bracket
    // (null/1 = round 1). Direct entry beyond round 1 is a head-of-seed
    // privilege validated at draw time (validateEntryRounds).
    entryRound: integer(),
    partnerUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    playerAId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    // Doubles only — required there, null for singles.
    playerBId: id("playerProfile").references(
      () => playerTables.playerProfile.id,
      { onDelete: "cascade" }
    ),
    // Head of seed marked by the organizer before the draw (1..s).
    seedRank: integer(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (tournamentEntry) => [
    index("categoryId_status").on(
      tournamentEntry.categoryId,
      tournamentEntry.status
    ),
    // A live entry reserves each player at most once per category — enforced
    // by the database on the mirrored active columns (IBX-0074 r19: terminal
    // entries are out of the index, so cancel frees the slot for
    // re-registration). Missing sides (singles' playerB) are not indexed.
    uniqueIndex("categoryId_activeAId").on(
      tournamentEntry.categoryId,
      tournamentEntry.activeAId
    ),
    uniqueIndex("categoryId_activeBId").on(
      tournamentEntry.categoryId,
      tournamentEntry.activeBId
    ),
    index("createdByUserId").on(tournamentEntry.createdByUserId),
  ]
);

export const tournamentMatch = convexTable(
  "tournamentMatch",
  {
    categoryId: id("tournamentCategory")
      .notNull()
      .references(() => tournamentCategory.id, { onDelete: "cascade" }),
    courtId: text(),
    createdAt: timestamp().notNull(),
    endMinute: integer(),
    entryAId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
    entryBId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
    // Optional scheduling (date + time window + court), league pattern.
    matchDate: text(),
    // When set, the result was PUBLISHED by the organizer and the slot is
    // locked for swaps. Draw-time byes set winnerEntryId WITHOUT publishedAt
    // (re-derivable on swap).
    publishedAt: timestamp(),
    round: integer().notNull(),
    // Optimistic concurrency for swap/advance writes.
    rowVersion: integer().notNull(),
    scheduledById: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    score: json<Record<string, unknown>>(),
    slotInRound: integer().notNull(),
    startMinute: integer(),
    status: text().notNull(),
    updatedAt: timestamp().notNull(),
    walkover: boolean().notNull(),
    winnerEntryId: id("tournamentEntry").references(() => tournamentEntry.id, {
      onDelete: "set null",
    }),
  },
  (tournamentMatch) => [
    // Bracket reads: all matches of a category ordered by round/slot.
    uniqueIndex("categoryId_round_slotInRound").on(
      tournamentMatch.categoryId,
      tournamentMatch.round,
      tournamentMatch.slotInRound
    ),
    index("entryAId").on(tournamentMatch.entryAId),
    index("entryBId").on(tournamentMatch.entryBId),
    index("winnerEntryId").on(tournamentMatch.winnerEntryId),
    index("matchDate").on(tournamentMatch.matchDate),
  ]
);

// IBX-0028: audit trail for published-result edits. One row per organizer
// edit — `before`/`after` carry the full result snapshot (score, winner,
// walkover) so the bracket history stays reconstructible.
export const tournamentMatchEdit = convexTable(
  "tournamentMatchEdit",
  {
    after: json<Record<string, unknown>>().notNull(),
    before: json<Record<string, unknown>>().notNull(),
    createdAt: timestamp().notNull(),
    editedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    matchId: id("tournamentMatch")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
  },
  (tournamentMatchEdit) => [index("matchId").on(tournamentMatchEdit.matchId)]
);
