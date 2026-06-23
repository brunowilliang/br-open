import { eq, type InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  isLeagueDiscoverableVisibility,
  leagueMembershipOverviewSchema,
  leagueMembershipSchema,
  ReorderLeagueRankingSchema,
  RequestLeagueJoinSchema,
  ReviewLeagueMembershipSchema,
} from "../../domains/league/contract";
import {
  canLeagueAcceptMember,
  resolveApprovedMembershipRankingPosition,
  resolveRankingReorderError,
} from "../../domains/league/membership-rules";
import { leagueMembership } from "../../domains/league/tables";
import { isActiveActorManager } from "../../domains/auth/actor-context";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import { scheduleLeagueNotification } from "../notification/events";
import {
  getViewerContext,
  requireActiveManager,
  requireActivePlayerProfile,
} from "../viewer/context";

type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;
type OrmCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
type OrmMutationCtx = AuthenticatedCtx<MutationCtx>;
type PlayerSummary = Parameters<typeof serializeLeagueMembership>[1];

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
    playerProfileId: record.playerProfileId,
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
  const organizationId = await requireActiveManager(ctx);
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId },
  });

  if (!currentLeague || currentLeague.organizationId !== organizationId) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Liga não encontrada para esse gestor.",
    });
  }

  return currentLeague;
}

async function canManageLeague(
  ctx: OrmCtx,
  organizationId: Id<"organization">
) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);
  const { activeActor } = viewerContext;

  return (
    activeActor.kind === "organization" &&
    activeActor.id === organizationId &&
    isActiveActorManager(activeActor)
  );
}

function getMembershipByLeagueAndPlayerProfile(
  ctx: OrmCtx,
  leagueId: Id<"league">,
  playerProfileId: Id<"playerProfile">
) {
  return ctx.orm.query.leagueMembership.findFirst({
    where: { leagueId, playerProfileId },
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

async function resolvePlayerProfileAvatarUrl(
  ctx: OrmCtx,
  storageId?: null | string
) {
  if (!storageId) {
    return null;
  }

  try {
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  } catch {
    return null;
  }
}

async function getOptionalPlayerSummary(
  ctx: OrmCtx,
  playerProfileId: Id<"playerProfile">
) {
  const playerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { id: playerProfileId },
  });

  if (!playerProfile) {
    return null;
  }

  const user = await ctx.orm.query.user.findFirst({
    where: { id: playerProfile.userId },
  });

  const fullName = playerProfile.fullName?.trim() || user?.name || "Jogador";
  const nickname =
    playerProfile.nickname?.trim() ||
    playerProfile.fullName?.trim() ||
    user?.name ||
    "Jogador";
  const avatarUrl = await resolvePlayerProfileAvatarUrl(
    ctx,
    playerProfile.avatarStorageId
  );

  return {
    avatarUrl: avatarUrl ?? user?.image ?? null,
    fullName,
    nickname,
  } satisfies PlayerSummary;
}

async function getPlayerSummary(
  ctx: OrmCtx,
  playerProfileId: Id<"playerProfile">
) {
  const playerSummary = await getOptionalPlayerSummary(ctx, playerProfileId);

  if (!playerSummary) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Usuário não encontrado.",
    });
  }

  return playerSummary;
}

async function serializeMembershipList(
  ctx: OrmCtx,
  records: LeagueMembershipRecord[]
) {
  const serializedRecords = await Promise.all(
    records.map(async (record) => {
      const playerSummary = await getOptionalPlayerSummary(
        ctx,
        record.playerProfileId as Id<"playerProfile">
      );

      return playerSummary
        ? serializeLeagueMembership(record, playerSummary)
        : null;
    })
  );

  return serializedRecords.filter((record) => record !== null);
}

async function getPlayerProfileUserId(
  ctx: OrmCtx,
  playerProfileId: Id<"playerProfile">
) {
  const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { id: playerProfileId },
  });

  if (!currentPlayerProfile) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Jogador nao encontrado.",
    });
  }

  return currentPlayerProfile.userId as Id<"user">;
}

