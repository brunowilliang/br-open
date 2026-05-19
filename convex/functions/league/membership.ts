import { and, eq, type InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  leagueMembershipOverviewSchema,
  leagueMembershipSchema,
  ReorderLeagueRankingSchema,
  RequestLeagueJoinSchema,
  ReviewLeagueMembershipSchema,
} from "../../domains/league/contract";
import { leagueMembership } from "../../domains/league/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";

type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;
type OrmCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
type OrmMutationCtx = AuthenticatedCtx<MutationCtx>;

function serializeLeagueMembership(
  record: LeagueMembershipRecord,
  player: {
    avatarUrl?: string | null;
    fullName: string;
    nickname: string;
  }
) {
  return leagueMembershipSchema.parse({
    id: record.id,
    leagueId: record.leagueId,
    userId: record.userId,
    status: record.status,
    rankingPosition: record.rankingPosition ?? null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
    reviewedAt: record.reviewedAt ? record.reviewedAt.getTime() : null,
    player,
  });
}

async function getLeagueOrThrow(ctx: OrmCtx, leagueId: Id<"league">) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId },
  });

  if (!currentLeague) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Liga não encontrada.",
    });
  }

  return currentLeague;
}

async function getManagedLeagueOrThrow(ctx: OrmCtx, leagueId: Id<"league">) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId, managerUserId: ctx.userId },
  });

  if (!currentLeague) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Liga não encontrada para esse gestor.",
    });
  }

  return currentLeague;
}

function getMembershipByLeagueAndUser(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  userId: Id<"user">
) {
  return ctx.orm.query.leagueMembership.findFirst({
    where: { leagueId, userId },
  });
}

async function getMembershipByIdOrThrow(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  membershipId: Id<"leagueMembership">
) {
  const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: { id: membershipId, leagueId },
  });

  if (!currentMembership) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Solicitação não encontrada.",
    });
  }

  return currentMembership;
}

async function getPlayerSummary(ctx: OrmCtx, userId: Id<"user">) {
  const [user, playerProfile] = await Promise.all([
    ctx.orm.query.user.findFirst({ where: { id: userId } }),
    ctx.orm.query.playerProfile.findFirst({ where: { userId } }),
  ]);

  if (!user) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Usuário não encontrado.",
    });
  }

  const fullName = playerProfile?.fullName?.trim() || user.name;
  const nickname =
    playerProfile?.nickname?.trim() ||
    playerProfile?.fullName?.trim() ||
    user.name;

  return {
    avatarUrl: user.image ?? null,
    fullName,
    nickname,
  };
}

function serializeMembershipList(
  ctx: OrmCtx,
  records: LeagueMembershipRecord[]
) {
  return Promise.all(
    records.map(async (record) =>
      serializeLeagueMembership(
        record,
        await getPlayerSummary(ctx, record.userId)
      )
    )
  );
}

async function getNextRankingPosition(ctx: OrmCtx, leagueId: Id<"league">) {
  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    where: { leagueId, status: "active" },
  });

  return activeMemberships.length + 1;
}

async function updateMembership(
  ctx: OrmMutationCtx,
  currentMembership: LeagueMembershipRecord,
  values: Partial<LeagueMembershipRecord>
) {
  const [updatedMembership] = await ctx.orm
    .update(leagueMembership)
    .set(values)
    .where(eq(leagueMembership.id, currentMembership.id)!)
    .returning();

  return updatedMembership;
}

