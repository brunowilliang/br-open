import type { InferSelectModel } from "kitcn/orm";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";
import { playerProfile } from "../../domains/player/tables";
import { buildPlayerDisplayName } from "../../domains/player/identity";
import {
  collectReplacedPlayerAvatarStorageIds,
  playerProfileSchema,
  upsertPlayerProfileSchema,
} from "../../domains/player/contract";
import { authMutation, authQuery } from "../../lib/crpc";
import { requireActivePlayerProfile } from "../viewer/context";

type PlayerProfileRecord = InferSelectModel<typeof playerProfile>;

async function resolvePlayerAvatarUrl(
  ctx: QueryCtx | MutationCtx,
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

async function serializePlayerProfile(
  ctx: QueryCtx | MutationCtx,
  record: PlayerProfileRecord
) {
  const fullName = buildPlayerDisplayName({
    name: record.fullName,
    userId: record.userId,
  });
  const nickname = buildPlayerDisplayName({
    name: record.nickname ?? record.fullName,
    userId: record.userId,
  });

  return playerProfileSchema.parse({
    ...record,
    avatarStorageId: record.avatarStorageId ?? null,
    avatarUrl: await resolvePlayerAvatarUrl(ctx, record.avatarStorageId),
    fullName,
    nickname,
  });
}

async function deletePlayerAvatarStorageIds(
  ctx: MutationCtx,
  storageIds: string[]
) {
  for (const storageId of storageIds) {
    await ctx.storage.delete(storageId as Id<"_storage">);
  }
}

export const get = authQuery
  .output(playerProfileSchema.nullable())
  .query(async ({ ctx }) => {
    const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: (playerProfile, { eq }) => eq(playerProfile.userId, ctx.userId),
    });

    if (!currentPlayerProfile) {
      return null;
    }

    return serializePlayerProfile(ctx, currentPlayerProfile);
  });

export const generateUploadUrl = authMutation
  .output(z.string())
  .mutation(async ({ ctx }) => {
    await requireActivePlayerProfile(ctx);

    return ctx.storage.generateUploadUrl();
  });

export const upsert = authMutation
  .input(upsertPlayerProfileSchema)
  .output(playerProfileSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: (currentPlayerProfile, { eq }) =>
        eq(currentPlayerProfile.userId, ctx.userId),
    });
    const replacedStorageIds = collectReplacedPlayerAvatarStorageIds({
      next: input,
      previous: currentPlayerProfile,
    });
    const values = {
      ...input,
      updatedAt: now,
    };

    await ctx.orm
      .insert(playerProfile)
      .values({
        ...values,
        createdAt: now,
        userId: ctx.userId,
      })
      .onConflictDoUpdate({
        set: values,
        target: playerProfile.userId,
      });

    const nextPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: (currentPlayerProfile, { eq }) =>
        eq(currentPlayerProfile.userId, ctx.userId),
    });

    await deletePlayerAvatarStorageIds(ctx, replacedStorageIds);

    if (!nextPlayerProfile) {
      throw new Error("Player profile was not found after upsert.");
    }

    return serializePlayerProfile(ctx, nextPlayerProfile);
  });
