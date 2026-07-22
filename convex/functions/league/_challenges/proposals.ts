import type { Id } from "../../../functions/_generated/dataModel";
import { CRPCError } from "kitcn/server";
import type { LeagueChallengeRecord, OrmCtx } from "./types";

export function getChallengeProposals(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  return ctx.orm.query.leagueChallengeProposal.findMany({
    limit: 100,
    orderBy: { revisionNumber: "asc" },
    where: { challengeId },
  });
}

export async function getLatestResultSubmission(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  const [latestResultSubmission] =
    await ctx.orm.query.leagueChallengeResultSubmission.findMany({
      limit: 1,
      orderBy: { submittedAt: "desc" },
      where: { challengeId },
    });

  return latestResultSubmission ?? null;
}

export async function getCurrentProposalOrThrow(
  ctx: OrmCtx,
  challenge: LeagueChallengeRecord
) {
  if (challenge.currentProposalId) {
    const proposalId =
      challenge.currentProposalId as Id<"leagueChallengeProposal">;
    const currentProposal =
      await ctx.orm.query.leagueChallengeProposal.findFirst({
        where: { id: proposalId },
      });

    if (currentProposal && currentProposal.challengeId === challenge.id) {
      return currentProposal;
    }
  }

  const proposals = await getChallengeProposals(
    ctx,
    challenge.id as Id<"leagueChallenge">
  );
  const fallbackProposal = proposals.at(-1);

  if (!fallbackProposal) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "A proposta atual do desafio não foi encontrada.",
    });
  }

  return fallbackProposal;
}

export function getProposalReceiverMembershipId(
  challenge: LeagueChallengeRecord
) {
  switch (challenge.status) {
    case "pending_opponent_response":
      return challenge.challengedMembershipId as Id<"leagueMembership">;
    case "pending_creator_reapproval":
      return challenge.challengerMembershipId as Id<"leagueMembership">;
    default:
      return null;
  }
}

export function getCancellationResponseMembershipId(
  challenge: LeagueChallengeRecord
) {
  if (
    challenge.status !== "pending_cancellation_acceptance" ||
    !challenge.cancellationRequestedByMembershipId
  ) {
    return null;
  }

  return challenge.cancellationRequestedByMembershipId ===
    challenge.challengerMembershipId
    ? (challenge.challengedMembershipId as Id<"leagueMembership">)
    : (challenge.challengerMembershipId as Id<"leagueMembership">);
}