export const requestJoin = authMutation
  .input(RequestLeagueJoinSchema)
  .output(leagueMembershipSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueOrThrow(ctx, leagueId);
    const currentMembership = await getMembershipByLeagueAndUser(
      ctx,
      leagueId,
      ctx.userId
    );

    const isManagerOwner = currentLeague.managerUserId === ctx.userId;
    const isDiscoverable =
      currentLeague.visibility === "public" ||
      currentLeague.visibility === "invite_only";

    if (!(isManagerOwner || isDiscoverable)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa liga não está disponível para participação.",
      });
    }

    if (currentMembership?.status === "pending") {
      return serializeLeagueMembership(
        currentMembership,
        await getPlayerSummary(ctx, currentMembership.userId)
      );
    }

    if (currentMembership?.status === "active") {
      const normalizedMembership =
        currentMembership.rankingPosition == null
          ? await updateMembership(ctx, currentMembership, {
              rankingPosition: await getNextRankingPosition(ctx, leagueId),
              updatedAt: now,
            })
          : currentMembership;

      return serializeLeagueMembership(
        normalizedMembership,
        await getPlayerSummary(ctx, normalizedMembership.userId)
      );
    }

    if (isManagerOwner) {
      const rankingPosition = await getNextRankingPosition(ctx, leagueId);

      const membershipRecord = currentMembership
        ? await updateMembership(ctx, currentMembership, {
            rankingPosition,
            reviewedAt: now,
            status: "active",
            updatedAt: now,
          })
        : (
            await ctx.orm
              .insert(leagueMembership)
              .values({
                createdAt: now,
                leagueId,
                rankingPosition,
                reviewedAt: now,
                status: "active",
                updatedAt: now,
                userId: ctx.userId,
              })
              .returning()
          )[0];

      return serializeLeagueMembership(
        membershipRecord,
        await getPlayerSummary(ctx, membershipRecord.userId)
      );
    }

    const membershipRecord = currentMembership
      ? await updateMembership(ctx, currentMembership, {
          rankingPosition: null,
          reviewedAt: null,
          status: "pending",
          updatedAt: now,
        })
      : (
          await ctx.orm
            .insert(leagueMembership)
            .values({
              createdAt: now,
              leagueId,
              rankingPosition: null,
              reviewedAt: null,
              status: "pending",
              updatedAt: now,
              userId: ctx.userId,
            })
            .returning()
        )[0];

    return serializeLeagueMembership(
      membershipRecord,
      await getPlayerSummary(ctx, membershipRecord.userId)
    );
  });

export const getOverview = authQuery
  .input(RequestLeagueJoinSchema)
  .output(leagueMembershipOverviewSchema)
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;

    await getManagedLeagueOrThrow(ctx, leagueId);

    const [pendingRequests, ranking] = await Promise.all([
      ctx.orm.query.leagueMembership.findMany({
        limit: 500,
        orderBy: { createdAt: "asc" },
        where: { leagueId, status: "pending" },
      }),
      ctx.orm.query.leagueMembership.findMany({
        limit: 500,
        orderBy: { rankingPosition: "asc" },
        where: { leagueId, status: "active" },
      }),
    ]);

    return leagueMembershipOverviewSchema.parse({
      pendingRequests: await serializeMembershipList(ctx, pendingRequests),
      ranking: await serializeMembershipList(ctx, ranking),
    });
  });

export const approve = authMutation
  .input(ReviewLeagueMembershipSchema)
  .output(leagueMembershipSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    await getManagedLeagueOrThrow(ctx, leagueId);

    const currentMembership = await getMembershipByIdOrThrow(
      ctx,
      leagueId,
      input.membershipId as Id<"leagueMembership">
    );

    const rankingPosition =
      currentMembership.rankingPosition ??
      (await getNextRankingPosition(ctx, leagueId));

    const updatedMembership =
      currentMembership.status === "active"
        ? currentMembership
        : await updateMembership(ctx, currentMembership, {
            rankingPosition,
            reviewedAt: now,
            status: "active",
            updatedAt: now,
          });

    return serializeLeagueMembership(
      updatedMembership,
      await getPlayerSummary(ctx, updatedMembership.userId)
    );
  });

export const reject = authMutation
  .input(ReviewLeagueMembershipSchema)
  .output(leagueMembershipSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    await getManagedLeagueOrThrow(ctx, leagueId);

    const currentMembership = await getMembershipByIdOrThrow(
      ctx,
      leagueId,
      input.membershipId as Id<"leagueMembership">
    );

    const updatedMembership = await updateMembership(ctx, currentMembership, {
      rankingPosition: null,
      reviewedAt: now,
      status: "rejected",
      updatedAt: now,
    });

    return serializeLeagueMembership(
      updatedMembership,
      await getPlayerSummary(ctx, updatedMembership.userId)
    );
  });

export const reorderRanking = authMutation
  .input(ReorderLeagueRankingSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    await getManagedLeagueOrThrow(ctx, leagueId);

    const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
      limit: 500,
      where: { leagueId, status: "active" },
    });

    const activeMembershipIds = activeMemberships.map(
      (membership) => membership.id
    );
    const requestedIds = input.membershipIds;
    const hasSameLength = activeMembershipIds.length === requestedIds.length;
    const hasSameMembers = requestedIds.every((membershipId) =>
      activeMembershipIds.includes(membershipId as Id<"leagueMembership">)
    );

    if (!(hasSameLength && hasSameMembers)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "O ranking enviado não corresponde aos participantes ativos.",
      });
    }

    await Promise.all(
      requestedIds.map(async (membershipId, index) => {
        await ctx.orm
          .update(leagueMembership)
          .set({
            rankingPosition: index + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(leagueMembership.id, membershipId as Id<"leagueMembership">),
              eq(leagueMembership.leagueId, leagueId)
            )!
          );
      })
    );

    return { success: true };
  });
