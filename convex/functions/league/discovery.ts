import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import type { Id } from "../../functions/_generated/dataModel";
import type { QueryCtx } from "../../functions/generated/server";

import {
  DEFAULT_LEAGUE_APPROVAL_MODE,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  LeagueByIdSchema,
  leagueDiscoverySchema,
  leagueSchema,
  isLeagueDiscoverableVisibility,
  normalizeLeagueVisibility,
} from "../../domains/league/contract";
import { getActiveMembershipLeagueIds } from "../../domains/league/discovery-list";
import type { league, leagueMembership } from "../../domains/league/tables";
import { resolveStorageUrl } from "../../shared/media-rules";
import { authQuery } from "../../lib/crpc";
import { getViewerContext } from "../viewer/context";

type LeagueRecord = InferSelectModel<typeof league>;
type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;

const isDeletableLeagueStorageId = (id: string) =>
  !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(id);

async function serializeLeague(ctx: QueryCtx, record: LeagueRecord) {
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveStorageUrl(ctx, record.avatarStorageId, {
      isDeletable: isDeletableLeagueStorageId,
    }),
    resolveStorageUrl(ctx, record.coverStorageId, {
      isDeletable: isDeletableLeagueStorageId,
    }),
  ]);

  return leagueSchema.parse({
    ...record,
    visibility: normalizeLeagueVisibility(record.visibility),
    avatarStorageId: record.avatarStorageId ?? null,
    coverStorageId: record.coverStorageId ?? null,
    avatarUrl,
    coverUrl,
    courts: record.courts ?? [],
    maxPlayers: record.maxPlayers ?? null,
    monthlyPriceCents:
      record.monthlyPriceCents ?? DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
    priceBillingInterval:
      record.priceBillingInterval ?? DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
    approvalMode: record.approvalMode ?? DEFAULT_LEAGUE_APPROVAL_MODE,
    ruleConfig: {
      ...record.ruleConfig,
      scheduleVisibility:
        record.ruleConfig?.scheduleVisibility ??
        DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
      challengeValidationMode:
        record.ruleConfig?.challengeValidationMode ??
        DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode:
        record.ruleConfig?.resultValidationMode ??
        DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    },
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

async function countActiveLeaguePlayers(ctx: QueryCtx, leagueId: Id<"league">) {
  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    where: { leagueId, status: "active" },
  });

  return activeMemberships.length;
}

async function serializeLeagueDiscovery(
  ctx: QueryCtx,
  record: LeagueRecord,
  options: {
    isManagerOwner: boolean;
    viewerMembershipId?: LeagueMembershipRecord["id"] | null;
    viewerMembershipStatus?: LeagueMembershipRecord["status"] | null;
  }
) {
  return leagueDiscoverySchema.parse({
    ...(await serializeLeague(ctx, record)),
    activePlayerCount: await countActiveLeaguePlayers(
      ctx,
      record.id as Id<"league">
    ),
    isManagerOwner: options.isManagerOwner,
    viewerMembershipId: options.viewerMembershipId ?? null,
    viewerMembershipStatus: options.viewerMembershipStatus ?? null,
  });
}

export const getById = authQuery
  .input(LeagueByIdSchema)
  .output(leagueDiscoverySchema)
  .query(async ({ ctx, input }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: input.leagueId as Id<"league"> },
    });

    if (!currentLeague) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Liga não encontrada.",
      });
    }

    const isManagerOwner =
      viewerContext.activeActor.kind === "organization" &&
      currentLeague.organizationId === viewerContext.activeActor.id;
    const isDiscoverable = isLeagueDiscoverableVisibility(
      currentLeague.visibility
    );

    if (!(isManagerOwner || isDiscoverable)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa liga não está disponível para visualização.",
      });
    }

    const currentMembership =
      viewerContext.activeActor.kind === "player"
        ? await ctx.orm.query.leagueMembership.findFirst({
            where: {
              leagueId: input.leagueId as Id<"league">,
              playerProfileId: viewerContext.activeActor
                .id as Id<"playerProfile">,
            },
          })
        : null;

    return serializeLeagueDiscovery(ctx, currentLeague, {
      isManagerOwner,
      viewerMembershipId: currentMembership?.id ?? null,
      viewerMembershipStatus: currentMembership?.status ?? null,
    });
  });

export const listAvailable = authQuery
  .output(leagueSchema.array())
  .query(async ({ ctx }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);
    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
    });

    const visibleLeagues = leagues.filter((currentLeague) => {
      const isManagerOwner =
        viewerContext.activeActor.kind === "organization" &&
        currentLeague.organizationId === viewerContext.activeActor.id;
      const isDiscoverable = isLeagueDiscoverableVisibility(
        currentLeague.visibility
      );

      return isManagerOwner || isDiscoverable;
    });

    return Promise.all(
      visibleLeagues.map((currentLeague) => serializeLeague(ctx, currentLeague))
    );
  });

export const listParticipating = authQuery
  .output(leagueSchema.array())
  .query(async ({ ctx }) => {
    const viewerContext = await getViewerContext(ctx, ctx.userId);

    if (viewerContext.activeActor.kind !== "player") {
      return [];
    }

    const memberships = await ctx.orm.query.leagueMembership.findMany({
      limit: 100,
      orderBy: { updatedAt: "desc" },
      where: {
        playerProfileId: viewerContext.activeActor.id as Id<"playerProfile">,
        status: "active",
      },
    });
    const leagueIds = getActiveMembershipLeagueIds(memberships);

    if (leagueIds.size === 0) {
      return [];
    }

    const leagueRecords = await Promise.all(
      [...leagueIds].map((leagueId) =>
        ctx.orm.query.league.findFirst({
          where: { id: leagueId as Id<"league"> },
        })
      )
    );
    const leagueById = new Map(
      leagueRecords
        .filter((currentLeague): currentLeague is LeagueRecord =>
          Boolean(currentLeague)
        )
        .map((currentLeague) => [currentLeague.id, currentLeague])
    );
    const participatingLeagues = [...leagueIds]
      .map((leagueId) => leagueById.get(leagueId as Id<"league">))
      .filter((currentLeague): currentLeague is LeagueRecord =>
        Boolean(currentLeague)
      );

    return Promise.all(
      participatingLeagues.map((currentLeague) =>
        serializeLeague(ctx, currentLeague)
      )
    );
  });
