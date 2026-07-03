import type { Id } from "../../../functions/_generated/dataModel";
import { CRPCError } from "kitcn/server";
import { isActiveActorManager } from "../../../domains/auth/actor-context";
import type { League } from "../../../domains/league/contract";
import {
  getViewerContext,
  requireActivePlayerProfile,
} from "../../viewer/context";
import { serializeLeagueRecord } from "./serializers";
import type {
  LeagueChallengeRecord,
  LeagueMembershipRecord,
  OrmCtx,
} from "./types";

export async function getLeagueRecordOrThrow(
  ctx: OrmCtx,
  leagueId: Id<"league">
) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId },
  });

  if (!currentLeague) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Liga não encontrada.",
    });
  }

  return serializeLeagueRecord(currentLeague);
}

export async function canManageLeague(ctx: OrmCtx, currentLeague: League) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const { activeActor } = viewerContext;

  return (
    activeActor.kind === "organization" &&
    activeActor.id === currentLeague.organizationId &&
    isActiveActorManager(activeActor)
  );
}

export async function assertCanManageLeague(
  ctx: OrmCtx,
  currentLeague: League,
  message: string
) {
  if (await canManageLeague(ctx, currentLeague)) {
    return;
  }

  throw new CRPCError({
    code: "FORBIDDEN",
    message,
  });
}

export async function getChallengeRecordOrThrow(
  ctx: OrmCtx,
  challengeId: Id<"leagueChallenge">
) {
  const currentChallenge = await ctx.orm.query.leagueChallenge.findFirst({
    where: { id: challengeId },
  });

  if (!currentChallenge) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Desafio não encontrado.",
    });
  }

  return currentChallenge;
}

export async function getMembershipRecordByIdOrThrow(
  ctx: OrmCtx,
  membershipId: Id<"leagueMembership">
) {
  const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: { id: membershipId },
  });

  if (!currentMembership) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Participante não encontrado.",
    });
  }

  return currentMembership;
}

export function getActiveMembershipForPlayerProfile(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  playerProfileId: Id<"playerProfile">
) {
  return ctx.orm.query.leagueMembership.findFirst({
    where: {
      leagueId,
      playerProfileId,
      status: "active",
    },
  });
}

export async function getActiveViewerMembership(
  ctx: OrmCtx,
  leagueId: Id<"league">
) {
  const playerProfileId = await requireActivePlayerProfile(ctx);

  return getActiveMembershipForPlayerProfile(ctx, leagueId, playerProfileId);
}

export async function getActiveMembershipByIdOrThrow(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  membershipId: Id<"leagueMembership">
) {
  const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: {
      id: membershipId,
      leagueId,
      status: "active",
    },
  });

  if (!currentMembership) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "O participante informado não está ativo na liga.",
    });
  }

  return currentMembership;
}

export async function getViewerContextOrThrow(
  ctx: OrmCtx,
  leagueId: Id<"league">
) {
  const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
  const isManagerOwner = await canManageLeague(ctx, currentLeague);
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const activeMembership =
    isManagerOwner || viewerContext.activeActor.kind !== "player"
      ? null
      : await getActiveMembershipForPlayerProfile(
          ctx,
          leagueId,
          viewerContext.activeActor.id as Id<"playerProfile">
        );

  if (!(isManagerOwner || activeMembership)) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Você não pode acessar os desafios dessa liga.",
    });
  }

  return {
    activeMembership,
    currentLeague,
    isManagerOwner,
  };
}

export function assertParticipantAccess(input: {
  challenge: LeagueChallengeRecord;
  isManagerOwner: boolean;
  viewerMembership: LeagueMembershipRecord | null;
}) {
  if (input.isManagerOwner) {
    return;
  }

  const viewerMembershipId = input.viewerMembership?.id;
  const isParticipant =
    viewerMembershipId === input.challenge.challengerMembershipId ||
    viewerMembershipId === input.challenge.challengedMembershipId;

  if (!isParticipant) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Você não pode acessar esse desafio.",
    });
  }
}
