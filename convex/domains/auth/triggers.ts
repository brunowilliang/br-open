import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx } from "../../functions/generated/server";
import { buildPlayerDisplayName } from "../player/identity";
import { playerProfile } from "../player/tables";
import { DEFAULT_ACTOR_KIND } from "./actor-context";
import { userPreference } from "./tables";

type AuthTriggerCtx = Pick<MutationCtx, "db" | "orm">;

type AuthUserForPlayerProfile = {
  _id?: Id<"user">;
  id?: Id<"user">;
  name?: null | string;
};
type AuthSessionForPlayerProfile = {
  userId?: Id<"user"> | null;
};
type PlayerProfileRecord = InferSelectModel<typeof playerProfile>;

function assertAuthTriggerCtx(ctx: unknown): asserts ctx is AuthTriggerCtx {
  if (
    !(typeof ctx === "object" && ctx !== null && "db" in ctx && "orm" in ctx)
  ) {
    throw new Error("Auth trigger context is missing database access.");
  }
}

function getAuthUserId(user: AuthUserForPlayerProfile) {
  const userId = user.id ?? user._id;

  if (!userId) {
    throw new Error("Auth trigger user is missing an id.");
  }

  return userId;
}

function getAuthSessionUserId(session: AuthSessionForPlayerProfile) {
  if (!session.userId) {
    throw new Error("Auth trigger session is missing a user id.");
  }

  return session.userId;
}

export function buildInitialPlayerProfileValues<UserId extends string>(input: {
  name?: null | string;
  now: Date;
  userId: UserId;
}) {
  const playerName = buildPlayerDisplayName({
    name: input.name,
    userId: input.userId,
  });

  return {
    avatarStorageId: null,
    createdAt: input.now,
    fullName: playerName,
    nickname: playerName,
    updatedAt: input.now,
    userId: input.userId,
  };
}

function getMissingInitialPlayerProfileValues(
  user: AuthUserForPlayerProfile,
  currentPlayerProfile: PlayerProfileRecord
) {
  const playerName = buildPlayerDisplayName({
    name: user.name,
    userId: currentPlayerProfile.userId,
  });
  const values: Partial<PlayerProfileRecord> = {};

  if (!currentPlayerProfile.fullName?.trim()) {
    values.fullName = playerName;
  }

  if (!currentPlayerProfile.nickname?.trim()) {
    values.nickname = playerName;
  }

  return values;
}

export async function ensureInitialPlayerProfile(
  ctx: AuthTriggerCtx,
  user: AuthUserForPlayerProfile
) {
  const userId = getAuthUserId(user);
  const currentPlayerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { userId },
  });

  if (currentPlayerProfile) {
    const missingValues = getMissingInitialPlayerProfileValues(
      user,
      currentPlayerProfile
    );

    if (Object.keys(missingValues).length === 0) {
      return currentPlayerProfile;
    }

    const [updatedPlayerProfile] = await ctx.orm
      .update(playerProfile)
      .set({
        ...missingValues,
        updatedAt: new Date(),
      })
      .where(eq(playerProfile.id, currentPlayerProfile.id)!)
      .returning();

    return updatedPlayerProfile ?? currentPlayerProfile;
  }

  const [createdPlayerProfile] = await ctx.orm
    .insert(playerProfile)
    .values(
      buildInitialPlayerProfileValues({
        name: user.name,
        now: new Date(),
        userId,
      })
    )
    .returning();

  return createdPlayerProfile;
}

export async function ensureInitialUserPreference(
  ctx: AuthTriggerCtx,
  userId: Id<"user">
) {
  const currentPreference = await ctx.orm.query.userPreference.findFirst({
    where: { userId },
  });

  if (currentPreference) {
    return currentPreference;
  }

  const now = new Date();
  const [createdPreference] = await ctx.orm
    .insert(userPreference)
    .values({
      activeActorKind: DEFAULT_ACTOR_KIND,
      activeOrganizationId: null,
      createdAt: now,
      updatedAt: now,
      userId,
    })
    .returning();

  return createdPreference;
}

async function ensureInitialPlayerProfileForSession(
  ctx: AuthTriggerCtx,
  session: AuthSessionForPlayerProfile
) {
  const userId = getAuthSessionUserId(session);
  const user = await ctx.db.get(userId);

  if (!user) {
    return;
  }

  await ensureInitialPlayerProfile(ctx, {
    id: userId,
    name: user.name,
  });
  await ensureInitialUserPreference(ctx, userId);
}

export const authTriggers = {
  session: {
    create: {
      after: async (session: AuthSessionForPlayerProfile, ctx: unknown) => {
        assertAuthTriggerCtx(ctx);
        await ensureInitialPlayerProfileForSession(ctx, session);
      },
    },
  },
  user: {
    create: {
      after: async (user: AuthUserForPlayerProfile, ctx: unknown) => {
        assertAuthTriggerCtx(ctx);
        const userId = getAuthUserId(user);

        await ensureInitialPlayerProfile(ctx, user);
        await ensureInitialUserPreference(ctx, userId);
      },
    },
    update: {
      after: async (user: AuthUserForPlayerProfile, ctx: unknown) => {
        assertAuthTriggerCtx(ctx);
        const userId = getAuthUserId(user);

        await ensureInitialPlayerProfile(ctx, user);
        await ensureInitialUserPreference(ctx, userId);
      },
    },
  },
};
