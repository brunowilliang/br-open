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

export const league = convexTable(
  "league",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    city: text().notNull(),
    state: text().notNull(),
    locationNotes: text(),
    visibility: text().notNull(),
    categories: json<string[]>().notNull(),
    courts: json<Record<string, unknown>[]>(),
    maxPlayers: integer(),
    monthlyPriceCents: integer(),
    priceBillingInterval: text(),
    // Whether players on this paid league go straight to checkout (`auto`)
    // or land in the organizer's request queue first (`manual`). Only
    // meaningful when `monthlyPriceCents > 0`. Defaults to `auto` via
    // the league serializer (kept nullable for legacy docs).
    approvalMode: text(),
    gracePeriodDays: integer(),
    reminderDaysBefore: integer(),
    mode: text().notNull(),
    ruleConfig: json<Record<string, unknown>>().notNull(),
    coverStorageId: text(),
    avatarStorageId: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (league) => [index("organizationId").on(league.organizationId)]
);

export const leagueMembership = convexTable(
  "leagueMembership",
  {
    leagueId: id("league")
      .notNull()
      .references(() => league.id, { onDelete: "cascade" }),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    status: text().notNull(),
    lastRenewalReminderSentAt: timestamp(),
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
    index("leagueId_playerProfileId").on(
      leagueMembership.leagueId,
      leagueMembership.playerProfileId
    ),
    index("leagueId_rankingPosition").on(
      leagueMembership.leagueId,
      leagueMembership.rankingPosition
    ),
    index("playerProfileId_status").on(
      leagueMembership.playerProfileId,
      leagueMembership.status
    ),
  ]
);

export const leagueChallenge = convexTable(
  "leagueChallenge",
  {
    leagueId: id("league")
      .notNull()
      .references(() => league.id, { onDelete: "cascade" }),
    challengerMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    challengedMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    status: text().notNull(),
    currentProposalId: text(),
    cancellationRequestedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
    cancellationRequestedAt: timestamp(),
    challengeValidationMode: text().notNull(),
    resultValidationMode: text().notNull(),
    matchConfigSnapshot: json<Record<string, unknown>>().notNull(),
    rankingSnapshotAfterResult: json<string[]>(),
    rankingSnapshotBeforeResult: json<string[]>(),
    rankingAppliedAt: timestamp(),
    lockedAt: timestamp(),
    confirmedAt: timestamp(),
    finishedAt: timestamp(),
    cancelledAt: timestamp(),
    invalidatedAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (leagueChallenge) => [
    index("leagueId_status").on(
      leagueChallenge.leagueId,
      leagueChallenge.status
    ),
    index("challengerMembershipId_status").on(
      leagueChallenge.challengerMembershipId,
      leagueChallenge.status
    ),
    index("challengedMembershipId_status").on(
      leagueChallenge.challengedMembershipId,
      leagueChallenge.status
    ),
    index("cancellationRequestedByMembershipId").on(
      leagueChallenge.cancellationRequestedByMembershipId
    ),
    index("currentProposalId").on(leagueChallenge.currentProposalId),
  ]
);

export const leagueChallengeOrganizerAction = convexTable(
  "leagueChallengeOrganizerAction",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id, { onDelete: "cascade" }),
    action: text().notNull(),
    reason: text(),
    performedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    fromStatus: text().notNull(),
    toStatus: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (leagueChallengeOrganizerAction) => [
    index("challengeId").on(leagueChallengeOrganizerAction.challengeId),
    index("performedByUserId").on(
      leagueChallengeOrganizerAction.performedByUserId
    ),
  ]
);

export const leagueChallengeProposal = convexTable(
  "leagueChallengeProposal",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id, { onDelete: "cascade" }),
    proposedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    courtId: text().notNull(),
    matchDate: text().notNull(),
    startMinute: integer().notNull(),
    endMinute: integer().notNull(),
    responseDeadlineAt: timestamp().notNull(),
    revisionNumber: integer().notNull(),
    status: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (leagueChallengeProposal) => [
    index("challengeId_revisionNumber").on(
      leagueChallengeProposal.challengeId,
      leagueChallengeProposal.revisionNumber
    ),
    index("courtId_matchDate").on(
      leagueChallengeProposal.courtId,
      leagueChallengeProposal.matchDate
    ),
    index("proposedByMembershipId").on(
      leagueChallengeProposal.proposedByMembershipId
    ),
  ]
);

export const leagueChallengeResultSubmission = convexTable(
  "leagueChallengeResultSubmission",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id, { onDelete: "cascade" }),
    submittedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    confirmedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
    organizerReviewedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    reviewAction: text(),
    score: json<Record<string, unknown>>().notNull(),
    winnerMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
    submittedAt: timestamp().notNull(),
    confirmedAt: timestamp(),
    reviewedAt: timestamp(),
  },
  (leagueChallengeResultSubmission) => [
    index("challengeId_submittedAt").on(
      leagueChallengeResultSubmission.challengeId,
      leagueChallengeResultSubmission.submittedAt
    ),
    index("submittedByMembershipId").on(
      leagueChallengeResultSubmission.submittedByMembershipId
    ),
    index("confirmedByMembershipId").on(
      leagueChallengeResultSubmission.confirmedByMembershipId
    ),
    index("organizerReviewedByUserId").on(
      leagueChallengeResultSubmission.organizerReviewedByUserId
    ),
    index("winnerMembershipId").on(
      leagueChallengeResultSubmission.winnerMembershipId
    ),
  ]
);
