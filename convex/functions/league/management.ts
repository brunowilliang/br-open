import { and, eq, type InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  CreateLeagueSchema,
  DeleteLeagueSchema,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_STORAGE,
  LeagueByIdSchema,
  UpdateLeagueSchema,
  leagueSchema,
} from "../../domains/league/contract";
import { league } from "../../domains/league/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";

type LeagueRecord = InferSelectModel<typeof league>;

function serializeLeague(record: LeagueRecord) {
  return leagueSchema.parse({
    ...record,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

async function getManagedLeagueOrThrow(
  ctx: AuthenticatedCtx<QueryCtx | MutationCtx>,
  leagueId: Id<"league">
) {
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

export const listMine = authQuery
  .output(leagueSchema.array())
  .query(async ({ ctx }) => {
    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
      where: { managerUserId: ctx.userId },
    });

    return leagues.map(serializeLeague);
  });

export const getById = authQuery
  .input(LeagueByIdSchema)
  .output(leagueSchema)
  .query(async ({ ctx, input }) => {
    const currentLeague = await getManagedLeagueOrThrow(
      ctx,
      input.leagueId as Id<"league">
    );

    return serializeLeague(currentLeague);
  });

export const create = authMutation
  .input(CreateLeagueSchema)
  .output(leagueSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();

    const [createdLeague] = await ctx.orm
      .insert(league)
      .values({
        ...input,
        managerUserId: ctx.userId,
        mode: DEFAULT_LEAGUE_MODE,
        coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
        avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return serializeLeague(createdLeague);
  });

export const update = authMutation
  .input(UpdateLeagueSchema)
  .output(leagueSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, leagueId);

    const [updatedLeague] = await ctx.orm
      .update(league)
      .set({
        name: input.name,
        description: input.description,
        regulation: input.regulation,
        city: input.city,
        state: input.state,
        locationNotes: input.locationNotes,
        visibility: input.visibility,
        categories: input.categories,
        ruleConfig: input.ruleConfig,
        coverStorageId: input.coverStorageId,
        avatarStorageId: input.avatarStorageId,
        updatedAt: now,
      })
      .where(
        and(
          eq(league.id, currentLeague.id),
          eq(league.managerUserId, currentLeague.managerUserId)
        )!
      )
      .returning();

    return serializeLeague(updatedLeague);
  });

export const remove = authMutation
  .input(DeleteLeagueSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, leagueId);

    await ctx.orm
      .delete(league)
      .where(
        and(
          eq(league.id, currentLeague.id),
          eq(league.managerUserId, currentLeague.managerUserId)
        )!
      );

    return { success: true };
  });
