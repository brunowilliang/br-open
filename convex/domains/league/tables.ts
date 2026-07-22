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
    // Whether players on this paid league go straight to checkout (`auto`)
    // or land in the organizer's request queue first (`manual`). Only
    // meaningful when `monthlyPriceCents > 0`. Defaults to `auto` via
    // the league serializer (kept nullable for legacy docs).
    approvalMode: text(),
    avatarStorageId: text(),
    categories: json<string[]>().notNull(),
    city: text().notNull(),
    courts: json<Record<string, unknown>[]>(),
    coverStorageId: text(),
    createdAt: timestamp().notNull(),
    description: text(),
    gracePeriodDays: integer(),
    locationNotes: text(),
    maxPlayers: integer(),
    mode: text().notNull(),
    monthlyPriceCents: integer(),
    name: text().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    // BR-Open platform fee override for this league (0-100). When null,
    // falls back to DEFAULT_PLATFORM_FEE_PERCENT. Set directly in the
    // Convex dashboard — no app surface exposes this yet.
    platformFeePercent: integer(),
    priceBillingInterval: text(),
    reminderDaysBefore: integer(),
    ruleConfig: json<Record<string, unknown>>().notNull(),
    state: text().notNull(),
    updatedAt: timestamp().notNull(),
    visibility: text().notNull(),
  },
  (league) => [index("organizationId").on(league.organizationId)]
);

export const leagueMembership = convexTable(
  "leagueMembership",
  {
    createdAt: timestamp().notNull(),
    lastRenewalReminderSentAt: timestamp(),
    leagueId: id("league")
      .notNull()
      .references(() => league.id, { onDelete: "cascade" }),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => playerTables.playerProfile.id, {
        onDelete: "cascade",
      }),
    rankingPosition: integer(),
    reviewedAt: timestamp(),
    status: text().notNull(),
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
    cancellationRequestedAt: timestamp(),
    cancellationRequestedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
    cancelledAt: timestamp(),
    challengedMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    challengerMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    challengeValidationMode: text().notNull(),
    confirmedAt: timestamp(),
    createdAt: timestamp().notNull(),
    currentProposalId: text(),
    finishedAt: timestamp(),
    invalidatedAt: timestamp(),
    leagueId: id("league")
      .notNull()
      .references(() => league.id, { onDelete: "cascade" }),
    lockedAt: timestamp(),
    matchConfigSnapshot: json<Record<string, unknown>>().notNull(),
    rankingAppliedAt: timestamp(),
    rankingSnapshotAfterResult: json<string[]>(),
    rankingSnapshotBeforeResult: json<string[]>(),
    resultValidationMode: text().notNull(),
    status: text().notNull(),
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
    action: text().notNull(),
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id, { onDelete: "cascade" }),
    createdAt: timestamp().notNull(),
    fromStatus: text().notNull(),
    performedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    reason: text(),
    toStatus: text().notNull(),
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
    courtId: text().notNull(),
    createdAt: timestamp().notNull(),
    endMinute: integer().notNull(),
    matchDate: text().notNull(),
    proposedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    responseDeadlineAt: timestamp().notNull(),
    revisionNumber: integer().notNull(),
    startMinute: integer().notNull(),
    status: text().notNull(),
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
    confirmedAt: timestamp(),
    confirmedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
    organizerReviewedByUserId: id("user").references(() => authTables.user.id, {
      onDelete: "set null",
    }),
    reviewAction: text(),
    reviewedAt: timestamp(),
    score: json<Record<string, unknown>>().notNull(),
    submittedAt: timestamp().notNull(),
    submittedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id, { onDelete: "cascade" }),
    winnerMembershipId: id("leagueMembership").references(
      () => leagueMembership.id,
      { onDelete: "set null" }
    ),
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
