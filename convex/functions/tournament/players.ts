import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import { normalizeUsernameLookup } from "../../domains/tournament/entry-rules";
import { tournamentPlayerCardSchema } from "../../domains/tournament/contract";
import { authQuery } from "../../lib/crpc";
import { serializePlayerCard } from "./_shared/guards";

/**
 * Exact-match username lookup for the doubles partner invite (invite design:
 * the organizer of the invite types the partner's exact username — no fuzzy
 * search). Normalizes input the same way invites store it (lowercase, trim;
 * see `normalizeUsernameLookup`). Only profiles WITH a username defined are
 * findable. Returns null when nothing matches.
 */
export const searchByUsername = authQuery
  .input(z.object({ username: z.string().min(1, "Informe o usuário.") }))
  .output(tournamentPlayerCardSchema.nullable())
  .query(async ({ ctx, input }) => {
    const normalized = normalizeUsernameLookup(input.username);
    if (normalized.length === 0) {
      return null;
    }

    const user = await ctx.orm.query.user.findFirst({
      where: { username: normalized },
    });
    // `username` unique index guarantees at most one user; profiles without
    // a username are never reachable here.
    if (!user?.username) {
      return null;
    }

    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { userId: user.id as Id<"user"> },
    });
    if (!profile) {
      return null;
    }

    return serializePlayerCard(ctx, {
      avatarStorageId: profile.avatarStorageId,
      fullName: profile.fullName,
      nickname: profile.nickname,
      playerProfileId: profile.id as string,
      username: user.username,
    });
  });
