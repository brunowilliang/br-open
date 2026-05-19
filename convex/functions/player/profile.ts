import { playerProfile } from "../../domains/player/tables";
import { playerProfileSchema } from "../../domains/player/contract";
import { authMutation, authQuery } from "../../lib/crpc";

export const get = authQuery
  .output(playerProfileSchema.nullable())
  .query(async ({ ctx }) => {
    const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: (playerProfile, { eq }) => eq(playerProfile.userId, ctx.userId),
    });

    return playerProfileSchema.nullable().parse(currentPlayerProfile);
  });

export const upsert = authMutation
  .input(playerProfileSchema)
  .output(playerProfileSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
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

    const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: (currentPlayerProfile, { eq }) =>
        eq(currentPlayerProfile.userId, ctx.userId),
    });

    return playerProfileSchema.parse(currentPlayerProfile);
  });
