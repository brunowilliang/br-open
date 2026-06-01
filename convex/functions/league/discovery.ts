import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import type { Id } from "../../functions/_generated/dataModel";
import type { QueryCtx } from "../../functions/generated/server";

import {
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  LeagueByIdSchema,
  leagueDiscoverySchema,
  leagueSchema,
} from "../../domains/league/contract";
import type { league, leagueMembership } from "../../domains/league/tables";
import { authQuery } from "../../lib/crpc";

type LeagueRecord = InferSelectModel<typeof league>;
type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;

async function resolveLeagueMediaUrl(ctx: QueryCtx, storageId?: null | string) {
  if (
    !storageId ||
    (LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(storageId)
  ) {
    return null;
  }

  try {
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  } catch {
    return null;
  }
}

async function serializeLeague(ctx: QueryCtx, record: LeagueRecord) {
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveLeagueMediaUrl(ctx, record.avatarStorageId),
    resolveLeagueMediaUrl(ctx, record.coverStorageId),
  ]);

  return leagueSchema.parse({
    ...record,
    avatarStorageId: record.avatarStorageId ?? null,
    coverStorageId: record.coverStorageId ?? null,
    avatarUrl,
    coverUrl,
    courts: record.courts ?? [],
    ruleConfig: {
      ...record.ruleConfig,
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

async function serializeLeagueDiscovery(
  ctx: QueryCtx,
  record: LeagueRecord,
  options: {
    isManagerOwner: boolean;
    viewerMembershipStatus?: LeagueMembershipRecord["status"] | null;
  }
) {
  return leagueDiscoverySchema.parse({
    ...(await serializeLeague(ctx, record)),
    isManagerOwner: options.isManagerOwner,
    viewerMembershipStatus: options.viewerMembershipStatus ?? null,
  });
}

export const getById = authQuery
  .input(LeagueByIdSchema)
  .output(leagueDiscoverySchema)
  .query(async ({ ctx, input }) => {
    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: input.leagueId as Id<"league"> },
    });

    if (!currentLeague) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Liga não encontrada.",
      });
    }

    const isManagerOwner = currentLeague.managerUserId === ctx.userId;
    const isDiscoverable =
      currentLeague.visibility === "public" ||
      currentLeague.visibility === "invite_only";

    if (!(isManagerOwner || isDiscoverable)) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Essa liga não está disponível para visualização.",
      });
    }

    const currentMembership = await ctx.orm.query.leagueMembership.findFirst({
      where: {
        leagueId: input.leagueId as Id<"league">,
        userId: ctx.userId,
      },
    });

    return serializeLeagueDiscovery(ctx, currentLeague, {
      isManagerOwner,
      viewerMembershipStatus: currentMembership?.status ?? null,
    });
  });

export const listAvailable = authQuery
  .output(leagueSchema.array())
  .query(async ({ ctx }) => {
    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
    });

    const visibleLeagues = leagues.filter((currentLeague) => {
      const isManagerOwner = currentLeague.managerUserId === ctx.userId;
      const isDiscoverable =
        currentLeague.visibility === "public" ||
        currentLeague.visibility === "invite_only";

      return isManagerOwner || isDiscoverable;
    });

    return Promise.all(
      visibleLeagues.map((currentLeague) => serializeLeague(ctx, currentLeague))
    );
  });
