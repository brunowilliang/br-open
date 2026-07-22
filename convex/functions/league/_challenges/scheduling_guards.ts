import type { Id } from "../../../functions/_generated/dataModel";
import { CRPCError } from "kitcn/server";
import {
  isChallengeSlotBlocked,
  resolveChallengeCreationRuleError,
  type LeagueChallengeStatus,
} from "../../../domains/league/challenge-rules";
import {
  getDayKeyFromMatchDate,
  rangesOverlap,
} from "../../../domains/league/challenge-scheduling-rules";
import {
  resolveRuleValue,
  type League,
} from "../../../domains/league/contract";
import type { LeagueMembershipRecord, OrmCtx } from "./types";

export function getCourtNameOrThrow(currentLeague: League, courtId: string) {
  const currentCourt = currentLeague.courts.find(
    (court) => court.id === courtId
  );

  if (!currentCourt) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra selecionada não pertence a essa liga.",
    });
  }

  return currentCourt.name;
}

export function assertCourtAvailability(input: {
  currentLeague: League;
  courtId: string;
  endMinute: number;
  matchDate: string;
  startMinute: number;
}) {
  const currentCourt = input.currentLeague.courts.find(
    (court) => court.id === input.courtId
  );

  if (!currentCourt) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra selecionada não pertence a essa liga.",
    });
  }

  const dayKey = getDayKeyFromMatchDate(input.matchDate);
  const dayAvailability = currentCourt.availability[dayKey];
  const fitsAvailability = dayAvailability.some(
    (range) =>
      input.startMinute >= range.startMinute &&
      input.endMinute <= range.endMinute
  );

  if (!fitsAvailability) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "A quadra não está disponível nesse horário.",
    });
  }
}

export async function assertCourtSlotAvailable(input: {
  challengeIdToIgnore?: Id<"leagueChallenge"> | null;
  courtId: string;
  ctx: OrmCtx;
  endMinute: number;
  matchDate: string;
  startMinute: number;
}) {
  const proposals = await input.ctx.orm.query.leagueChallengeProposal.findMany({
    limit: 500,
    where: {
      courtId: input.courtId,
      matchDate: input.matchDate,
    },
  });

  for (const proposal of proposals) {
    const parentChallenge = await input.ctx.orm.query.leagueChallenge.findFirst(
      {
        where: { id: proposal.challengeId as Id<"leagueChallenge"> },
      }
    );

    if (!parentChallenge) {
      continue;
    }

    if (
      input.challengeIdToIgnore &&
      parentChallenge.id === input.challengeIdToIgnore
    ) {
      continue;
    }

    if (parentChallenge.currentProposalId !== proposal.id) {
      continue;
    }

    if (
      !isChallengeSlotBlocked(parentChallenge.status as LeagueChallengeStatus)
    ) {
      continue;
    }

    if (
      rangesOverlap({
        leftEndMinute: input.endMinute,
        leftStartMinute: input.startMinute,
        rightEndMinute: proposal.endMinute,
        rightStartMinute: proposal.startMinute,
      })
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse horário já está reservado para outro desafio.",
      });
    }
  }
}

export async function assertChallengeCreationRules(input: {
  challengedMembership: LeagueMembershipRecord;
  challengerMembership: LeagueMembershipRecord;
  ctx: OrmCtx;
  league: League;
}) {
  const activeChallenges = await input.ctx.orm.query.leagueChallenge.findMany({
    limit: 500,
    where: { leagueId: input.league.id as Id<"league"> },
  });

  const activeChallengeCountForMembership = (
    membershipId: Id<"leagueMembership">
  ) =>
    activeChallenges.filter(
      (challenge) =>
        isChallengeSlotBlocked(challenge.status as LeagueChallengeStatus) &&
        (challenge.challengerMembershipId === membershipId ||
          challenge.challengedMembershipId === membershipId)
    ).length;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const challengesCreatedThisMonth = activeChallenges.filter(
    (challenge) =>
      challenge.challengerMembershipId === input.challengerMembership.id &&
      challenge.createdAt >= monthStart
  ).length;
  const ruleError = resolveChallengeCreationRuleError({
    challengedActiveChallengeCount: activeChallengeCountForMembership(
      input.challengedMembership.id as Id<"leagueMembership">
    ),
    challengedMembershipId: String(input.challengedMembership.id),
    challengedPosition: input.challengedMembership.rankingPosition,
    challengerActiveChallengeCount: activeChallengeCountForMembership(
      input.challengerMembership.id as Id<"leagueMembership">
    ),
    challengerCreatedThisMonthCount: challengesCreatedThisMonth,
    challengerMembershipId: String(input.challengerMembership.id),
    challengerPosition: input.challengerMembership.rankingPosition,
    maxActiveChallengesPerPlayer: resolveRuleValue(
      input.league.ruleConfig.maxActiveChallengesPerPlayer,
      Number.POSITIVE_INFINITY
    ),
    maxChallengeDistance: resolveRuleValue(
      input.league.ruleConfig.maxChallengeDistance,
      Number.POSITIVE_INFINITY
    ),
    maxChallengesPerMonth: resolveRuleValue(
      input.league.ruleConfig.maxChallengesPerMonth,
      Number.POSITIVE_INFINITY
    ),
  });

  if (ruleError) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: ruleError,
    });
  }
}
