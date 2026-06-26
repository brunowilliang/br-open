import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./generated/server";

import * as authTables from "../domains/auth/tables";
import {
  SEED_EMAIL_DOMAIN,
  SEED_EMAIL_PREFIX,
  SEED_LEAGUE_NAME_PREFIX,
  participantScenarioResultSchema,
  ParticipantScenarioSchema,
  seedPreviewResultSchema,
  SeedPreviewSchema,
} from "../domains/seed/contract";
import {
  defaultSeedRuleConfig,
  seedLeagueTemplates,
  seedPlayers,
} from "../domains/seed/data";
import {
  buildTargetLeagueMemberships,
  buildTargetLeagueChallengePlans,
  getNextTargetLeagueRankingPosition,
  shouldSeedScenarioLeagues,
} from "../domains/seed/plan";
import * as leagueTables from "../domains/league/tables";
import {
  ChallengeRuleConfigSchema,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_STORAGE,
  LeagueCourtsSchema,
  type LeagueMatchConfig,
} from "../domains/league/contract";
import * as playerTables from "../domains/player/tables";
import { privateMutation } from "../lib/crpc";

type SeedCtx = MutationCtx;
type LeagueRecord = InferSelectModel<typeof leagueTables.league>;
type LeagueMembershipRecord = InferSelectModel<
  typeof leagueTables.leagueMembership
>;
type SeedChallengePlan = ReturnType<
  typeof buildTargetLeagueChallengePlans<Id<"leagueMembership">>
>[number];
type SeedMembershipInput = {
  rankingPosition: number | null;
  status: "active" | "pending" | "rejected";
  userId: Id<"user">;
};
type TargetMembershipStatus = SeedMembershipInput["status"];
type SeedPlayerInput = {
  emailLocalPart: string;
  fullName: string;
  gender: "Feminino" | "Masculino";
  image: string;
  nickname: string;
};
type SeedLeagueTemplate = {
  categories: readonly string[];
  city: string;
  description: string;
  name: string;
  state: string;
  visibility: "private" | "public";
};

const SEED_COURT_ID = "seed-main-court";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CHALLENGE_LOCKED_STATUSES: ReadonlySet<string> = new Set([
  "confirmed",
  "finished",
  "pending_admin_result_validation",
  "pending_result_confirmation",
  "pending_result_submission",
] as const);
const TARGET_CHALLENGE_STATUS_CYCLE = [
  "pending_opponent_response",
  "confirmed",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_admin_result_validation",
  "pending_admin_decision",
  "finished",
] as const;
const TARGET_MEMBERSHIP_LABELS = {
  active: {
    emailSegment: "ranked",
    fullName: "Rankeado Seed",
    nickname: "Rank",
  },
  pending: {
    emailSegment: "request",
    fullName: "Solicitante Seed",
    nickname: "Req",
  },
  rejected: {
    emailSegment: "rejected",
    fullName: "Rejeitado Seed",
    nickname: "Rej",
  },
} as const satisfies Record<
  TargetMembershipStatus,
  {
    emailSegment: string;
    fullName: string;
    nickname: string;
  }
>;

function buildSeedEmail(localPart: string) {
  return `${SEED_EMAIL_PREFIX}${localPart}@${SEED_EMAIL_DOMAIN}`;
}

function buildSeedLeagueName(name: string) {
  return `${SEED_LEAGUE_NAME_PREFIX}${name}`;
}

function buildSeedLeagueKey(leagueId: Id<"league">) {
  return String(leagueId)
    .replaceAll(/[^a-zA-Z0-9]/g, "-")
    .slice(0, 12);
}

function buildTargetMembershipSeedPlayer(input: {
  index: number;
  leagueId: Id<"league">;
  status: TargetMembershipStatus;
}): SeedPlayerInput {
  const serial = String(input.index).padStart(3, "0");
  const isFemaleProfile = input.index % 2 === 0;
  const labels = TARGET_MEMBERSHIP_LABELS[input.status];

  return {
    emailLocalPart: `${labels.emailSegment}-${buildSeedLeagueKey(input.leagueId)}-${serial}`,
    fullName: `${labels.fullName} ${serial}`,
    gender: isFemaleProfile ? "Feminino" : "Masculino",
    image: isFemaleProfile
      ? "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
      : "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    nickname: `${labels.nickname} ${serial}`,
  };
}

function isSeedLeagueName(name?: string | null) {
  return name?.startsWith(SEED_LEAGUE_NAME_PREFIX) ?? false;
}

function isSeedUserEmail(email?: string | null) {
  return email?.startsWith(SEED_EMAIL_PREFIX) ?? false;
}

function buildSeedCourtAvailability() {
  const availableDay = [{ endMinute: 22 * 60, startMinute: 8 * 60 }];

  return {
    fri: availableDay,
    mon: availableDay,
    sat: availableDay,
    sun: availableDay,
    thu: availableDay,
    tue: availableDay,
    wed: availableDay,
  };
}

