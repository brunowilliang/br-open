import type { InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import type { Id } from "../../functions/_generated/dataModel";

import {
  LeagueByIdSchema,
  leagueDiscoverySchema,
  leagueSchema,
} from "../../domains/league/contract";
import type { league, leagueMembership } from "../../domains/league/tables";
import { authQuery } from "../../lib/crpc";

type LeagueRecord = InferSelectModel<typeof league>;
type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;

function serializeLeague(record: LeagueRecord) {
  return leagueSchema.parse({
    ...record,
    courts: record.courts ?? [],
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function serializeLeagueDiscovery(
  record: LeagueRecord,
  options: {
    isManagerOwner: boolean;
    viewerMembershipStatus?: LeagueMembershipRecord["status"] | null;
  }
) {
  return leagueDiscoverySchema.parse({
    ...serializeLeague(record),
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

    return serializeLeagueDiscovery(currentLeague, {
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

    return leagues
      .filter((currentLeague) => {
        const isManagerOwner = currentLeague.managerUserId === ctx.userId;
        const isDiscoverable =
          currentLeague.visibility === "public" ||
          currentLeague.visibility === "invite_only";

        return isManagerOwner || isDiscoverable;
      })
      .map(serializeLeague);
  });
