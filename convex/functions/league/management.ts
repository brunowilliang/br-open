import { and, eq, type InferSelectModel } from "kitcn/orm";
import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";

import {
  CreateLeagueSchema,
  DeleteLeagueSchema,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  LEGACY_DEFAULT_LEAGUE_STORAGE_IDS,
  LeagueByIdSchema,
  UpdateLeagueSchema,
  collectReplacedLeagueStorageIds,
  leagueSchema,
  normalizeLeagueVisibility,
} from "../../domains/league/contract";
import { league } from "../../domains/league/tables";
import { deleteStorageIds, resolveStorageUrl } from "../../shared/media-rules";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";

type LeagueRecord = InferSelectModel<typeof league>;

const isDeletableLeagueStorageId = (id: string) =>
  !(LEGACY_DEFAULT_LEAGUE_STORAGE_IDS as readonly string[]).includes(id);

async function serializeLeague(
  ctx: QueryCtx | MutationCtx,
  record: LeagueRecord
) {
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

async function getManagedLeagueOrThrow(
  ctx: AuthenticatedCtx<QueryCtx | MutationCtx>,
  input: {
    leagueId: Id<"league">;
    organizationId: Id<"organization">;
  }
) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: input.leagueId, organizationId: input.organizationId },
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
    const organizationId = await requireActiveManager(ctx);

    const leagues = await ctx.orm.query.league.findMany({
      limit: 100,
      orderBy: { createdAt: "desc" },
      where: { organizationId },
    });

    return Promise.all(
      leagues.map((currentLeague) => serializeLeague(ctx, currentLeague))
    );
  });

export const getById = authQuery
  .input(LeagueByIdSchema)
  .output(leagueSchema)
  .query(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);

    const currentLeague = await getManagedLeagueOrThrow(ctx, {
      leagueId: input.leagueId as Id<"league">,
      organizationId,
    });

    return serializeLeague(ctx, currentLeague);
  });

export const generateUploadUrl = authMutation
  .output(z.string())
  .mutation(async ({ ctx }) => {
    await requireActiveManager(ctx);

    return ctx.storage.generateUploadUrl();
  });

export const create = authMutation
  .input(CreateLeagueSchema)
  .output(leagueSchema)
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);

    const now = new Date();

    const [createdLeague] = await ctx.orm
      .insert(league)
      .values({
        ...input,
        organizationId,
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
    const organizationId = await requireActiveManager(ctx);

    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, {
      leagueId,
      organizationId,
    });
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
        maxPlayers: input.maxPlayers,
        monthlyPriceCents: input.monthlyPriceCents,
        priceBillingInterval: input.priceBillingInterval,
        ruleConfig: input.ruleConfig,
        coverStorageId: input.coverStorageId,
        avatarStorageId: input.avatarStorageId,
        updatedAt: now,
      })
      .where(
        and(
          eq(league.id, currentLeague.id),
          eq(league.organizationId, currentLeague.organizationId)
        )!
      )
      .returning();

    await deleteStorageIds(ctx, replacedStorageIds);

    return serializeLeague(ctx, updatedLeague);
  });

export const remove = authMutation
  .input(DeleteLeagueSchema)
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);

    const leagueId = input.leagueId as Id<"league">;

    const currentLeague = await getManagedLeagueOrThrow(ctx, {
      leagueId,
      organizationId,
    });
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
          eq(league.organizationId, currentLeague.organizationId)
        )!
      );

    await deleteStorageIds(ctx, replacedStorageIds);

    return { success: true };
  });
