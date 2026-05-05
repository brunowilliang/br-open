import { authMutation, authQuery } from "../../lib/crpc";
import { PlayerProfileSchema } from "../../shared/zod-schemas/player-profile";
import { playerProfileTable } from "../schema";

export const get = authQuery
  .output(PlayerProfileSchema.nullable())
  .query(async ({ ctx }) => {
    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: ctx.userId },
    });

    return PlayerProfileSchema.nullable().parse(playerProfile);
  });

export const upsert = authMutation
  .input(PlayerProfileSchema)
  .output(PlayerProfileSchema.nullable())
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const values = {
      ...input,
      updatedAt: now,
    };

    await ctx.orm
      .insert(playerProfileTable)
      .values({
        ...values,
        createdAt: now,
        userId: ctx.userId,
      })
      .onConflictDoUpdate({
        target: playerProfileTable.userId,
        set: values,
      });

    const playerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: ctx.userId },
    });

    return PlayerProfileSchema.parse(playerProfile);
  });
