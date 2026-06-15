import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./generated/server";

import * as authTables from "../domains/auth/tables";
import {
  SEED_EMAIL_DOMAIN,
  SEED_EMAIL_PREFIX,
  SEED_LEAGUE_NAME_PREFIX,
  seedPreviewResultSchema,
  SeedPreviewSchema,
} from "../domains/seed/contract";
import {
  defaultSeedRuleConfig,
  seedLeagueTemplates,
  seedPlayers,
} from "../domains/seed/data";
import * as leagueTables from "../domains/league/tables";
import {
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_STORAGE,
} from "../domains/league/contract";
import * as playerTables from "../domains/player/tables";
import { privateMutation } from "../lib/crpc";

type SeedCtx = MutationCtx;
type LeagueRecord = InferSelectModel<typeof leagueTables.league>;
type SeedMembershipInput = {
  rankingPosition: number | null;
  status: "active" | "pending" | "rejected";
  userId: Id<"user">;
};
type SeedLeagueTemplate = {
  categories: readonly string[];
  city: string;
  description: string;
  name: string;
  state: string;
  visibility: "private" | "public";
};

function buildSeedEmail(localPart: string) {
  return `${SEED_EMAIL_PREFIX}${localPart}@${SEED_EMAIL_DOMAIN}`;
}

function buildSeedLeagueName(name: string) {
  return `${SEED_LEAGUE_NAME_PREFIX}${name}`;
}

function isSeedLeagueName(name?: string | null) {
  return name?.startsWith(SEED_LEAGUE_NAME_PREFIX) ?? false;
}

function isSeedUserEmail(email?: string | null) {
  return email?.startsWith(SEED_EMAIL_PREFIX) ?? false;
}

async function listSeedLeagues(ctx: SeedCtx) {
  const leagues = await ctx.orm.query.league.findMany({
    limit: 500,
    orderBy: { createdAt: "asc" },
  });

  return leagues.filter((league) => isSeedLeagueName(league.name));
}

async function listSeedUsers(ctx: SeedCtx) {
  const users = await ctx.orm.query.user.findMany({
    limit: 500,
    orderBy: { createdAt: "asc" },
  });

  return users.filter((user) => isSeedUserEmail(user.email));
}

async function deleteByIds<
  T extends "league" | "leagueMembership" | "playerProfile" | "user",
>(ctx: SeedCtx, tableName: T, ids: string[]) {
  for (const id of ids) {
    switch (tableName) {
      case "league":
        await ctx.orm
          .delete(leagueTables.league)
          .where(eq(leagueTables.league.id, id as Id<"league">)!);
        break;
      case "leagueMembership":
        await ctx.orm
          .delete(leagueTables.leagueMembership)
          .where(
            eq(leagueTables.leagueMembership.id, id as Id<"leagueMembership">)!
          );
        break;
      case "playerProfile":
        await ctx.orm
          .delete(playerTables.playerProfile)
          .where(eq(playerTables.playerProfile.id, id as Id<"playerProfile">)!);
        break;
      case "user":
        await ctx.orm
          .delete(authTables.user)
          .where(eq(authTables.user.id, id as Id<"user">)!);
        break;
      default:
        throw new Error("Tabela de seed não suportada.");
    }
  }
}

