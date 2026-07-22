import type { Id } from "../_generated/dataModel";
import { defineMigration } from "../generated/migrations.gen";

type LegacyMembershipDoc = {
  playerProfileId?: Id<"playerProfile"> | null;
  userId?: Id<"user"> | null;
};

const PLAYER_NAME_FALLBACK = "Jogador";
const PLAYER_IDENTIFIER_LENGTH = 4;
const PLAYER_IDENTIFIER_MOD = 10 ** PLAYER_IDENTIFIER_LENGTH;

function buildPlayerIdentifier(userId: string) {
  let hash = 0;

  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) % PLAYER_IDENTIFIER_MOD;
  }

  return String(hash).padStart(PLAYER_IDENTIFIER_LENGTH, "0");
}

function buildPlayerDisplayName(input: {
  name?: null | string;
  userId?: null | string;
}) {
  const trimmedName = input.name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const trimmedUserId = input.userId?.trim();

  if (!trimmedUserId) {
    return PLAYER_NAME_FALLBACK;
  }

  return `${PLAYER_NAME_FALLBACK}#${buildPlayerIdentifier(trimmedUserId)}`;
}

function hasPatchValues(patch: Record<string, unknown>) {
  return Object.keys(patch).length > 0;
}

export const migration = defineMigration({
  description: "backfill league membership player profiles",
  id: "20260615_083100_backfill_league_membership_player_profiles",
  up: {
    migrateOne: async (ctx, doc) => {
      async function ensureLegacyPlayerProfile(userId: Id<"user">) {
        const existingPlayerProfile = await ctx.db
          .query("playerProfile")
          .withIndex("playerProfile_userId_unique", (query) =>
            query.eq("userId", userId)
          )
          .first();

        if (existingPlayerProfile?._id) {
          return existingPlayerProfile._id as Id<"playerProfile">;
        }

        const user = await ctx.db.get(userId);

        if (!user) {
          return null;
        }

        const now = Date.now();
        const playerName = buildPlayerDisplayName({
          name: typeof user.name === "string" ? user.name : null,
          userId,
        });

        return ctx.db.insert("playerProfile", {
          avatarStorageId: null,
          createdAt: now,
          fullName: playerName,
          nickname: playerName,
          updatedAt: now,
          userId,
        });
      }

      const membership = doc as LegacyMembershipDoc;
      const patch: Record<string, unknown> = {};

      if (!membership.playerProfileId && membership.userId) {
        const playerProfileId = await ensureLegacyPlayerProfile(
          membership.userId
        );

        if (playerProfileId) {
          patch.playerProfileId = playerProfileId;
        }
      }

      if ("userId" in membership) {
        patch.userId = undefined;
      }

      return hasPatchValues(patch) ? patch : undefined;
    },
    table: "leagueMembership",
  },
});
