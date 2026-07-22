import type { Id } from "../_generated/dataModel";
import { defineMigration } from "../generated/migrations.gen";

type LegacyNotificationDoc = {
  data?: Record<string, unknown>;
  eventType?: null | string;
  recipientActorKind?: null | string;
  recipientOrganizationId?: Id<"organization"> | null;
  recipientPlayerProfileId?: Id<"playerProfile"> | null;
  recipientUserId?: Id<"user"> | null;
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

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const migration = defineMigration({
  description: "backfill notification actor recipients",
  id: "20260615_083200_backfill_notification_actor_recipients",
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

      async function resolveLeagueOrganizationId(
        notification: LegacyNotificationDoc
      ) {
        const leagueId = readString(notification.data?.leagueId);

        if (!leagueId) {
          return null;
        }

        const league = await ctx.db.get(leagueId as Id<"league">);

        return (
          (league?.organizationId as Id<"organization"> | undefined) ?? null
        );
      }

      const notification = doc as LegacyNotificationDoc;
      const patch: Record<string, unknown> = {};

      if (
        notification.eventType === "league.membership.requested" &&
        !notification.recipientOrganizationId
      ) {
        const organizationId = await resolveLeagueOrganizationId(notification);

        if (organizationId) {
          patch.recipientActorKind = "organization";
          patch.recipientOrganizationId = organizationId;
          patch.recipientPlayerProfileId = undefined;
        }
      }

      if (
        !patch.recipientActorKind &&
        (!notification.recipientActorKind ||
          notification.recipientActorKind === "player")
      ) {
        patch.recipientActorKind = "player";

        if (
          !notification.recipientPlayerProfileId &&
          notification.recipientUserId
        ) {
          const playerProfileId = await ensureLegacyPlayerProfile(
            notification.recipientUserId
          );

          if (playerProfileId) {
            patch.recipientPlayerProfileId = playerProfileId;
          }
        }
      }

      return hasPatchValues(patch) ? patch : undefined;
    },
    table: "notificationFeed",
  },
});