async function resetSeedData(ctx: SeedCtx) {
  const [seedLeagues, seedUsers, memberships, playerProfiles] =
    await Promise.all([
      listSeedLeagues(ctx),
      listSeedUsers(ctx),
      ctx.orm.query.leagueMembership.findMany({
        limit: 1500,
        orderBy: { createdAt: "asc" },
      }),
      ctx.orm.query.playerProfile.findMany({
        limit: 500,
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const seedLeagueIds = new Set(seedLeagues.map((league) => league.id));
  const seedUserIds = new Set(seedUsers.map((user) => user.id));
  const seedPlayerProfileIds = new Set(
    playerProfiles
      .filter((profile) => seedUserIds.has(profile.userId))
      .map((profile) => profile.id)
  );

  await deleteByIds(
    ctx,
    "leagueMembership",
    memberships
      .filter(
        (membership) =>
          seedLeagueIds.has(membership.leagueId) ||
          seedPlayerProfileIds.has(membership.playerProfileId)
      )
      .map((membership) => membership.id)
  );

  await deleteByIds(
    ctx,
    "league",
    seedLeagues.map((league) => league.id)
  );

  await deleteByIds(
    ctx,
    "playerProfile",
    playerProfiles
      .filter((profile) => seedUserIds.has(profile.userId))
      .map((profile) => profile.id)
  );

  await deleteByIds(
    ctx,
    "user",
    seedUsers.map((user) => user.id)
  );
}

async function ensureSeedOrganization(ctx: SeedCtx, userId: Id<"user">) {
  const user = await ctx.orm.query.user.findFirst({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Usuario gestor nao encontrado.");
  }

  const slug = `seed-org-${String(userId).replaceAll(/[^a-zA-Z0-9]/g, "-")}`;
  const existingOrganization = await ctx.orm.query.organization.findFirst({
    where: { slug },
  });

  if (existingOrganization) {
    const existingMember = await ctx.orm.query.member.findFirst({
      where: {
        organizationId: existingOrganization.id as Id<"organization">,
        userId,
      },
    });

    if (!existingMember) {
      await ctx.orm.insert(authTables.member).values({
        createdAt: new Date(),
        organizationId: existingOrganization.id as Id<"organization">,
        role: "owner",
        userId,
      });
    }

    return existingOrganization;
  }

  const now = new Date();
  const [createdOrganization] = await ctx.orm
    .insert(authTables.organization)
    .values({
      createdAt: now,
      metadata: { seed: true },
      name: `Organizacao ${user.name}`,
      slug,
      updatedAt: now,
    })
    .returning();

  await ctx.orm.insert(authTables.member).values({
    createdAt: now,
    organizationId: createdOrganization.id as Id<"organization">,
    role: "owner",
    userId,
  });

  return createdOrganization;
}

async function ensureSeedUser(
  ctx: SeedCtx,
  input: (typeof seedPlayers)[number]
) {
  const email = buildSeedEmail(input.emailLocalPart);
  const existingUser = await ctx.orm.query.user.findFirst({
    where: { email },
  });

  if (existingUser) {
    return { created: false, user: existingUser };
  }

  const now = new Date();
  const [createdUser] = await ctx.orm
    .insert(authTables.user)
    .values({
      createdAt: now,
      email,
      emailVerified: true,
      image: input.image,
      name: input.fullName,
      updatedAt: now,
    })
    .returning();

  return { created: true, user: createdUser };
}

async function ensureSeedPlayerProfile(
  ctx: SeedCtx,
  userId: Id<"user">,
  input: (typeof seedPlayers)[number]
) {
  const existingProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { userId },
  });

  if (existingProfile) {
    return { created: false, profile: existingProfile };
  }

  const now = new Date();
  const [createdProfile] = await ctx.orm
    .insert(playerTables.playerProfile)
    .values({
      createdAt: now,
      fullName: input.fullName,
      gender: input.gender,
      nickname: input.nickname,
      phone: undefined,
      updatedAt: now,
      userId,
    })
    .returning();

  return { created: true, profile: createdProfile };
}

async function ensureLeague(
  ctx: SeedCtx,
  organizationId: Id<"organization">,
  template: SeedLeagueTemplate
) {
  const expectedName = buildSeedLeagueName(template.name);
  const managedLeagues = await ctx.orm.query.league.findMany({
    limit: 100,
    orderBy: { createdAt: "asc" },
    where: { organizationId },
  });

  const existingLeague = managedLeagues.find(
    (league) => league.name === expectedName
  );

  if (existingLeague) {
    return { created: false, league: existingLeague };
  }

  const now = new Date();
  const [createdLeague] = await ctx.orm
    .insert(leagueTables.league)
    .values({
      avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
      categories: [...template.categories],
      city: template.city,
      coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
      createdAt: now,
      description: template.description,
      locationNotes: "",
      maxPlayers: null,
      mode: DEFAULT_LEAGUE_MODE,
      monthlyPriceCents: DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
      name: expectedName,
      organizationId,
      priceBillingInterval: DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
      ruleConfig: defaultSeedRuleConfig,
      state: template.state,
      updatedAt: now,
      visibility: template.visibility,
    })
    .returning();

  return { created: true, league: createdLeague };
}

async function ensureMembership(
  ctx: SeedCtx,
  input: {
    leagueId: Id<"league">;
    rankingPosition?: number | null;
    status: string;
    userId: Id<"user">;
  }
) {
  const playerProfile = await ctx.orm.query.playerProfile.findFirst({
    where: { userId: input.userId },
  });

  if (!playerProfile) {
    throw new Error("Perfil de jogador seed nao encontrado.");
  }

  const existingMembership = await ctx.orm.query.leagueMembership.findFirst({
    where: {
      leagueId: input.leagueId,
      playerProfileId: playerProfile.id as Id<"playerProfile">,
    },
  });

  if (existingMembership) {
    return { created: false, membership: existingMembership };
  }

  const now = new Date();
  const [createdMembership] = await ctx.orm
    .insert(leagueTables.leagueMembership)
    .values({
      createdAt: now,
      leagueId: input.leagueId,
      playerProfileId: playerProfile.id as Id<"playerProfile">,
      rankingPosition: input.rankingPosition ?? null,
      reviewedAt: input.status === "pending" ? null : now,
      status: input.status,
      updatedAt: now,
    })
    .returning();

  return { created: true, membership: createdMembership };
}

async function getLeagueByIdOrThrow(ctx: SeedCtx, leagueId: Id<"league">) {
  const currentLeague = await ctx.orm.query.league.findFirst({
    where: { id: leagueId },
  });

  if (!currentLeague) {
    throw new Error("Liga alvo não encontrada.");
  }

  return currentLeague;
}

async function findPrimaryUser(ctx: SeedCtx, email?: string) {
  if (!email) {
    return null;
  }

  const currentUser = await ctx.orm.query.user.findFirst({
    where: { email },
  });

  if (!currentUser) {
    throw new Error(`Usuário principal não encontrado: ${email}`);
  }

  return currentUser;
}

async function seedCoreUsers(ctx: SeedCtx) {
  let usersCreated = 0;
  let playerProfilesCreated = 0;
  const users: Id<"user">[] = [];

  for (const seedPlayer of seedPlayers) {
    const userResult = await ensureSeedUser(ctx, seedPlayer);
    users.push(userResult.user.id as Id<"user">);

    if (userResult.created) {
      usersCreated += 1;
    }

    const profileResult = await ensureSeedPlayerProfile(
      ctx,
      userResult.user.id as Id<"user">,
      seedPlayer
    );

    if (profileResult.created) {
      playerProfilesCreated += 1;
    }
  }

  return { playerProfilesCreated, userIds: users, usersCreated };
}

function getActiveMemberships(
  userIds: Id<"user">[],
  positions: number[],
  startingPosition = 1
): SeedMembershipInput[] {
  return positions.map((userIndex, index) => ({
    rankingPosition: startingPosition + index,
    status: "active",
    userId: userIds[userIndex]!,
  }));
}

function getInactiveMemberships(
  userIds: Id<"user">[],
  positions: number[],
  status: "pending" | "rejected"
): SeedMembershipInput[] {
  return positions.map((userIndex) => ({
    rankingPosition: null,
    status,
    userId: userIds[userIndex]!,
  }));
}

function buildLeagueOneMemberships(
  userIds: Id<"user">[],
  primaryUserId?: Id<"user">
) {
  const memberships: SeedMembershipInput[] = [
    ...getActiveMemberships(userIds, [1, 2, 3, 4, 5, 6]),
    ...getInactiveMemberships(userIds, [8, 9], "pending"),
    ...getInactiveMemberships(userIds, [10], "rejected"),
  ];

  if (primaryUserId) {
    memberships.splice(2, 0, {
      rankingPosition: 3,
      status: "active",
      userId: primaryUserId,
    });

    let activePosition = 1;
    for (const membership of memberships) {
      if (membership.status !== "active") {
        continue;
      }

      membership.rankingPosition = activePosition;
      activePosition += 1;
    }
  }

  return memberships;
}

function buildLeagueTwoMemberships(
  userIds: Id<"user">[],
  primaryUserId?: Id<"user">
) {
  return [
    ...getActiveMemberships(userIds, [2, 4, 6, 8, 10]),
    primaryUserId
      ? {
          rankingPosition: null,
          status: "pending" as const,
          userId: primaryUserId,
        }
      : {
          rankingPosition: null,
          status: "pending" as const,
          userId: userIds[11]!,
        },
  ];
}

function buildLeagueThreeMemberships(
  userIds: Id<"user">[],
  primaryUserId?: Id<"user">
) {
  return [
    ...getActiveMemberships(userIds, [1, 3, 5, 7, 9]),
    primaryUserId
      ? {
          rankingPosition: null,
          status: "rejected" as const,
          userId: primaryUserId,
        }
      : {
          rankingPosition: null,
          status: "rejected" as const,
          userId: userIds[11]!,
        },
  ];
}

function buildLeagueFourMemberships(userIds: Id<"user">[]) {
  return [...getActiveMemberships(userIds, [0, 2, 4, 6, 8, 10])];
}

function buildPrimaryLeagueMemberships(userIds: Id<"user">[]) {
  return [
    ...getActiveMemberships(userIds, [0, 1, 2, 3, 4, 5]),
    ...getInactiveMemberships(userIds, [6, 7, 8], "pending"),
  ];
}

async function ensureLeagueMemberships(
  ctx: SeedCtx,
  leagueId: Id<"league">,
  memberships: SeedMembershipInput[]
) {
  let membershipsCreated = 0;

  for (const membership of memberships) {
    const result = await ensureMembership(ctx, {
      leagueId,
      rankingPosition: membership.rankingPosition,
      status: membership.status,
      userId: membership.userId,
    });

    if (result.created) {
      membershipsCreated += 1;
    }
  }

  return membershipsCreated;
}

async function seedTargetLeague(
  ctx: SeedCtx,
  leagueId: Id<"league">,
  userIds: Id<"user">[]
) {
  await getLeagueByIdOrThrow(ctx, leagueId);

  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    orderBy: { rankingPosition: "asc" },
    where: { leagueId, status: "active" },
  });

  const startingPosition = activeMemberships.length + 1;
  const memberships = [
    ...getActiveMemberships(userIds, [0, 1, 2, 3, 4, 5], startingPosition),
    ...getInactiveMemberships(userIds, [6, 7, 8], "pending"),
    ...getInactiveMemberships(userIds, [9], "rejected"),
    ...getActiveMemberships(userIds, [10, 11, 12, 13, 14, 15, 16, 17], 7),
    ...getInactiveMemberships(userIds, [18], "pending"),
    ...getInactiveMemberships(userIds, [19], "rejected"),
  ];

  return ensureLeagueMemberships(ctx, leagueId, memberships);
}

async function seedLeagueScenarios(
  ctx: SeedCtx,
  userIds: Id<"user">[],
  primaryUserId?: Id<"user">
) {
  let leaguesCreated = 0;
  let membershipsCreated = 0;
  const leagues: LeagueRecord[] = [];

  for (const [index, template] of seedLeagueTemplates.entries()) {
    const ownerUserId = userIds[index];

    if (!ownerUserId) {
      continue;
    }

    const organization = await ensureSeedOrganization(ctx, ownerUserId);
    const result = await ensureLeague(
      ctx,
      organization.id as Id<"organization">,
      template
    );

    if (result.created) {
      leaguesCreated += 1;
    }

    leagues.push(result.league);
  }

  const [leagueOne, leagueTwo, leagueThree, leagueFour] = leagues;

  if (leagueOne) {
    membershipsCreated += await ensureLeagueMemberships(
      ctx,
      leagueOne.id as Id<"league">,
      buildLeagueOneMemberships(userIds, primaryUserId)
    );
  }

  if (leagueTwo) {
    membershipsCreated += await ensureLeagueMemberships(
      ctx,
      leagueTwo.id as Id<"league">,
      buildLeagueTwoMemberships(userIds, primaryUserId)
    );
  }

  if (leagueThree) {
    membershipsCreated += await ensureLeagueMemberships(
      ctx,
      leagueThree.id as Id<"league">,
      buildLeagueThreeMemberships(userIds, primaryUserId)
    );
  }

  if (leagueFour) {
    membershipsCreated += await ensureLeagueMemberships(
      ctx,
      leagueFour.id as Id<"league">,
      buildLeagueFourMemberships(userIds)
    );
  }

  if (primaryUserId) {
    const primaryOrganization = await ensureSeedOrganization(
      ctx,
      primaryUserId
    );
    const primaryLeague = await ensureLeague(
      ctx,
      primaryOrganization.id as Id<"organization">,
      {
        categories: ["Todas", "A", "B"],
        city: "São Paulo",
        description: "Liga seedada para testar gestão como administrador.",
        name: "Minha Liga de Teste",
        state: "SP",
        visibility: "public",
      }
    );

    if (primaryLeague.created) {
      leaguesCreated += 1;
    }

    membershipsCreated += await ensureLeagueMemberships(
      ctx,
      primaryLeague.league.id as Id<"league">,
      buildPrimaryLeagueMemberships(userIds)
    );
  }

  return { leaguesCreated, membershipsCreated };
}

export const preview = privateMutation
  .input(SeedPreviewSchema)
  .output(seedPreviewResultSchema)
  .mutation(async ({ ctx, input }) => {
    if (input.reset) {
      await resetSeedData(ctx);
    }

    const existingSeedLeagues = await listSeedLeagues(ctx);
    const primaryUser = await findPrimaryUser(ctx, input.primaryUserEmail);

    if (existingSeedLeagues.length > 0 && !input.reset) {
      // Continue. The helpers below are idempotent and won't duplicate data.
    }

    let leaguesCreated = 0;
    let membershipsCreated = 0;

    const { playerProfilesCreated, userIds, usersCreated } =
      await seedCoreUsers(ctx);
    const leagueSeedResult = await seedLeagueScenarios(
      ctx,
      userIds,
      primaryUser?.id as Id<"user"> | undefined
    );
    leaguesCreated += leagueSeedResult.leaguesCreated;
    membershipsCreated += leagueSeedResult.membershipsCreated;

    let targetLeagueLinked = false;

    if (input.targetLeagueId) {
      membershipsCreated += await seedTargetLeague(
        ctx,
        input.targetLeagueId as Id<"league">,
        userIds
      );
      targetLeagueLinked = true;
    }

    const skipped =
      !input.reset &&
      leaguesCreated === 0 &&
      membershipsCreated === 0 &&
      playerProfilesCreated === 0 &&
      usersCreated === 0;

    return {
      leaguesCreated,
      membershipsCreated,
      playerProfilesCreated,
      primaryUserLinked: Boolean(primaryUser),
      resetApplied: Boolean(input.reset),
      skipped,
      targetLeagueLinked,
      usersCreated,
    };
  });
