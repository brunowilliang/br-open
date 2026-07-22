import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineLeagueRelations = (r: RelationsBuilder<typeof tables>) => ({
  league: {
    challenges: r.many.leagueChallenge({
      from: r.league.id,
      to: r.leagueChallenge.leagueId,
    }),
    memberships: r.many.leagueMembership({
      from: r.league.id,
      to: r.leagueMembership.leagueId,
    }),
    organization: r.one.organization({
      from: r.league.organizationId,
      to: r.organization.id,
    }),
  },
  leagueChallenge: {
    adminActions: r.many.leagueChallengeOrganizerAction({
      from: r.leagueChallenge.id,
      to: r.leagueChallengeOrganizerAction.challengeId,
    }),
    challengedMembership: r.one.leagueMembership({
      alias: "challengedMembership",
      from: r.leagueChallenge.challengedMembershipId,
      to: r.leagueMembership.id,
    }),
    challengerMembership: r.one.leagueMembership({
      alias: "challengerMembership",
      from: r.leagueChallenge.challengerMembershipId,
      to: r.leagueMembership.id,
    }),
    league: r.one.league({
      from: r.leagueChallenge.leagueId,
      to: r.league.id,
    }),
    proposals: r.many.leagueChallengeProposal({
      from: r.leagueChallenge.id,
      to: r.leagueChallengeProposal.challengeId,
    }),
    resultSubmissions: r.many.leagueChallengeResultSubmission({
      from: r.leagueChallenge.id,
      to: r.leagueChallengeResultSubmission.challengeId,
    }),
  },
  leagueChallengeOrganizerAction: {
    challenge: r.one.leagueChallenge({
      from: r.leagueChallengeOrganizerAction.challengeId,
      to: r.leagueChallenge.id,
    }),
    performedBy: r.one.user({
      from: r.leagueChallengeOrganizerAction.performedByUserId,
      to: r.user.id,
    }),
  },
  leagueChallengeProposal: {
    challenge: r.one.leagueChallenge({
      from: r.leagueChallengeProposal.challengeId,
      to: r.leagueChallenge.id,
    }),
    proposedByMembership: r.one.leagueMembership({
      from: r.leagueChallengeProposal.proposedByMembershipId,
      to: r.leagueMembership.id,
    }),
  },
  leagueChallengeResultSubmission: {
    adminReviewedBy: r.one.user({
      from: r.leagueChallengeResultSubmission.organizerReviewedByUserId,
      to: r.user.id,
    }),
    challenge: r.one.leagueChallenge({
      from: r.leagueChallengeResultSubmission.challengeId,
      to: r.leagueChallenge.id,
    }),
    confirmedByMembership: r.one.leagueMembership({
      alias: "confirmedByMembership",
      from: r.leagueChallengeResultSubmission.confirmedByMembershipId,
      to: r.leagueMembership.id,
    }),
    submittedByMembership: r.one.leagueMembership({
      alias: "submittedByMembership",
      from: r.leagueChallengeResultSubmission.submittedByMembershipId,
      to: r.leagueMembership.id,
    }),
    winnerMembership: r.one.leagueMembership({
      alias: "winnerMembership",
      from: r.leagueChallengeResultSubmission.winnerMembershipId,
      to: r.leagueMembership.id,
    }),
  },
  leagueMembership: {
    challengeProposals: r.many.leagueChallengeProposal({
      from: r.leagueMembership.id,
      to: r.leagueChallengeProposal.proposedByMembershipId,
    }),
    challengesAsChallenged: r.many.leagueChallenge({
      alias: "challengedMembership",
      from: r.leagueMembership.id,
      to: r.leagueChallenge.challengedMembershipId,
    }),
    challengesAsChallenger: r.many.leagueChallenge({
      alias: "challengerMembership",
      from: r.leagueMembership.id,
      to: r.leagueChallenge.challengerMembershipId,
    }),
    confirmedChallengeResults: r.many.leagueChallengeResultSubmission({
      alias: "confirmedByMembership",
      from: r.leagueMembership.id,
      to: r.leagueChallengeResultSubmission.confirmedByMembershipId,
    }),
    league: r.one.league({
      from: r.leagueMembership.leagueId,
      to: r.league.id,
    }),
    playerProfile: r.one.playerProfile({
      from: r.leagueMembership.playerProfileId,
      to: r.playerProfile.id,
    }),
    submittedChallengeResults: r.many.leagueChallengeResultSubmission({
      alias: "submittedByMembership",
      from: r.leagueMembership.id,
      to: r.leagueChallengeResultSubmission.submittedByMembershipId,
    }),
    wonChallengeResults: r.many.leagueChallengeResultSubmission({
      alias: "winnerMembership",
      from: r.leagueMembership.id,
      to: r.leagueChallengeResultSubmission.winnerMembershipId,
    }),
  },
});