async function getOrganizationMemberUserIds(
  ctx: OrmCtx,
  organizationId: Id<"organization">
) {
  const members = await ctx.orm.query.member.findMany({
    limit: 100,
    where: { organizationId },
  });

  return members
    .filter((currentMember) => ["owner", "admin"].includes(currentMember.role))
    .map((currentMember) => currentMember.userId as Id<"user">);
}

async function getNextRankingPosition(ctx: OrmCtx, leagueId: Id<"league">) {
  return resolveApprovedMembershipRankingPosition({
    highestRankingPosition: await getHighestRankingPosition(ctx, leagueId),
  });
}

async function countActiveLeagueMemberships(
  ctx: OrmCtx,
  leagueId: Id<"league">
) {
  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    where: { leagueId, status: "active" },
  });

  return activeMemberships.length;
}

async function getHighestRankingPosition(ctx: OrmCtx, leagueId: Id<"league">) {
  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    where: { leagueId, status: "active" },
  });

  return activeMemberships.reduce(
    (highestPosition, membership) =>
      Math.max(highestPosition, membership.rankingPosition ?? 0),
    0
  );
}

function assertLeagueHasAvailableSpot(input: {
  activeMembershipCount: number;
  maxPlayers?: null | number;
}) {
  if (!canLeagueAcceptMember(input)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Essa liga não possui vagas disponíveis.",
    });
  }
}

async function normalizeRankingPositions(
  ctx: OrmMutationCtx,
  leagueId: Id<"league">
) {
  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    orderBy: { rankingPosition: "asc" },
    where: { leagueId, status: "active" },
  });

  for (const [index, membership] of activeMemberships.entries()) {
    const nextPosition = index + 1;

    if (membership.rankingPosition === nextPosition) {
      continue;
    }

    await ctx.db.patch(membership.id as Id<"leagueMembership">, {
      rankingPosition: nextPosition,
      updatedAt: Date.now(),
    });
  }
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
    const playerProfileId = await requireActivePlayerProfile(ctx);
    const currentLeague = await getLeagueOrThrow(ctx, leagueId);
    const currentMembership = await getMembershipByLeagueAndPlayerProfile(
      ctx,
      leagueId,
      playerProfileId
    );

    if (currentMembership?.status === "pending") {
      const updatedMembership = await updateMembership(ctx, currentMembership, {
        rankingPosition: null,
        reviewedAt: null,
        status: "left",
        updatedAt: now,
      });

      return serializeLeagueMembership(
        updatedMembership,
        await getPlayerSummary(
          ctx,
          updatedMembership.playerProfileId as Id<"playerProfile">
        )
      );
    }

    const isDiscoverable = isLeagueDiscoverableVisibility(
      currentLeague.visibility
    );

    if (!isDiscoverable) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa liga não está disponível para participação.",
      });
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
        await getPlayerSummary(
          ctx,
          normalizedMembership.playerProfileId as Id<"playerProfile">
        )
      );
    }

    assertLeagueHasAvailableSpot({
      activeMembershipCount: await countActiveLeagueMemberships(ctx, leagueId),
      maxPlayers: currentLeague.maxPlayers ?? null,
    });

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
              playerProfileId,
              rankingPosition: null,
              reviewedAt: null,
              status: "pending",
              updatedAt: now,
            })
            .returning()
        )[0];

    const recipientUserIds = await getOrganizationMemberUserIds(
      ctx,
      currentLeague.organizationId as Id<"organization">
    );

    await scheduleLeagueNotification(ctx, {
      actorUserId: ctx.userId,
      eventType: "league.membership.requested",
      leagueId,
      metadata: { membershipId: membershipRecord.id },
      recipientUserIds,
    });

    return serializeLeagueMembership(
      membershipRecord,
      await getPlayerSummary(
        ctx,
        membershipRecord.playerProfileId as Id<"playerProfile">
      )
    );
  });

