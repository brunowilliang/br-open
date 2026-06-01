import { and, eq, type InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  CreateLeagueSchema,
  DeleteLeagueSchema,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  LeagueByIdSchema,
  UpdateLeagueSchema,
  collectReplacedLeagueStorageIds,
  leagueSchema,
} from "../../domains/league/contract";
import { league } from "../../domains/league/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";

type LeagueRecord = InferSelectModel<typeof league>;

async function resolveLeagueMediaUrl(
  ctx: QueryCtx | MutationCtx,
  storageId?: null | string
) {
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

async function serializeLeague(
  ctx: QueryCtx | MutationCtx,
  record: LeagueRecord
) {
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

async function deleteLeagueStorageIds(ctx: MutationCtx, storageIds: string[]) {
  for (const storageId of storageIds) {
    await ctx.storage.delete(storageId as Id<"_storage">);
  }
}

export const listMine = authQuery
  .output(leagueSchema.array())
  .query(async ({ ctx }) => {
    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
      where: { managerUserId: ctx.userId },
    });

    return Promise.all(
      leagues.map((currentLeague) => serializeLeague(ctx, currentLeague))
    );
  });

export const getById = authQuery
  .input(LeagueByIdSchema)
  .output(leagueSchema)
  .query(async ({ ctx, input }) => {
    const currentLeague = await getManagedLeagueOrThrow(
      ctx,
      input.leagueId as Id<"league">
    );

    return serializeLeague(ctx, currentLeague);
  });

export const generateUploadUrl = authMutation
  .output(z.string())
  .mutation(async ({ ctx }) => ctx.storage.generateUploadUrl());

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
        coverStorageId: input.coverStorageId,
        avatarStorageId: input.avatarStorageId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return serializeLeague(ctx, createdLeague);
  });

export const update = authMutation
  .input(UpdateLeagueSchema)
  .output(leagueSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, leagueId);
    const replacedStorageIds = collectReplacedLeagueStorageIds({
      next: input,
      previous: currentLeague,
    });

    const [updatedLeague] = await ctx.orm
      .update(league)
      .set({
        name: input.name,
        description: input.description,
        city: input.city,
        state: input.state,
        locationNotes: input.locationNotes,
        visibility: input.visibility,
        categories: input.categories,
        courts: input.courts,
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

    await deleteLeagueStorageIds(ctx, replacedStorageIds);

    return serializeLeague(ctx, updatedLeague);
  });

export const remove = authMutation
  .input(DeleteLeagueSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, leagueId);
    const replacedStorageIds = collectReplacedLeagueStorageIds({
      next: {
        avatarStorageId: null,
        coverStorageId: null,
      },
      previous: currentLeague,
    });

    await ctx.orm
      .delete(league)
      .where(
        and(
          eq(league.id, currentLeague.id),
          eq(league.managerUserId, currentLeague.managerUserId)
        )!
      );

    await deleteLeagueStorageIds(ctx, replacedStorageIds);

    return { success: true };
  });