function buildSeedCourt() {
  return {
    availability: buildSeedCourtAvailability(),
    id: SEED_COURT_ID,
    name: "Quadra Seed",
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function formatMatchDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolvePlanMembershipId(
  plan: SeedChallengePlan,
  side: "challenged" | "challenger"
) {
  return side === "challenger" ? plan.challenger.id : plan.challenged.id;
}

function buildSeedScore(input: {
  challengedMembershipId: Id<"leagueMembership">;
  challengerMembershipId: Id<"leagueMembership">;
  matchConfig: LeagueMatchConfig;
  winnerSide: "challenged" | "challenger";
}) {
  const maxSets = Math.max(1, Math.trunc(input.matchConfig.bestOfSets));
  const requiredSetWins = Math.floor(maxSets / 2) + 1;
  const winnerMembershipId =
    input.winnerSide === "challenger"
      ? input.challengerMembershipId
      : input.challengedMembershipId;

  return {
    sets: Array.from({ length: requiredSetWins }, (_, setIndex) => {
      const isDecidingSet = setIndex === maxSets - 1;
      const isSuperTieBreak =
        isDecidingSet && input.matchConfig.finalSetMode === "super_tiebreak";
      const gamesPerSet =
        isDecidingSet && input.matchConfig.finalSetMode === "custom_set"
          ? input.matchConfig.finalSetGamesPerSet
          : input.matchConfig.gamesPerSet;
      const winnerScore = isSuperTieBreak
        ? input.matchConfig.finalSetSuperTieBreakPoints
        : gamesPerSet;
      const loserScore = Math.max(0, winnerScore - 2);

      return {
        challengedGames:
          input.winnerSide === "challenged" ? winnerScore : loserScore,
        challengerGames:
          input.winnerSide === "challenger" ? winnerScore : loserScore,
        kind: isSuperTieBreak ? "super_tiebreak" : "set",
      };
    }),
    winnerMembershipId,
  };
}

function getTargetChallengeDayOffset(
  status: (typeof TARGET_CHALLENGE_STATUS_CYCLE)[number],
  attempt: number
) {
  const cycleIndex = Math.floor(attempt / TARGET_CHALLENGE_STATUS_CYCLE.length);

  if (status === "pending_opponent_response" || status === "confirmed") {
    return cycleIndex + 1;
  }

  if (status === "finished") {
    return -(cycleIndex + 7);
  }

  return -(cycleIndex + 1);
}

function buildTargetChallengeResult(
  status: (typeof TARGET_CHALLENGE_STATUS_CYCLE)[number],
  attempt: number
): SeedChallengePlan["result"] {
  const winner = attempt % 2 === 0 ? "challenger" : "challenged";

  switch (status) {
    case "pending_result_confirmation":
      return {
        submittedBy: "challenger",
        winner,
      };
    case "pending_admin_result_validation":
    case "finished":
      return {
        confirmedBy: "challenged",
        submittedBy: "challenger",
        winner,
      };
    default:
      return;
  }
}

function buildAdditionalTargetChallengePlan(input: {
  activeMemberships: LeagueMembershipRecord[];
  attempt: number;
}): SeedChallengePlan {
  const rankedMemberships = input.activeMemberships
    .filter(
      (
        membership
      ): membership is LeagueMembershipRecord & { rankingPosition: number } =>
        typeof membership.rankingPosition === "number"
    )
    .toSorted((left, right) => left.rankingPosition - right.rankingPosition);

  if (rankedMemberships.length < 2) {
    throw new Error(
      "A liga alvo precisa ter pelo menos dois jogadores ativos."
    );
  }

  const challengerIndex = 1 + (input.attempt % (rankedMemberships.length - 1));
  const maxDistance = Math.min(4, challengerIndex);
  const distance = 1 + (input.attempt % maxDistance);
  const challengedIndex = challengerIndex - distance;
  const status =
    TARGET_CHALLENGE_STATUS_CYCLE[
      input.attempt % TARGET_CHALLENGE_STATUS_CYCLE.length
    ]!;
  const startMinute = 8 * 60 + (input.attempt % 8) * 60;

  return {
    challenged: {
      id: rankedMemberships[challengedIndex]!.id as Id<"leagueMembership">,
      rankingPosition: rankedMemberships[challengedIndex]!.rankingPosition,
    },
    challenger: {
      id: rankedMemberships[challengerIndex]!.id as Id<"leagueMembership">,
      rankingPosition: rankedMemberships[challengerIndex]!.rankingPosition,
    },
    dayOffset: getTargetChallengeDayOffset(status, input.attempt),
    endMinute: startMinute + 90,
    key: `extra-${input.attempt}`,
    result: buildTargetChallengeResult(status, input.attempt),
    resultValidationMode:
      status === "pending_admin_result_validation" ? "manual" : "automatic",
    startMinute,
    status,
  };
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
  T extends
    | "league"
    | "leagueChallenge"
    | "leagueChallengeAdminAction"
    | "leagueChallengeProposal"
    | "leagueChallengeResultSubmission"
    | "leagueMembership"
    | "playerProfile"
    | "user",
>(ctx: SeedCtx, tableName: T, ids: string[]) {
  for (const id of ids) {
    switch (tableName) {
      case "league":
        await ctx.orm
          .delete(leagueTables.league)
          .where(eq(leagueTables.league.id, id as Id<"league">)!);
        break;
      case "leagueChallenge":
        await ctx.orm
          .delete(leagueTables.leagueChallenge)
          .where(
            eq(leagueTables.leagueChallenge.id, id as Id<"leagueChallenge">)!
          );
        break;
      case "leagueChallengeAdminAction":
        await ctx.orm
          .delete(leagueTables.leagueChallengeAdminAction)
          .where(
            eq(
              leagueTables.leagueChallengeAdminAction.id,
              id as Id<"leagueChallengeAdminAction">
            )!
          );
        break;
      case "leagueChallengeProposal":
        await ctx.orm
          .delete(leagueTables.leagueChallengeProposal)
          .where(
            eq(
              leagueTables.leagueChallengeProposal.id,
              id as Id<"leagueChallengeProposal">
            )!
          );
        break;
      case "leagueChallengeResultSubmission":
        await ctx.orm
          .delete(leagueTables.leagueChallengeResultSubmission)
          .where(
            eq(
              leagueTables.leagueChallengeResultSubmission.id,
              id as Id<"leagueChallengeResultSubmission">
            )!
          );
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
  const [
    seedLeagues,
    seedUsers,
    memberships,
    playerProfiles,
    challenges,
    challengeAdminActions,
    challengeProposals,
    challengeResultSubmissions,
  ] = await Promise.all([
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
    ctx.orm.query.leagueChallenge.findMany({
      limit: 1500,
      orderBy: { createdAt: "asc" },
    }),
    ctx.orm.query.leagueChallengeAdminAction.findMany({
      limit: 1500,
      orderBy: { createdAt: "asc" },
    }),
    ctx.orm.query.leagueChallengeProposal.findMany({
      limit: 1500,
      orderBy: { createdAt: "asc" },
    }),
    ctx.orm.query.leagueChallengeResultSubmission.findMany({
      limit: 1500,
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  const seedLeagueIds = new Set(seedLeagues.map((league) => league.id));
  const seedUserIds = new Set(seedUsers.map((user) => user.id));
  const seedPlayerProfileIds = new Set(
    playerProfiles
      .filter((profile) => seedUserIds.has(profile.userId))
      .map((profile) => profile.id)
  );
  const seedMemberships = memberships.filter(
    (membership) =>
      seedLeagueIds.has(membership.leagueId) ||
      seedPlayerProfileIds.has(membership.playerProfileId)
  );
  const seedMembershipIds = new Set(
    seedMemberships.map((membership) => membership.id)
  );
  const seedChallengeIds = new Set(
    challenges
      .filter(
        (challenge) =>
          seedLeagueIds.has(challenge.leagueId) ||
          seedMembershipIds.has(challenge.challengerMembershipId) ||
          seedMembershipIds.has(challenge.challengedMembershipId)
      )
      .map((challenge) => challenge.id)
  );

  await deleteByIds(
    ctx,
    "leagueChallengeAdminAction",
    challengeAdminActions
      .filter((action) => seedChallengeIds.has(action.challengeId))
      .map((action) => action.id)
  );

  await deleteByIds(
    ctx,
    "leagueChallengeResultSubmission",
    challengeResultSubmissions
      .filter((submission) => seedChallengeIds.has(submission.challengeId))
      .map((submission) => submission.id)
  );

  await deleteByIds(
    ctx,
    "leagueChallengeProposal",
    challengeProposals
      .filter((proposal) => seedChallengeIds.has(proposal.challengeId))
      .map((proposal) => proposal.id)
  );

  await deleteByIds(ctx, "leagueChallenge", [...seedChallengeIds]);

  await deleteByIds(
    ctx,
    "leagueMembership",
    seedMemberships.map((membership) => membership.id)
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

async function ensureSeedUser(ctx: SeedCtx, input: SeedPlayerInput) {
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
  input: SeedPlayerInput
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
  const ensuredMemberships: LeagueMembershipRecord[] = [];

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

    ensuredMemberships.push(result.membership);
  }

  return { memberships: ensuredMemberships, membershipsCreated };
}

async function ensureSeedCourtForLeague(ctx: SeedCtx, league: LeagueRecord) {
  const parsedCourts = LeagueCourtsSchema.safeParse(league.courts ?? []);
  const existingCourt = parsedCourts.success ? parsedCourts.data[0] : null;

  if (existingCourt) {
    return existingCourt.id;
  }

  const seedCourt = buildSeedCourt();

  await ctx.db.patch(league.id as Id<"league">, {
    courts: [seedCourt],
    updatedAt: Date.now(),
  });

  return seedCourt.id;
}

async function ensureSeedChallenge(input: {
  courtId: string;
  ctx: SeedCtx;
  league: LeagueRecord;
  matchConfig: LeagueMatchConfig;
  plan: SeedChallengePlan;
  responseDeadlineHours: number;
}) {
  const challengerMembershipId = input.plan.challenger
    .id as Id<"leagueMembership">;
  const challengedMembershipId = input.plan.challenged
    .id as Id<"leagueMembership">;
  const existingChallenge = await input.ctx.orm.query.leagueChallenge.findFirst(
    {
      where: {
        challengedMembershipId,
        challengerMembershipId,
        leagueId: input.league.id as Id<"league">,
        status: input.plan.status,
      },
    }
  );

  if (existingChallenge) {
    return { created: false };
  }

  const now = new Date();
  const matchDate = formatMatchDate(addDays(now, input.plan.dayOffset));
  const createdAt = addDays(now, Math.min(input.plan.dayOffset - 1, 0));
  const responseDeadlineAt =
    input.plan.status === "pending_opponent_response"
      ? new Date(now.getTime() + input.responseDeadlineHours * 60 * 60 * 1000)
      : addDays(now, -1);
  const isLocked = CHALLENGE_LOCKED_STATUSES.has(input.plan.status);
  const challengeValidationMode =
    input.plan.status === "pending_admin_decision" ? "manual" : "automatic";
  const resultValidationMode = input.plan.resultValidationMode ?? "automatic";

  const [createdChallenge] = await input.ctx.orm
    .insert(leagueTables.leagueChallenge)
    .values({
      challengedMembershipId,
      challengerMembershipId,
      challengeValidationMode,
      confirmedAt: isLocked ? createdAt : undefined,
      createdAt,
      finishedAt: input.plan.status === "finished" ? addDays(now, -6) : null,
      leagueId: input.league.id as Id<"league">,
      lockedAt: isLocked ? createdAt : undefined,
      matchConfigSnapshot: input.matchConfig,
      resultValidationMode,
      status: input.plan.status,
      updatedAt: now,
    })
    .returning();

  const [createdProposal] = await input.ctx.orm
    .insert(leagueTables.leagueChallengeProposal)
    .values({
      challengeId: createdChallenge.id as Id<"leagueChallenge">,
      courtId: input.courtId,
      createdAt,
      endMinute: input.plan.endMinute,
      matchDate,
      proposedByMembershipId: challengerMembershipId,
      responseDeadlineAt,
      revisionNumber: 1,
      startMinute: input.plan.startMinute,
      status: isLocked ? "accepted" : "active",
    })
    .returning();

  await input.ctx.db.patch(createdChallenge.id as Id<"leagueChallenge">, {
    currentProposalId: createdProposal.id,
    updatedAt: now.getTime(),
  });

  if (input.plan.result) {
    const submittedByMembershipId = resolvePlanMembershipId(
      input.plan,
      input.plan.result.submittedBy
    ) as Id<"leagueMembership">;
    const confirmedByMembershipId = input.plan.result.confirmedBy
      ? (resolvePlanMembershipId(
          input.plan,
          input.plan.result.confirmedBy
        ) as Id<"leagueMembership">)
      : null;
    const submittedAt = addDays(now, Math.min(input.plan.dayOffset, -1));
    const score = buildSeedScore({
      challengedMembershipId,
      challengerMembershipId,
      matchConfig: input.matchConfig,
      winnerSide: input.plan.result.winner,
    });

    await input.ctx.orm
      .insert(leagueTables.leagueChallengeResultSubmission)
      .values({
        challengeId: createdChallenge.id as Id<"leagueChallenge">,
        confirmedAt: confirmedByMembershipId ? addDays(submittedAt, 1) : null,
        confirmedByMembershipId,
        score,
        submittedAt,
        submittedByMembershipId,
        winnerMembershipId: score.winnerMembershipId,
      })
      .returning();
  }

  return { created: true };
}

async function seedTargetLeagueChallenges(input: {
  ctx: SeedCtx;
  league: LeagueRecord;
  memberships: LeagueMembershipRecord[];
}) {
  const activeMemberships = input.memberships.filter(
    (membership) =>
      membership.status === "active" &&
      typeof membership.rankingPosition === "number"
  );
  const challengePlans = buildTargetLeagueChallengePlans({
    activeMemberships: activeMemberships.map((membership) => ({
      id: membership.id as Id<"leagueMembership">,
      rankingPosition: membership.rankingPosition,
    })),
  });

  if (challengePlans.length === 0) {
    return 0;
  }

  const ruleConfig = ChallengeRuleConfigSchema.parse(input.league.ruleConfig);
  const courtId = await ensureSeedCourtForLeague(input.ctx, input.league);
  let challengesCreated = 0;

  for (const plan of challengePlans) {
    const result = await ensureSeedChallenge({
      courtId,
      ctx: input.ctx,
      league: input.league,
      matchConfig: ruleConfig.matchConfig,
      plan,
      responseDeadlineHours: ruleConfig.responseDeadlineHours.value,
    });

    if (result.created) {
      challengesCreated += 1;
    }
  }

  return challengesCreated;
}

async function seedTargetLeague(
  ctx: SeedCtx,
  leagueId: Id<"league">,
  userIds: Id<"user">[]
) {
  const targetLeague = await getLeagueByIdOrThrow(ctx, leagueId);

  const activeMemberships = await ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    orderBy: { rankingPosition: "asc" },
    where: { leagueId, status: "active" },
  });

  const memberships = buildTargetLeagueMemberships({
    startingPosition: getNextTargetLeagueRankingPosition(activeMemberships),
    userIds,
  });

  const membershipResult = await ensureLeagueMemberships(
    ctx,
    leagueId,
    memberships
  );
  const challengesCreated = await seedTargetLeagueChallenges({
    ctx,
    league: targetLeague,
    memberships: membershipResult.memberships,
  });

  return {
    challengesCreated,
    membershipsCreated: membershipResult.membershipsCreated,
  };
}

async function countTargetLeagueMemberships(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  status: TargetMembershipStatus;
}) {
  const memberships = await input.ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    where: { leagueId: input.leagueId, status: input.status },
  });

  return memberships.length;
}

async function ensureTargetLeagueMembershipCount(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  status: TargetMembershipStatus;
  targetCount: number;
}) {
  const { ctx, leagueId, status, targetCount } = input;
  const activeMemberships =
    status === "active"
      ? await ctx.orm.query.leagueMembership.findMany({
          limit: 500,
          orderBy: { rankingPosition: "asc" },
          where: { leagueId, status: "active" },
        })
      : [];
  let membershipCount = await countTargetLeagueMemberships({
    ctx,
    leagueId,
    status,
  });
  let membershipsCreated = 0;
  let nextRankingPosition =
    status === "active"
      ? getNextTargetLeagueRankingPosition(activeMemberships)
      : null;
  let playerProfilesCreated = 0;
  let usersCreated = 0;
  let seedIndex = 1;
  const maxAttempts = targetCount + 200;

  while (membershipCount < targetCount && seedIndex <= maxAttempts) {
    const seedPlayer = buildTargetMembershipSeedPlayer({
      index: seedIndex,
      leagueId,
      status,
    });
    const userResult = await ensureSeedUser(ctx, seedPlayer);
    const profileResult = await ensureSeedPlayerProfile(
      ctx,
      userResult.user.id as Id<"user">,
      seedPlayer
    );
    const membershipResult = await ensureMembership(ctx, {
      leagueId,
      rankingPosition: nextRankingPosition,
      status,
      userId: userResult.user.id as Id<"user">,
    });

    if (userResult.created) {
      usersCreated += 1;
    }

    if (profileResult.created) {
      playerProfilesCreated += 1;
    }

    if (
      membershipResult.created &&
      membershipResult.membership.status === status
    ) {
      membershipsCreated += 1;
      membershipCount += 1;
      if (typeof nextRankingPosition === "number") {
        nextRankingPosition += 1;
      }
    }

    seedIndex += 1;
  }

  if (membershipCount < targetCount) {
    throw new Error("Nao foi possivel completar os jogadores da liga alvo.");
  }

  return {
    membershipsCreated,
    playerProfilesCreated,
    usersCreated,
  };
}

async function countTargetLeagueChallenges(
  ctx: SeedCtx,
  leagueId: Id<"league">
) {
  const challenges = await ctx.orm.query.leagueChallenge.findMany({
    limit: 500,
    where: { leagueId },
  });

  return challenges.length;
}

async function ensureTargetLeagueChallengeCount(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  targetCount: number;
}) {
  const league = await getLeagueByIdOrThrow(input.ctx, input.leagueId);
  const activeMemberships = await input.ctx.orm.query.leagueMembership.findMany(
    {
      limit: 500,
      orderBy: { rankingPosition: "asc" },
      where: { leagueId: input.leagueId, status: "active" },
    }
  );
  const ruleConfig = ChallengeRuleConfigSchema.parse(league.ruleConfig);
  const courtId = await ensureSeedCourtForLeague(input.ctx, league);
  let challengeCount = await countTargetLeagueChallenges(
    input.ctx,
    input.leagueId
  );
  let challengesCreated = 0;
  let attempt = 0;
  const maxAttempts = input.targetCount * 30 + 200;

  while (challengeCount < input.targetCount && attempt <= maxAttempts) {
    const plan = buildAdditionalTargetChallengePlan({
      activeMemberships,
      attempt,
    });
    const result = await ensureSeedChallenge({
      courtId,
      ctx: input.ctx,
      league,
      matchConfig: ruleConfig.matchConfig,
      plan,
      responseDeadlineHours: ruleConfig.responseDeadlineHours.value,
    });

    if (result.created) {
      challengeCount += 1;
      challengesCreated += 1;
    }

    attempt += 1;
  }

  if (challengeCount < input.targetCount) {
    throw new Error("Nao foi possivel completar os desafios da liga alvo.");
  }

  return challengesCreated;
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
    const result = await ensureLeagueMemberships(
      ctx,
      leagueOne.id as Id<"league">,
      buildLeagueOneMemberships(userIds, primaryUserId)
    );
    membershipsCreated += result.membershipsCreated;
  }

  if (leagueTwo) {
    const result = await ensureLeagueMemberships(
      ctx,
      leagueTwo.id as Id<"league">,
      buildLeagueTwoMemberships(userIds, primaryUserId)
    );
    membershipsCreated += result.membershipsCreated;
  }

  if (leagueThree) {
    const result = await ensureLeagueMemberships(
      ctx,
      leagueThree.id as Id<"league">,
      buildLeagueThreeMemberships(userIds, primaryUserId)
    );
    membershipsCreated += result.membershipsCreated;
  }

  if (leagueFour) {
    const result = await ensureLeagueMemberships(
      ctx,
      leagueFour.id as Id<"league">,
      buildLeagueFourMemberships(userIds)
    );
    membershipsCreated += result.membershipsCreated;
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

    const result = await ensureLeagueMemberships(
      ctx,
      primaryLeague.league.id as Id<"league">,
      buildPrimaryLeagueMemberships(userIds)
    );
    membershipsCreated += result.membershipsCreated;
  }

  return { leaguesCreated, membershipsCreated };
}

export const preview = privateMutation
  .input(SeedPreviewSchema)
  .output(seedPreviewResultSchema)
  .mutation(async ({ ctx, input }) => {
    const hasTargetLeagueCounts =
      typeof input.targetActiveMemberships === "number" ||
      typeof input.targetChallengeCount === "number" ||
      typeof input.targetPendingRequests === "number" ||
      typeof input.targetRejectedRequests === "number";

    if (hasTargetLeagueCounts && !input.targetLeagueId) {
      throw new Error("Informe targetLeagueId para criar dados na liga alvo.");
    }

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
    let challengesCreated = 0;

    const seedCoreResult = await seedCoreUsers(ctx);
    let playerProfilesCreated = seedCoreResult.playerProfilesCreated;
    let usersCreated = seedCoreResult.usersCreated;
    const { userIds } = seedCoreResult;
    if (shouldSeedScenarioLeagues(input)) {
      const leagueSeedResult = await seedLeagueScenarios(
        ctx,
        userIds,
        primaryUser?.id as Id<"user"> | undefined
      );
      leaguesCreated += leagueSeedResult.leaguesCreated;
      membershipsCreated += leagueSeedResult.membershipsCreated;
    }

    let targetLeagueLinked = false;

    if (input.targetLeagueId) {
      const targetLeagueSeedResult = await seedTargetLeague(
        ctx,
        input.targetLeagueId as Id<"league">,
        userIds
      );
      challengesCreated += targetLeagueSeedResult.challengesCreated;
      membershipsCreated += targetLeagueSeedResult.membershipsCreated;

      if (typeof input.targetActiveMemberships === "number") {
        const activeSeedResult = await ensureTargetLeagueMembershipCount({
          ctx,
          leagueId: input.targetLeagueId as Id<"league">,
          status: "active",
          targetCount: input.targetActiveMemberships,
        });
        membershipsCreated += activeSeedResult.membershipsCreated;
        playerProfilesCreated += activeSeedResult.playerProfilesCreated;
        usersCreated += activeSeedResult.usersCreated;
      }

      if (typeof input.targetPendingRequests === "number") {
        const pendingRequestSeedResult =
          await ensureTargetLeagueMembershipCount({
            ctx,
            leagueId: input.targetLeagueId as Id<"league">,
            status: "pending",
            targetCount: input.targetPendingRequests,
          });
        membershipsCreated += pendingRequestSeedResult.membershipsCreated;
        playerProfilesCreated += pendingRequestSeedResult.playerProfilesCreated;
        usersCreated += pendingRequestSeedResult.usersCreated;
      }

      if (typeof input.targetRejectedRequests === "number") {
        const rejectedRequestSeedResult =
          await ensureTargetLeagueMembershipCount({
            ctx,
            leagueId: input.targetLeagueId as Id<"league">,
            status: "rejected",
            targetCount: input.targetRejectedRequests,
          });
        membershipsCreated += rejectedRequestSeedResult.membershipsCreated;
        playerProfilesCreated +=
          rejectedRequestSeedResult.playerProfilesCreated;
        usersCreated += rejectedRequestSeedResult.usersCreated;
      }

      if (typeof input.targetChallengeCount === "number") {
        challengesCreated += await ensureTargetLeagueChallengeCount({
          ctx,
          leagueId: input.targetLeagueId as Id<"league">,
          targetCount: input.targetChallengeCount,
        });
      }

      targetLeagueLinked = true;
    }

    const skipped =
      !input.reset &&
      challengesCreated === 0 &&
      leaguesCreated === 0 &&
      membershipsCreated === 0 &&
      playerProfilesCreated === 0 &&
      usersCreated === 0;

    return {
      challengesCreated,
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

async function findViewerMembership(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  playerProfileId: Id<"playerProfile">;
}) {
  const membership = await input.ctx.orm.query.leagueMembership.findFirst({
    where: {
      leagueId: input.leagueId,
      playerProfileId: input.playerProfileId,
    },
  });

  if (!membership) {
    throw new Error("Viewer não possui membership nessa liga.");
  }

  return membership;
}

async function resolveViewerAsParticipant(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  playerProfileId: Id<"playerProfile">;
}) {
  let membership = await findViewerMembership(input);

  // Garante status active + posição de ranking para que o participant overview
  // tenha dados (posição, desafios) para exibir.
  if (membership.status !== "active") {
    const activeCount = await input.ctx.orm.query.leagueMembership.findMany({
      limit: 500,
      where: { leagueId: input.leagueId, status: "active" },
    });

    const nextPosition =
      activeCount.reduce(
        (max, item) => Math.max(max, item.rankingPosition ?? 0),
        0
      ) + 1;

    await input.ctx.db.patch(membership.id as Id<"leagueMembership">, {
      rankingPosition: nextPosition,
      reviewedAt: Date.now(),
      status: "active",
      updatedAt: Date.now(),
    });

    membership = await findViewerMembership(input);
  }

  if (membership.rankingPosition === null) {
    const activeCount = await input.ctx.orm.query.leagueMembership.findMany({
      limit: 500,
      where: { leagueId: input.leagueId, status: "active" },
    });

    const nextPosition =
      activeCount.reduce(
        (max, item) => Math.max(max, item.rankingPosition ?? 0),
        0
      ) + 1;

    await input.ctx.db.patch(membership.id as Id<"leagueMembership">, {
      rankingPosition: nextPosition,
      updatedAt: Date.now(),
    });

    membership = await findViewerMembership(input);
  }

  return membership as LeagueMembershipRecord & {
    rankingPosition: number;
    status: "active";
  };
}

async function ensureOpponentsForViewer(input: {
  ctx: SeedCtx;
  leagueId: Id<"league">;
  viewerPosition: number;
}): Promise<{
  opponents: LeagueMembershipRecord[];
  playerProfilesCreated: number;
  usersCreated: number;
}> {
  const existingActive = await input.ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    orderBy: { rankingPosition: "asc" },
    where: { leagueId: input.leagueId, status: "active" },
  });

  // Precisamos de oponentes ACIMA do viewer (menor posição) e ABAIXO.
  // Se já há jogadores suficientes, reutiliza; senão cria novos.
  const needed = Math.max(0, 6 - existingActive.length);
  let nextPosition =
    existingActive.reduce(
      (max, item) => Math.max(max, item.rankingPosition ?? 0),
      0
    ) + 1;
  let usersCreated = 0;
  let playerProfilesCreated = 0;

  for (let index = 0; index < needed; index += 1) {
    const seedPlayer = buildTargetMembershipSeedPlayer({
      index: index + 100,
      leagueId: input.leagueId,
      status: "active",
    });
    const userResult = await ensureSeedUser(input.ctx, seedPlayer);

    if (userResult.created) {
      usersCreated += 1;
    }

    const profileResult = await ensureSeedPlayerProfile(
      input.ctx,
      userResult.user.id as Id<"user">,
      seedPlayer
    );

    if (profileResult.created) {
      playerProfilesCreated += 1;
    }

    await ensureMembership(input.ctx, {
      leagueId: input.leagueId,
      rankingPosition: nextPosition,
      status: "active",
      userId: userResult.user.id as Id<"user">,
    });

    nextPosition += 1;
  }

  const opponents = await input.ctx.orm.query.leagueMembership.findMany({
    limit: 500,
    orderBy: { rankingPosition: "asc" },
    where: { leagueId: input.leagueId, status: "active" },
  });

  return {
    opponents,
    playerProfilesCreated,
    usersCreated,
  };
}

function buildViewerChallengePlans(input: {
  opponents: LeagueMembershipRecord[];
  viewer: LeagueMembershipRecord & {
    rankingPosition: number;
    status: "active";
  };
}): SeedChallengePlan[] {
  const viewerId = input.viewer.id as Id<"leagueMembership">;
  const viewerPosition = input.viewer.rankingPosition;
  const above = input.opponents
    .filter(
      (m): m is LeagueMembershipRecord & { rankingPosition: number } =>
        m.id !== viewerId &&
        typeof m.rankingPosition === "number" &&
        m.rankingPosition < viewerPosition
    )
    .toSorted((a, b) => b.rankingPosition - a.rankingPosition); // mais perto primeiro
  const below = input.opponents
    .filter(
      (m): m is LeagueMembershipRecord & { rankingPosition: number } =>
        m.id !== viewerId &&
        typeof m.rankingPosition === "number" &&
        m.rankingPosition > viewerPosition
    )
    .toSorted((a, b) => a.rankingPosition - b.rankingPosition);

  const plans: SeedChallengePlan[] = [];

  // 1. Vitória finalizada (no mês) — viewer desafiou alguém acima e venceu.
  if (above[0]) {
    plans.push({
      challenged: {
        id: above[0].id as Id<"leagueMembership">,
        rankingPosition: above[0].rankingPosition,
      },
      challenger: { id: viewerId, rankingPosition: viewerPosition },
      dayOffset: -3,
      endMinute: 690,
      key: "viewer-finished-win",
      result: {
        confirmedBy: "challenged",
        submittedBy: "challenger",
        winner: "challenger",
      },
      startMinute: 600,
      status: "finished",
    });
  }

  // 2. Derrota finalizada (no mês) — viewer foi desafiado por alguém abaixo e perdeu.
  if (below[0]) {
    plans.push({
      challenged: { id: viewerId, rankingPosition: viewerPosition },
      challenger: {
        id: below[0].id as Id<"leagueMembership">,
        rankingPosition: below[0].rankingPosition,
      },
      dayOffset: -5,
      endMinute: 750,
      key: "viewer-finished-loss",
      result: {
        confirmedBy: "challenged",
        submittedBy: "challenger",
        winner: "challenger",
      },
      startMinute: 660,
      status: "finished",
    });
  }

  // 3. Pendente: viewer precisa registrar placar (jogo já passou, sem placar).
  if (above[1]) {
    plans.push({
      challenged: {
        id: above[1].id as Id<"leagueMembership">,
        rankingPosition: above[1].rankingPosition,
      },
      challenger: { id: viewerId, rankingPosition: viewerPosition },
      dayOffset: -1,
      endMinute: 810,
      key: "viewer-pending-submission",
      startMinute: 720,
      status: "pending_result_submission",
    });
  }

  // 4. Pendente: adversário lançou placar, viewer precisa confirmar.
  if (below[1]) {
    plans.push({
      challenged: { id: viewerId, rankingPosition: viewerPosition },
      challenger: {
        id: below[1].id as Id<"leagueMembership">,
        rankingPosition: below[1].rankingPosition,
      },
      dayOffset: -2,
      endMinute: 870,
      key: "viewer-pending-confirmation",
      result: { submittedBy: "challenger", winner: "challenger" },
      startMinute: 780,
      status: "pending_result_confirmation",
    });
  }

  // 5..N. Agenda: desafios confirmados nos próximos 7 dias para testar a tela
  // de Agenda. Combina jogos do viewer contra oponentes e jogos entre outros
  // oponentes (pra a agenda ficar cheia mesmo sem o viewer). Horários no
  // mesmo dia nunca se sobrepõem (todos usam a mesma quadra).
  const allRanked = [...above, ...below];

  const scheduleSeeds: Array<{
    challenged: LeagueMembershipRecord & { rankingPosition: number };
    challenger: LeagueMembershipRecord & { rankingPosition: number };
    dayOffset: number;
    endMinute: number;
    key: string;
    startMinute: number;
  }> = [];

  const pushSchedule = (
    challenged: (typeof allRanked)[number] | undefined,
    challenger: (typeof allRanked)[number] | undefined,
    window: {
      dayOffset: number;
      endMinute: number;
      key: string;
      startMinute: number;
    }
  ) => {
    if (
      !(
        challenged &&
        challenger &&
        challenger.rankingPosition > challenged.rankingPosition
      )
    ) {
      return;
    }
    scheduleSeeds.push({ challenged, challenger, ...window });
  };

  // Hoje (offset 0): manhã, tarde e noite.
  pushSchedule(above[0], below[0], {
    dayOffset: 0,
    endMinute: 510,
    key: "viewer-agenda-d0-m1",
    startMinute: 420,
  });
  pushSchedule(above[2], below[2], {
    dayOffset: 0,
    endMinute: 660,
    key: "viewer-agenda-d0-m2",
    startMinute: 570,
  });
  pushSchedule(allRanked[1], allRanked[4], {
    dayOffset: 0,
    endMinute: 810,
    key: "viewer-agenda-d0-a1",
    startMinute: 720,
  });
  pushSchedule(allRanked[3], allRanked[6], {
    dayOffset: 0,
    endMinute: 960,
    key: "viewer-agenda-d0-e1",
    startMinute: 870,
  });
  // Amanhã (offset 1): manhã, tarde, noite.
  pushSchedule(allRanked[0], allRanked[5], {
    dayOffset: 1,
    endMinute: 480,
    key: "viewer-agenda-d1-m1",
    startMinute: 390,
  });
  pushSchedule(allRanked[2], allRanked[7], {
    dayOffset: 1,
    endMinute: 780,
    key: "viewer-agenda-d1-a1",
    startMinute: 690,
  });
  pushSchedule(allRanked[4], allRanked[8], {
    dayOffset: 1,
    endMinute: 1080,
    key: "viewer-agenda-d1-e1",
    startMinute: 990,
  });
  // +2 dias (offset 2): tarde e noite.
  pushSchedule(allRanked[1], allRanked[6], {
    dayOffset: 2,
    endMinute: 750,
    key: "viewer-agenda-d2-a1",
    startMinute: 660,
  });
  pushSchedule(allRanked[3], allRanked[9], {
    dayOffset: 2,
    endMinute: 1140,
    key: "viewer-agenda-d2-e1",
    startMinute: 1050,
  });
  // +3 dias (offset 3): manhã.
  pushSchedule(allRanked[0], allRanked[7], {
    dayOffset: 3,
    endMinute: 540,
    key: "viewer-agenda-d3-m1",
    startMinute: 450,
  });
  // +4 dias (offset 4): tarde e noite.
  pushSchedule(allRanked[2], allRanked[8], {
    dayOffset: 4,
    endMinute: 840,
    key: "viewer-agenda-d4-a1",
    startMinute: 750,
  });
  pushSchedule(allRanked[5], allRanked[9], {
    dayOffset: 4,
    endMinute: 1170,
    key: "viewer-agenda-d4-e1",
    startMinute: 1080,
  });
  // +5 dias (offset 5): manhã.
  pushSchedule(allRanked[1], allRanked[7], {
    dayOffset: 5,
    endMinute: 570,
    key: "viewer-agenda-d5-m1",
    startMinute: 480,
  });
  // +6 dias (offset 6): tarde.
  pushSchedule(allRanked[4], allRanked[8], {
    dayOffset: 6,
    endMinute: 900,
    key: "viewer-agenda-d6-a1",
    startMinute: 810,
  });

  for (const seed of scheduleSeeds) {
    plans.push({
      challenged: {
        id: seed.challenged.id as Id<"leagueMembership">,
        rankingPosition: seed.challenged.rankingPosition,
      },
      challenger: {
        id: seed.challenger.id as Id<"leagueMembership">,
        rankingPosition: seed.challenger.rankingPosition,
      },
      dayOffset: seed.dayOffset,
      endMinute: seed.endMinute,
      key: seed.key,
      startMinute: seed.startMinute,
      status: "confirmed",
    });
  }

  return plans;
}

export const participantScenario = privateMutation
  .input(ParticipantScenarioSchema)
  .output(participantScenarioResultSchema)
  .mutation(async ({ ctx, input }) => {
    const profile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: input.playerProfileId as Id<"playerProfile"> },
    });

    if (!profile) {
      throw new Error("Player profile não encontrado.");
    }

    // Busca a liga pelo nome dentro das organizações do player.
    const playerUser = await ctx.orm.query.user.findFirst({
      where: { id: profile.userId as Id<"user"> },
    });

    if (!playerUser) {
      throw new Error("Usuário do player não encontrado.");
    }

    const playerOrgs = await ctx.orm.query.member.findMany({
      limit: 50,
      where: { userId: playerUser.id as Id<"user"> },
    });

    const leagueName = input.leagueName ?? "Liga do Bruno";

    let targetLeague: LeagueRecord | undefined;

    for (const org of playerOrgs) {
      const orgLeagues = await ctx.orm.query.league.findMany({
        limit: 100,
        where: { organizationId: org.organizationId },
      });

      const found = orgLeagues.find((l) => l.name === leagueName);
      if (found) {
        targetLeague = found;
        break;
      }
    }

    if (!targetLeague) {
      throw new Error(
        `Liga "${leagueName}" não encontrada nas organizações do player.`
      );
    }

    // Atualiza a liga para ter penalidade por inatividade (testa o alerta).
    const currentRuleConfig = ChallengeRuleConfigSchema.parse(
      targetLeague.ruleConfig
    );

    if (!currentRuleConfig.hasInactivityPenalty) {
      await ctx.db.patch(targetLeague.id as Id<"league">, {
        ruleConfig: {
          ...currentRuleConfig,
          hasInactivityPenalty: true,
          inactivityPenaltyDays: 30,
          inactivityPenaltyType: "drop_one_position",
        },
        updatedAt: Date.now(),
      });
    }

    const viewer = await resolveViewerAsParticipant({
      ctx,
      leagueId: targetLeague.id as Id<"league">,
      playerProfileId: profile.id as Id<"playerProfile">,
    });

    const { opponents, playerProfilesCreated, usersCreated } =
      await ensureOpponentsForViewer({
        ctx,
        leagueId: targetLeague.id as Id<"league">,
        viewerPosition: viewer.rankingPosition,
      });

    const courtId = await ensureSeedCourtForLeague(ctx, targetLeague);
    const plans = buildViewerChallengePlans({ opponents, viewer });

    let challengesCreated = 0;
    const membershipsCreated = 0;

    for (const plan of plans) {
      const result = await ensureSeedChallenge({
        courtId,
        ctx,
        league: targetLeague,
        matchConfig: currentRuleConfig.matchConfig,
        plan,
        responseDeadlineHours: currentRuleConfig.responseDeadlineHours.value,
      });

      if (result.created) {
        challengesCreated += 1;
      }
    }

    return {
      challengesCreated,
      membershipsCreated,
      playerProfilesCreated,
      usersCreated,
    };
  });