export const getOverview = authQuery
  .input(RequestLeagueJoinSchema)
  .output(leagueMembershipOverviewSchema)
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueOrThrow(ctx, leagueId);
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const activePlayerProfileId =
      viewerContext.activeActor.kind === "player"
        ? (viewerContext.activeActor.id as Id<"playerProfile">)
        : null;
    const [currentMembership, canManageCurrentLeague] = await Promise.all([
      activePlayerProfileId
        ? getMembershipByLeagueAndPlayerProfile(
            ctx,
            leagueId,
            activePlayerProfileId
          )
        : Promise.resolve(null),
      canManageLeague(ctx, currentLeague.organizationId as Id<"organization">),
    ]);
    const isDiscoverable = isLeagueDiscoverableVisibility(
      currentLeague.visibility
    );
    const isAcceptedViewer = currentMembership?.status === "active";

    if (!(canManageCurrentLeague || isAcceptedViewer || isDiscoverable)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa liga não está disponível para visualização.",
      });
    }

    const [pendingRequests, ranking] = await Promise.all([
      canManageCurrentLeague
        ? ctx.orm.query.leagueMembership.findMany({
            limit: 500,
            orderBy: { createdAt: "asc" },
            where: { leagueId, status: "pending" },
          })
        : Promise.resolve([]),
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

    const currentLeague = await getManagedLeagueOrThrow(ctx, leagueId);

    const currentMembership = await getMembershipByIdOrThrow(
      ctx,
      leagueId,
      input.membershipId as Id<"leagueMembership">
    );

    if (currentMembership.status !== "active") {
      assertLeagueHasAvailableSpot({
        activeMembershipCount: await countActiveLeagueMemberships(
          ctx,
          leagueId
        ),
        maxPlayers: currentLeague.maxPlayers ?? null,
      });
    }

    const rankingPosition = resolveApprovedMembershipRankingPosition({
      currentRankingPosition: currentMembership.rankingPosition,
      highestRankingPosition: await getHighestRankingPosition(ctx, leagueId),
    });

    const updatedMembership =
      currentMembership.status === "active"
        ? currentMembership
        : await updateMembership(ctx, currentMembership, {
            rankingPosition,
            reviewedAt: now,
            status: "active",
            updatedAt: now,
          });

    await scheduleLeagueNotification(ctx, {
      actorUserId: ctx.userId,
      eventType: "league.membership.approved",
      leagueId,
      metadata: { membershipId: updatedMembership.id },
      recipientUserIds: [
        await getPlayerProfileUserId(
          ctx,
          updatedMembership.playerProfileId as Id<"playerProfile">
        ),
      ],
    });

    return serializeLeagueMembership(
      updatedMembership,
      await getPlayerSummary(
        ctx,
        updatedMembership.playerProfileId as Id<"playerProfile">
      )
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

    await scheduleLeagueNotification(ctx, {
      actorUserId: ctx.userId,
      eventType: "league.membership.rejected",
      leagueId,
      metadata: { membershipId: updatedMembership.id },
      recipientUserIds: [
        await getPlayerProfileUserId(
          ctx,
          updatedMembership.playerProfileId as Id<"playerProfile">
        ),
      ],
    });

    return serializeLeagueMembership(
      updatedMembership,
      await getPlayerSummary(
        ctx,
        updatedMembership.playerProfileId as Id<"playerProfile">
      )
    );
  });

export const remove = authMutation
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
      status: "removed",
      updatedAt: now,
    });

    await normalizeRankingPositions(ctx, leagueId);

    await scheduleLeagueNotification(ctx, {
      actorUserId: ctx.userId,
      eventType: "league.membership.removed",
      leagueId,
      metadata: { membershipId: updatedMembership.id },
      recipientUserIds: [
        await getPlayerProfileUserId(
          ctx,
          updatedMembership.playerProfileId as Id<"playerProfile">
        ),
      ],
    });

    return serializeLeagueMembership(
      updatedMembership,
      await getPlayerSummary(
        ctx,
        updatedMembership.playerProfileId as Id<"playerProfile">
      )
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

    const requestedMembershipIds = input.membershipIds;
    const reorderError = resolveRankingReorderError({
      activeMembershipIds: activeMemberships.map((membership) =>
        String(membership.id)
      ),
      requestedMembershipIds,
    });

    if (reorderError) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: reorderError,
      });
    }

    for (const [index, membershipId] of requestedMembershipIds.entries()) {
      await ctx.db.patch(membershipId as Id<"leagueMembership">, {
        rankingPosition: index + 1,
        updatedAt: now.getTime(),
      });
    }

    return { success: true };
  });
