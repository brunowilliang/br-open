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

export const leagueChallenge = convexTable(
  "leagueChallenge",
  {
    leagueId: id("league")
      .notNull()
      .references(() => league.id),
    challengerMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    challengedMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    status: text().notNull(),
    currentProposalId: text(),
    cancellationRequestedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id
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
  ]
);

export const leagueChallengeAdminAction = convexTable(
  "leagueChallengeAdminAction",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id),
    action: text().notNull(),
    reason: text().notNull(),
    performedByUserId: id("user")
      .notNull()
      .references(() => authTables.user.id),
    fromStatus: text().notNull(),
    toStatus: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (leagueChallengeAdminAction) => [
    index("challengeId").on(leagueChallengeAdminAction.challengeId),
  ]
);

export const leagueChallengeProposal = convexTable(
  "leagueChallengeProposal",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id),
    proposedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
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
  ]
);

export const leagueChallengeResultSubmission = convexTable(
  "leagueChallengeResultSubmission",
  {
    challengeId: id("leagueChallenge")
      .notNull()
      .references(() => leagueChallenge.id),
    submittedByMembershipId: id("leagueMembership")
      .notNull()
      .references(() => leagueMembership.id),
    confirmedByMembershipId: id("leagueMembership").references(
      () => leagueMembership.id
    ),
    adminReviewedByUserId: id("user").references(() => authTables.user.id),
    reviewAction: text(),
    score: json<Record<string, unknown>>().notNull(),
    winnerMembershipId: id("leagueMembership").references(
      () => leagueMembership.id
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
  ]
);
