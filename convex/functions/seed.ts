import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./generated/server";

import * as authTables from "../domains/auth/tables";
import {
  SEED_EMAIL_DOMAIN,
  SEED_EMAIL_PREFIX,
  SEED_LEAGUE_NAME_PREFIX,
  DoublesAgendaScenarioSchema,
  DoublesScenarioSchema,
  doublesAgendaScenarioResultSchema,
  doublesScenarioResultSchema,
  participantScenarioResultSchema,
  ParticipantScenarioSchema,
  pendencyScenarioResultSchema,
  PendencyScenarioSchema,
  seedPreviewResultSchema,
  SeedPreviewSchema,
  type DoublesAgendaScenarioResult,
  type DoublesScenarioResult,
} from "../domains/seed/contract";
import {
  defaultSeedRuleConfig,
  seedLeagueTemplates,
  seedPlayers,
} from "../domains/seed/data";
import {
  DOUBLES_SEED_AGENDA_ACTIVE_TARGET,
  DOUBLES_SEED_COURTS,
  resolveDoublesSeedAgendaSlot,
} from "../domains/seed/doubles-agenda-plan";
import {
  DOUBLES_SEED_ACTIVE_PAIRS,
  DOUBLES_SEED_CATEGORIES,
  DOUBLES_SEED_ENTRY_FEE_CENTS,
  DOUBLES_SEED_INVITE_PAIRS,
  DOUBLES_SEED_MAX_ENTRIES,
  DOUBLES_SEED_PROFILES,
  DOUBLES_SEED_TOURNAMENT,
  selectDoublesSeedPairs,
} from "../domains/seed/doubles-plan";
import {
  buildPendencyChargeCorrelationId,
  comparePendencyTargetRecency,
  PENDENCY_SEED_LAST_MATCH_DAYS_AGO,
  PENDENCY_SEED_LEAGUES,
  PENDENCY_SEED_ORGANIZATION_NAME,
  PENDENCY_SEED_PRIMARY_ENTRY_TARGETS,
  PENDENCY_SEED_PRIMARY_JOIN_REQUEST_LIMIT,
  PENDENCY_SEED_PRIMARY_ORGANIZATION_LIMIT,
  PENDENCY_SEED_PRIMARY_TOURNAMENT_STATUSES,
  PENDENCY_SEED_TOURNAMENTS,
  PENDENCY_SEED_VIEWER_GENDER,
  type PendencySeedEntry,
  type PendencySeedLeague,
  type PendencySeedTournament,
  selectFreePendencyEntryProfiles,
} from "../domains/seed/pendency-plan";
import {
  buildTargetLeagueMemberships,
  buildTargetLeagueChallengePlans,
  getNextTargetLeagueRankingPosition,
  shouldSeedScenarioLeagues,
} from "../domains/seed/plan";
import * as leagueTables from "../domains/league/tables";
import {
  ChallengeRuleConfigSchema,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_MODE,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  DEFAULT_LEAGUE_STORAGE,
  LeagueCourtsSchema,
  type ChallengeRuleConfig,
  type LeagueMatchConfig,
} from "../domains/league/contract";
import * as playerTables from "../domains/player/tables";
import { SOURCE_TYPE_LEAGUE_MEMBERSHIP } from "../domains/payment/contract";
import * as paymentTables from "../domains/payment/tables";
import {
  buildCategoryDisplayName,
  entrySlotFields,
} from "../domains/tournament/entry-rules";
import { resolveMatchOccupiedEndMinute } from "../domains/league/challenge-scheduling-rules";
import { findCourtSlotConflict } from "../domains/tournament/scheduling-rules";
import type {
  TournamentGender,
  TournamentModality,
} from "../domains/tournament/contract";
import * as tournamentTables from "../domains/tournament/tables";
import { privateMutation } from "../lib/crpc";

type SeedCtx = MutationCtx;
type LeagueRecord = InferSelectModel<typeof leagueTables.league>;
type LeagueMembershipRecord = InferSelectModel<
  typeof leagueTables.leagueMembership
>;
type TournamentEntryRecord = InferSelectModel<
  typeof tournamentTables.tournamentEntry
>;

/**
 * Aplica defaults de ruleConfig ausentes em documentos legados antes de
 * validar com ChallengeRuleConfigSchema. Campos novos (ex.: scheduleVisibility)
 * e modos de validação ausentes em ligas antigas são preenchidos aqui, evitando
 * ZodError ao ler ruleConfig do banco.
 */
function parseLeagueRuleConfig(raw: unknown): ChallengeRuleConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  const ruleConfig = (source.ruleConfig ?? source) as Record<string, unknown>;
  return ChallengeRuleConfigSchema.parse({
    ...ruleConfig,
    challengeValidationMode:
      (ruleConfig.challengeValidationMode as string) ??
      DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
    resultValidationMode:
      (ruleConfig.resultValidationMode as string) ??
      DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    scheduleVisibility:
      (ruleConfig.scheduleVisibility as string) ??
      DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  });
}
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
  /** Opcional: so o elenco de duplas precisa (o convite e por username). */
  username?: string;
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
  "pending_organizer_result_validation",
  "pending_result_confirmation",
  "pending_result_submission",
] as const);
const TARGET_CHALLENGE_STATUS_CYCLE = [
  "pending_opponent_response",
  "confirmed",
  "pending_result_submission",
  "pending_result_confirmation",
  "pending_organizer_result_validation",
  "pending_organizer_decision",
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
    sets: Array.from({ length: requiredSetWins }, () => {
      const winnerScore = input.matchConfig.gamesPerSet;
      const loserScore = Math.max(0, winnerScore - 2);

      return {
        challengedGames:
          input.winnerSide === "challenged" ? winnerScore : loserScore,
        challengerGames:
          input.winnerSide === "challenger" ? winnerScore : loserScore,
        kind: "set" as const,
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
    case "pending_organizer_result_validation":
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
      status === "pending_organizer_result_validation" ? "manual" : "automatic",
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
    | "leagueChallengeOrganizerAction"
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
      case "leagueChallengeOrganizerAction":
        await ctx.orm
          .delete(leagueTables.leagueChallengeOrganizerAction)
          .where(
            eq(
              leagueTables.leagueChallengeOrganizerAction.id,
              id as Id<"leagueChallengeOrganizerAction">
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
    ctx.orm.query.leagueChallengeOrganizerAction.findMany({
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
    "leagueChallengeOrganizerAction",
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
    throw new Error("Usuário organizador não encontrado.");
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
      username: input.username,
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

/**
 * `ensureMembership` nao regrava linha existente; a posicao do cenario precisa
 * CONVERGIR, senao o plantio antigo continua valendo e o desafio fica com a
 * direcao de ranking invertida.
 */
async function refreshSeedMembershipRankingPosition(
  ctx: SeedCtx,
  input: {
    membership: LeagueMembershipRecord;
    rankingPosition: number | null;
  }
) {
  if (input.membership.rankingPosition === input.rankingPosition) {
    return;
  }

  await ctx.db.patch(input.membership.id as Id<"leagueMembership">, {
    rankingPosition: input.rankingPosition,
    updatedAt: Date.now(),
  });
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

async function requirePrimaryUser(ctx: SeedCtx, email: string) {
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
    input.plan.status === "pending_organizer_decision" ? "manual" : "automatic";
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

  const ruleConfig = parseLeagueRuleConfig(input.league.ruleConfig);
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
  const ruleConfig = parseLeagueRuleConfig(league.ruleConfig);
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
        description: "Liga seedada para testar gestão como organizador.",
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
    const primaryUser = input.primaryUserEmail
      ? await requirePrimaryUser(ctx, input.primaryUserEmail)
      : null;

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
    const currentRuleConfig = parseLeagueRuleConfig(targetLeague.ruleConfig);

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

// Cenario de pendencias na CONTA do usuario: o estado que
// `domains/pendings/registry.ts` le. Tudo idempotente pelo nome/correlationId;
// NUNCA faz reset nem apaga linha.

/** Jogadores ATIVOS por liga do cenario (indices em `seedPlayers`). */
const PENDENCY_LEAGUE_OPPONENT_INDEXES: Record<string, readonly number[]> = {
  "due-soon": [11, 12, 13],
  "payment-due": [0, 1, 2, 3, 4, 5],
  suspended: [14, 15],
};

/** Jogadores com SOLICITACAO PENDENTE por liga. */
const PENDENCY_LEAGUE_REQUEST_INDEXES: Record<string, readonly number[]> = {
  "payment-due": [6, 7, 10],
};

/** Bounds do plantio na organizacao do alvo (mesmo molde dos caps das leituras). */
const PENDENCY_SEED_PRIMARY_CATEGORY_SCAN_LIMIT = 10;
const PENDENCY_SEED_PRIMARY_ENTRY_SCAN_LIMIT = 300;
const PENDENCY_SEED_PRIMARY_JOIN_REQUEST_SCAN_LIMIT = 100;
const PENDENCY_SEED_PRIMARY_TOURNAMENT_SCAN_LIMIT = 50;

/** Desafios com acao DO JOGADOR na liga do "a vencer". */
const PENDENCY_PLAYER_CHALLENGES = [
  {
    challengedIndex: 0,
    dayOffset: -1,
    key: "player-pending-register",
    startMinute: 540,
    status: "pending_result_submission",
  },
  {
    challengedIndex: 1,
    dayOffset: -2,
    key: "player-pending-confirm",
    result: { submittedBy: "challenged", winner: "challenged" },
    startMinute: 660,
    status: "pending_result_confirmation",
  },
  {
    challengedIndex: 2,
    dayOffset: -3,
    key: "player-pending-correction",
    startMinute: 780,
    status: "pending_result_correction",
  },
  {
    challengedIndex: 0,
    dayOffset: -PENDENCY_SEED_LAST_MATCH_DAYS_AGO,
    key: "player-last-match",
    result: {
      confirmedBy: "challenged",
      submittedBy: "challenger",
      winner: "challenger",
    },
    startMinute: 900,
    status: "finished",
  },
] as const;

/** Desafios esperando a validacao DA ORGANIZACAO. */
const PENDENCY_ORGANIZER_CHALLENGES = [
  {
    challengedIndex: 0,
    challengerIndex: 1,
    dayOffset: -3,
    key: "org-result-validation",
    result: {
      confirmedBy: "challenged",
      submittedBy: "challenger",
      winner: "challenger",
    },
    resultValidationMode: "manual",
    startMinute: 480,
    status: "pending_organizer_result_validation",
  },
  {
    challengedIndex: 2,
    challengerIndex: 3,
    dayOffset: -4,
    key: "org-proposal-decision",
    startMinute: 600,
    status: "pending_organizer_decision",
  },
] as const;

/** Slug da organizacao do cenario de pendencias (dono = usuario alvo). */
function buildPendencyOrganizationSlug(userId: Id<"user">) {
  return `seed-pendencies-${String(userId).replaceAll(/[^a-zA-Z0-9]/g, "-")}`;
}

/**
 * Nasce SEM conta de recebimento — e o que faz a liga paga virar pendencia — e
 * com o usuario alvo como owner.
 */
async function ensurePendencyOrganization(ctx: SeedCtx, userId: Id<"user">) {
  const slug = buildPendencyOrganizationSlug(userId);
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

    return { created: false, organization: existingOrganization };
  }

  const now = new Date();
  const [createdOrganization] = await ctx.orm
    .insert(authTables.organization)
    .values({
      createdAt: now,
      metadata: { pendencyScenario: true, seed: true },
      name: PENDENCY_SEED_ORGANIZATION_NAME,
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

  return { created: true, organization: createdOrganization };
}

async function ensurePendencyLeague(
  ctx: SeedCtx,
  input: { organizationId: Id<"organization">; template: PendencySeedLeague }
) {
  const expectedName = buildSeedLeagueName(input.template.name);
  // ruleConfig COMPLETO: a leitura de pendencias valida o json inteiro, entao
  // liga sem os modos de validacao cai fora do risco de inatividade.
  const ruleConfig = {
    ...defaultSeedRuleConfig,
    challengeValidationMode: DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
    hasInactivityPenalty: input.template.hasInactivityPenalty,
    resultValidationMode: DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    ...(input.template.inactivityPenaltyType === null
      ? {}
      : {
          inactivityPenaltyDays: input.template.inactivityPenaltyDays,
          inactivityPenaltyType: input.template.inactivityPenaltyType,
        }),
  };
  const existingLeague = await ctx.orm.query.league.findFirst({
    where: { name: expectedName, organizationId: input.organizationId },
  });

  if (existingLeague) {
    await ctx.db.patch(existingLeague.id as Id<"league">, {
      reminderDaysBefore: input.template.reminderDaysBefore,
      ruleConfig,
      updatedAt: Date.now(),
    });

    return { created: false, league: { ...existingLeague, ruleConfig } };
  }

  const now = new Date();
  const [createdLeague] = await ctx.orm
    .insert(leagueTables.league)
    .values({
      avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
      categories: ["Todas", "A", "B"],
      city: input.template.city,
      coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
      createdAt: now,
      description: "Liga do cenário de pendências do seed.",
      locationNotes: "",
      maxPlayers: null,
      mode: DEFAULT_LEAGUE_MODE,
      monthlyPriceCents: input.template.monthlyPriceCents,
      name: expectedName,
      organizationId: input.organizationId,
      priceBillingInterval: DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
      reminderDaysBefore: input.template.reminderDaysBefore,
      ruleConfig,
      state: input.template.state,
      updatedAt: now,
      visibility: "public",
    })
    .returning();

  return { created: true, league: createdLeague };
}

/**
 * Charge PAGA do ciclo: e o que da vencimento a membership ativa. Re-execucao so
 * REFRESCA as datas — o cenario "a vencer" precisa seguir valido.
 */
async function ensurePendencyPaidCharge(
  ctx: SeedCtx,
  input: {
    daysUntilDue: number;
    key: string;
    league: LeagueRecord;
    membershipId: Id<"leagueMembership">;
    organizationId: Id<"organization">;
    playerProfileId: Id<"playerProfile">;
  }
) {
  const correlationId = buildPendencyChargeCorrelationId({
    key: input.key,
    membershipId: input.membershipId as string,
  });
  const nowMs = Date.now();
  const paidAt = addDays(new Date(nowMs), -28);
  const periodEndAt = addDays(new Date(nowMs), input.daysUntilDue);
  const existingCharge = await ctx.orm.query.paymentCharge.findFirst({
    where: { correlationId },
  });

  if (existingCharge) {
    await ctx.db.patch(existingCharge.id as Id<"paymentCharge">, {
      paidAt: paidAt.getTime(),
      periodEndAt: periodEndAt.getTime(),
      updatedAt: nowMs,
    });

    return { created: false };
  }

  await ctx.orm.insert(paymentTables.paymentCharge).values({
    amountCents: input.league.monthlyPriceCents ?? 0,
    correlationId,
    createdAt: new Date(nowMs),
    organizationId: input.organizationId,
    paidAt,
    periodEndAt,
    playerProfileId: input.playerProfileId,
    sourceId: input.membershipId as string,
    sourceLabel: input.league.name,
    sourceType: SOURCE_TYPE_LEAGUE_MEMBERSHIP,
    status: "PAID",
    updatedAt: new Date(nowMs),
  });

  return { created: true };
}

/** Torneio do cenario: publicado, com inscricoes abertas (a leitura da org le). */
async function ensurePendencyTournament(
  ctx: SeedCtx,
  input: {
    organizationId: Id<"organization">;
    template: PendencySeedTournament;
  }
) {
  const now = new Date();
  const registrationDeadlineAt = addDays(
    now,
    input.template.registrationDeadlineDays
  );
  const startDate = addDays(now, input.template.startDateDays);
  const existingTournament = await ctx.orm.query.tournament.findFirst({
    where: {
      name: input.template.name,
      organizationId: input.organizationId,
    },
  });

  if (existingTournament) {
    await ctx.db.patch(existingTournament.id as Id<"tournament">, {
      registrationDeadlineAt: registrationDeadlineAt.getTime(),
      startDate: startDate.getTime(),
      updatedAt: now.getTime(),
    });

    return { created: false, tournament: existingTournament };
  }

  const [createdTournament] = await ctx.orm
    .insert(tournamentTables.tournament)
    .values({
      city: input.template.city,
      courts: [],
      createdAt: now,
      description: "Torneio do cenário de pendências do seed.",
      locationNotes: "",
      matchConfig: defaultSeedRuleConfig.matchConfig,
      name: input.template.name,
      organizationId: input.organizationId,
      registrationDeadlineAt,
      startDate,
      state: input.template.state,
      status: "published",
      updatedAt: now,
      visibility: "public",
    })
    .returning();

  return { created: true, tournament: createdTournament };
}

/** Categoria da entrada: uma por (modalidade, genero), como o indice unico. */
async function ensurePendencyCategory(
  ctx: SeedCtx,
  input: { entry: PendencySeedEntry; tournamentId: Id<"tournament"> }
) {
  const existingCategory = await ctx.orm.query.tournamentCategory.findFirst({
    where: {
      gender: input.entry.gender,
      modality: input.entry.modality,
      tournamentId: input.tournamentId,
    },
  });

  if (existingCategory) {
    return { category: existingCategory, created: false };
  }

  const now = new Date();
  const [createdCategory] = await ctx.orm
    .insert(tournamentTables.tournamentCategory)
    .values({
      createdAt: now,
      displayName: buildCategoryDisplayName(
        input.entry.modality,
        input.entry.gender
      ),
      entryFeeCents: input.entry.entryFeeCents,
      gender: input.entry.gender,
      modality: input.entry.modality,
      tournamentId: input.tournamentId,
      updatedAt: now,
    })
    .returning();

  return { category: createdCategory, created: true };
}

/** Inscricao viva do plantio: idempotente pelo (categoria, lado A). */
async function ensureSeedEntry(
  ctx: SeedCtx,
  input: {
    categoryId: Id<"tournamentCategory">;
    createdByUserId: Id<"user">;
    partnerUserId: Id<"user"> | null;
    playerAId: Id<"playerProfile">;
    playerBId: Id<"playerProfile"> | null;
    status: string;
  }
) {
  const existingEntry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { activeAId: input.playerAId, categoryId: input.categoryId },
  });

  if (existingEntry) {
    return { created: false };
  }

  const now = new Date();

  await ctx.orm.insert(tournamentTables.tournamentEntry).values({
    categoryId: input.categoryId,
    createdAt: now,
    createdByUserId: input.createdByUserId,
    partnerUserId: input.partnerUserId ?? undefined,
    playerAId: input.playerAId,
    playerBId: input.playerBId ?? undefined,
    status: input.status,
    updatedAt: now,
    ...entrySlotFields({
      playerAId: input.playerAId,
      playerBId: input.playerBId,
      status: input.status,
    }),
  });

  return { created: true };
}

/** Perfil de jogador do seed com o usuario dono (o plantio precisa dos dois). */
type SeedProfileRef = {
  gender: null | string;
  profileId: Id<"playerProfile">;
  userId: Id<"user">;
};

/** Alvo mais recente de uma lista (o desempate por id vive no plano puro). */
function sortByPendencyRecency<T extends { id: string; recencyMs: number }>(
  rows: T[]
) {
  return [...rows].sort((left, right) =>
    comparePendencyTargetRecency({ left, right })
  );
}

/** Organizacoes que o alvo MANDA e que nao sao a do cenario. */
async function listPrimaryManagedOrganizations(
  ctx: SeedCtx,
  input: {
    excludeOrganizationId: Id<"organization"> | null;
    userId: Id<"user">;
  }
) {
  const memberships = await ctx.orm.query.member.findMany({
    limit: 100,
    where: { userId: input.userId },
  });

  return memberships
    .filter((row) => row.role === "owner" || row.role === "admin")
    .map((row) => row.organizationId as string)
    .filter(
      (organizationId) =>
        input.excludeOrganizationId === null ||
        organizationId !== input.excludeOrganizationId
    )
    .sort()
    .slice(0, PENDENCY_SEED_PRIMARY_ORGANIZATION_LIMIT)
    .map((organizationId) => organizationId as Id<"organization">);
}

/**
 * Solicitacoes de entrada pendentes na liga do alvo. So ACRESCENTA: quem ja tem
 * membership na liga nao e tocado e a contagem de pendentes ja existentes conta
 * para o teto, entao repetir a rodada nao acumula.
 */
async function ensurePrimaryJoinRequests(
  ctx: SeedCtx,
  input: {
    leagueId: Id<"league">;
    seedProfiles: readonly SeedProfileRef[];
  }
) {
  const pending = await ctx.orm.query.leagueMembership.findMany({
    limit: PENDENCY_SEED_PRIMARY_JOIN_REQUEST_SCAN_LIMIT,
    where: { leagueId: input.leagueId, status: "pending" },
  });
  let planted = 0;

  for (const seedProfile of input.seedProfiles) {
    if (pending.length + planted >= PENDENCY_SEED_PRIMARY_JOIN_REQUEST_LIMIT) {
      break;
    }

    const result = await ensureMembership(ctx, {
      leagueId: input.leagueId,
      status: "pending",
      userId: seedProfile.userId,
    });

    if (result.created) {
      planted += 1;
    }
  }

  return planted;
}

/**
 * Inscricoes pendentes no torneio do alvo. O alvo e o TOTAL por status no
 * torneio: alcancado, a rodada seguinte nao planta nada.
 */
async function ensurePrimaryEntryPendencies(
  ctx: SeedCtx,
  input: {
    organizationId: Id<"organization">;
    seedProfiles: readonly SeedProfileRef[];
  }
) {
  const tournaments = await ctx.orm.query.tournament.findMany({
    limit: PENDENCY_SEED_PRIMARY_TOURNAMENT_SCAN_LIMIT,
    orderBy: { updatedAt: "desc" },
    where: { organizationId: input.organizationId },
  });
  const tournament = sortByPendencyRecency(
    tournaments
      .filter((row) =>
        (
          PENDENCY_SEED_PRIMARY_TOURNAMENT_STATUSES as readonly string[]
        ).includes(row.status)
      )
      .map((row) => ({
        id: row.id as string,
        recencyMs: row.updatedAt.getTime(),
        row,
      }))
  )[0];

  if (!tournament) {
    return 0;
  }

  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: PENDENCY_SEED_PRIMARY_CATEGORY_SCAN_LIMIT,
    orderBy: { createdAt: "desc" },
    where: { tournamentId: tournament.row.id as Id<"tournament"> },
  });
  const orderedCategories = sortByPendencyRecency(
    categories.map((row) => ({
      id: row.id as string,
      recencyMs: row.createdAt.getTime(),
      row,
    }))
  );

  if (orderedCategories.length === 0) {
    return 0;
  }

  const entries = await ctx.orm.query.tournamentEntry.findMany({
    limit: PENDENCY_SEED_PRIMARY_ENTRY_SCAN_LIMIT,
    where: {
      categoryId: {
        in: orderedCategories.map(
          (category) => category.row.id as Id<"tournamentCategory">
        ),
      },
    },
  });
  // Coluna de ocupacao viva (terminal limpa): e a chave do indice unico.
  const occupied = entries
    .flatMap((entry) => [entry.activeAId, entry.activeBId])
    .filter(
      (profileId): profileId is Id<"playerProfile"> =>
        typeof profileId === "string"
    )
    .map((profileId) => profileId as string);
  let planted = 0;

  for (const plan of PENDENCY_SEED_PRIMARY_ENTRY_TARGETS) {
    if (
      entries.filter((entry) => entry.status === plan.status).length >=
      plan.target
    ) {
      continue;
    }

    for (const category of orderedCategories) {
      // A contagem do item e por torneio: se a categoria ja tem o status, a
      // inscricao plantada vai para a proxima (nunca duplica o mesmo caso).
      if (
        entries.some(
          (entry) =>
            entry.categoryId === category.row.id && entry.status === plan.status
        )
      ) {
        continue;
      }

      const freeSlots = category.row.modality === "doubles" ? 2 : 1;
      const free = selectFreePendencyEntryProfiles({
        candidates: input.seedProfiles.map((seedProfile) => ({
          gender: seedProfile.gender,
          profileId: seedProfile.profileId,
        })),
        gender: category.row.gender as TournamentGender,
        modality: category.row.modality as TournamentModality,
        occupied,
      });

      if (free.length < freeSlots) {
        continue;
      }

      const [playerA, playerB] = free;
      const seedProfileA = input.seedProfiles.find(
        (seedProfile) => seedProfile.profileId === playerA
      )!;
      const seedProfileB = input.seedProfiles.find(
        (seedProfile) => seedProfile.profileId === playerB
      );
      const result = await ensureSeedEntry(ctx, {
        categoryId: category.row.id as Id<"tournamentCategory">,
        createdByUserId: seedProfileA.userId,
        partnerUserId: seedProfileB?.userId ?? null,
        playerAId: seedProfileA.profileId,
        playerBId: seedProfileB?.profileId ?? null,
        status: plan.status,
      });

      if (!result.created) {
        continue;
      }

      planted += 1;
      occupied.push(...free);
      break;
    }
  }

  return planted;
}

/**
 * Cobertura da organizacao que o alvo JA usa: nunca altera dado existente nem a
 * conta de recebimento dele.
 */
async function ensurePrimaryOrganizationPendencies(
  ctx: SeedCtx,
  input: {
    excludeOrganizationId: Id<"organization">;
    seedProfiles: readonly SeedProfileRef[];
    userId: Id<"user">;
  }
) {
  const organizations = await listPrimaryManagedOrganizations(ctx, input);
  let entriesCreated = 0;
  let joinRequestsCreated = 0;

  for (const organizationId of organizations) {
    const leagues = await ctx.orm.query.league.findMany({
      limit: 50,
      orderBy: { createdAt: "desc" },
      where: { organizationId },
    });
    const league = sortByPendencyRecency(
      leagues.map((row) => ({
        id: row.id as string,
        recencyMs: row.createdAt.getTime(),
        row,
      }))
    )[0];

    if (league) {
      joinRequestsCreated += await ensurePrimaryJoinRequests(ctx, {
        leagueId: league.row.id as Id<"league">,
        seedProfiles: input.seedProfiles,
      });
    }

    entriesCreated += await ensurePrimaryEntryPendencies(ctx, {
      organizationId,
      seedProfiles: input.seedProfiles,
    });
  }

  return {
    entriesCreated,
    joinRequestsCreated,
    organizationsTouched: organizations.length,
  };
}

/**
 * `seed:pendencyScenario` — estado de pendencias na CONTA do email informado:
 * nenhum usuario novo entra no lugar dele e o cenario nao faz reset. Os kinds da
 * ORGANIZACAO pedem um organizador SEM conta de recebimento — dai a organizacao
 * propria.
 */
export const pendencyScenario = privateMutation
  .input(PendencyScenarioSchema)
  .output(pendencyScenarioResultSchema)
  .mutation(async ({ ctx, input }) => {
    const primaryUser = await requirePrimaryUser(ctx, input.primaryUserEmail);

    const userId = primaryUser.id as Id<"user">;
    const seedCoreResult = await seedCoreUsers(ctx);
    const { userIds } = seedCoreResult;
    const profileResult = await ensureSeedPlayerProfile(ctx, userId, {
      emailLocalPart: "primary",
      fullName: primaryUser.name || "Bruno Willian Garcia",
      gender: PENDENCY_SEED_VIEWER_GENDER,
      image: seedPlayers[0]!.image,
      nickname: "Bruno",
    });
    const playerProfileId = profileResult.profile.id as Id<"playerProfile">;
    const organizationResult = await ensurePendencyOrganization(ctx, userId);
    const organizationId = organizationResult.organization
      .id as Id<"organization">;

    const seedProfiles = await ctx.orm.query.playerProfile.findMany({
      limit: userIds.length,
      where: { userId: { in: userIds } },
    });
    const profileIdByUserId = new Map(
      seedProfiles.map((profile) => [
        profile.userId as string,
        profile.id as Id<"playerProfile">,
      ])
    );

    let chargesCreated = 0;
    let chargesRefreshed = 0;
    let challengesCreated = 0;
    let leaguesCreated = 0;
    let membershipsCreated = 0;

    const leagueByKey = new Map<string, LeagueRecord>();
    const viewerMembershipByKey = new Map<string, LeagueMembershipRecord>();
    const opponentsByKey = new Map<string, LeagueMembershipRecord[]>();

    for (const template of PENDENCY_SEED_LEAGUES) {
      const leagueResult = await ensurePendencyLeague(ctx, {
        organizationId,
        template,
      });

      if (leagueResult.created) {
        leaguesCreated += 1;
      }

      const league = leagueResult.league;
      const leagueId = league.id as Id<"league">;
      const viewerIsActive = template.viewerMembershipStatus === "active";
      const opponentIndexes =
        PENDENCY_LEAGUE_OPPONENT_INDEXES[template.key] ?? [];
      // challenge-rules: o challenger precisa estar ABAIXO do challenged, entao
      // o alvo fica na PIOR posicao do grupo e os adversarios ACIMA dele (mesma
      // convencao de `domains/seed/plan.ts`).
      const viewerRankingPosition = viewerIsActive
        ? opponentIndexes.length + 1
        : null;
      leagueByKey.set(template.key, league);

      const viewerMembership = await ensureMembership(ctx, {
        leagueId,
        rankingPosition: viewerRankingPosition,
        status: template.viewerMembershipStatus,
        userId,
      });
      if (viewerMembership.created) {
        membershipsCreated += 1;
      }
      await refreshSeedMembershipRankingPosition(ctx, {
        membership: viewerMembership.membership,
        rankingPosition: viewerRankingPosition,
      });
      // Posicao EFETIVA (a membership existente acabou de ser regravada).
      viewerMembershipByKey.set(template.key, {
        ...viewerMembership.membership,
        rankingPosition: viewerRankingPosition,
      });

      const opponents: LeagueMembershipRecord[] = [];

      for (const [position, opponentIndex] of opponentIndexes.entries()) {
        const opponentMembership = await ensureMembership(ctx, {
          leagueId,
          rankingPosition: position + 1,
          status: "active",
          userId: userIds[opponentIndex]!,
        });
        if (opponentMembership.created) {
          membershipsCreated += 1;
        }
        await refreshSeedMembershipRankingPosition(ctx, {
          membership: opponentMembership.membership,
          rankingPosition: position + 1,
        });
        opponents.push({
          ...opponentMembership.membership,
          rankingPosition: position + 1,
        });
      }
      opponentsByKey.set(template.key, opponents);

      for (const requestIndex of PENDENCY_LEAGUE_REQUEST_INDEXES[
        template.key
      ] ?? []) {
        const requestMembership = await ensureMembership(ctx, {
          leagueId,
          rankingPosition: null,
          status: "pending",
          userId: userIds[requestIndex]!,
        });
        if (requestMembership.created) {
          membershipsCreated += 1;
        }
      }

      if (template.paidDaysUntilDue !== null) {
        const chargeResult = await ensurePendencyPaidCharge(ctx, {
          daysUntilDue: template.paidDaysUntilDue,
          key: template.key,
          league,
          membershipId: viewerMembership.membership
            .id as Id<"leagueMembership">,
          organizationId,
          playerProfileId,
        });

        if (chargeResult.created) {
          chargesCreated += 1;
        } else {
          chargesRefreshed += 1;
        }
      }
    }

    const ruleConfigByKey = new Map(
      [...leagueByKey].map(([key, league]) => [
        key,
        parseLeagueRuleConfig(league.ruleConfig),
      ])
    );

    for (const [key, league] of leagueByKey) {
      const viewerMembership = viewerMembershipByKey.get(key);
      const opponents = opponentsByKey.get(key) ?? [];
      const ruleConfig = ruleConfigByKey.get(key);

      if (!(viewerMembership && opponents.length > 0 && ruleConfig)) {
        continue;
      }

      const courtId = await ensureSeedCourtForLeague(ctx, league);
      const challengePlans: SeedChallengePlan[] = [];

      if (key === "due-soon") {
        for (const scenario of PENDENCY_PLAYER_CHALLENGES) {
          challengePlans.push({
            challenged: {
              id: opponents[scenario.challengedIndex]!
                .id as Id<"leagueMembership">,
              rankingPosition: opponents[scenario.challengedIndex]!
                .rankingPosition as number,
            },
            challenger: {
              id: viewerMembership.id as Id<"leagueMembership">,
              rankingPosition: viewerMembership.rankingPosition as number,
            },
            dayOffset: scenario.dayOffset,
            endMinute: scenario.startMinute + 90,
            key: scenario.key,
            result: "result" in scenario ? scenario.result : undefined,
            startMinute: scenario.startMinute,
            status: scenario.status,
          });
        }
      }

      if (key === "payment-due") {
        for (const scenario of PENDENCY_ORGANIZER_CHALLENGES) {
          challengePlans.push({
            challenged: {
              id: opponents[scenario.challengedIndex]!
                .id as Id<"leagueMembership">,
              rankingPosition: opponents[scenario.challengedIndex]!
                .rankingPosition as number,
            },
            challenger: {
              id: opponents[scenario.challengerIndex]!
                .id as Id<"leagueMembership">,
              rankingPosition: opponents[scenario.challengerIndex]!
                .rankingPosition as number,
            },
            dayOffset: scenario.dayOffset,
            endMinute: scenario.startMinute + 90,
            key: scenario.key,
            result: "result" in scenario ? scenario.result : undefined,
            resultValidationMode:
              "resultValidationMode" in scenario
                ? scenario.resultValidationMode
                : undefined,
            startMinute: scenario.startMinute,
            status: scenario.status,
          });
        }
      }

      for (const plan of challengePlans) {
        const challengeResult = await ensureSeedChallenge({
          courtId,
          ctx,
          league,
          matchConfig: ruleConfig.matchConfig,
          plan,
          responseDeadlineHours: ruleConfig.responseDeadlineHours.value,
        });

        if (challengeResult.created) {
          challengesCreated += 1;
        }
      }

      // `ensureSeedChallenge` grava finishedAt fixo em 6 dias; a ultima partida
      // da liga com penalidade precisa dos dias do plano.
      if (ruleConfig.hasInactivityPenalty) {
        const lastMatch = await ctx.orm.query.leagueChallenge.findFirst({
          where: {
            challengedMembershipId: opponents[0]!.id as Id<"leagueMembership">,
            challengerMembershipId:
              viewerMembership.id as Id<"leagueMembership">,
            leagueId: league.id as Id<"league">,
            status: "finished",
          },
        });

        if (lastMatch) {
          await ctx.db.patch(lastMatch.id as Id<"leagueChallenge">, {
            finishedAt: addDays(
              new Date(),
              -PENDENCY_SEED_LAST_MATCH_DAYS_AGO
            ).getTime(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    let categoriesCreated = 0;
    let entriesCreated = 0;
    let tournamentsCreated = 0;

    for (const template of PENDENCY_SEED_TOURNAMENTS) {
      const tournamentResult = await ensurePendencyTournament(ctx, {
        organizationId,
        template,
      });

      if (tournamentResult.created) {
        tournamentsCreated += 1;
      }

      const tournamentId = tournamentResult.tournament.id as Id<"tournament">;

      for (const entry of template.entries) {
        const categoryResult = await ensurePendencyCategory(ctx, {
          entry,
          tournamentId,
        });

        if (categoryResult.created) {
          categoriesCreated += 1;
        }

        const counterpartUserId =
          entry.counterpartIndex === null
            ? null
            : userIds[entry.counterpartIndex]!;
        const counterpartProfileId = counterpartUserId
          ? (profileIdByUserId.get(counterpartUserId as string) ?? null)
          : null;
        const isViewerEntry = entry.viewerSide !== null;

        if (
          isViewerEntry &&
          !counterpartProfileId &&
          entry.modality === "doubles"
        ) {
          continue;
        }

        const playerAId =
          entry.viewerSide === "B"
            ? (counterpartProfileId as Id<"playerProfile">)
            : isViewerEntry
              ? playerProfileId
              : (counterpartProfileId as Id<"playerProfile">);
        const playerBId =
          entry.viewerSide === "A"
            ? counterpartProfileId
            : entry.viewerSide === "B"
              ? playerProfileId
              : null;
        const createdByUserId =
          entry.viewerSide === "B"
            ? (counterpartUserId as Id<"user">)
            : isViewerEntry
              ? userId
              : (counterpartUserId as Id<"user">);

        const entryResult = await ensureSeedEntry(ctx, {
          categoryId: categoryResult.category.id as Id<"tournamentCategory">,
          createdByUserId,
          partnerUserId:
            entry.modality === "doubles" && playerBId
              ? ((entry.viewerSide === "A"
                  ? counterpartUserId
                  : userId) as Id<"user">)
              : null,
          playerAId,
          playerBId,
          status: entry.status,
        });

        if (entryResult.created) {
          entriesCreated += 1;
        }
      }
    }

    const primaryPendencies = await ensurePrimaryOrganizationPendencies(ctx, {
      excludeOrganizationId: organizationId,
      // O player-01 carrega o MESMO nome do dono da conta: plantar esse perfil na
      // organizacao dele pareceria o proprio usuario pedindo entrada.
      seedProfiles: seedProfiles
        .filter((profile) => profile.userId !== userIds[0])
        .map((profile) => ({
          gender: profile.gender,
          profileId: profile.id as Id<"playerProfile">,
          userId: profile.userId as Id<"user">,
        }))
        .sort((left, right) => (left.profileId < right.profileId ? -1 : 1)),
      userId,
    });

    return {
      categoriesCreated,
      challengesCreated,
      chargesCreated,
      chargesRefreshed,
      entriesCreated,
      leaguesCreated,
      membershipsCreated,
      organizationId: organizationId as string,
      playerProfileId: playerProfileId as string,
      playerProfilesCreated:
        seedCoreResult.playerProfilesCreated + (profileResult.created ? 1 : 0),
      primaryEntriesCreated: primaryPendencies.entriesCreated,
      primaryJoinRequestsCreated: primaryPendencies.joinRequestsCreated,
      primaryOrganizationsTouched: primaryPendencies.organizationsTouched,
      tournamentsCreated,
      userId: userId as string,
      usersCreated: seedCoreResult.usersCreated,
    };
  });

/** Inscricoes lidas por categoria ao conferir o alvo do plantio de duplas. */
const DOUBLES_SEED_ENTRY_SCAN_LIMIT = 100;

/** Organizacao do cenario de pendencias do alvo, quando ele ja rodou. */
async function findPendencyOrganizationId(ctx: SeedCtx, userId: Id<"user">) {
  const organization = await ctx.orm.query.organization.findFirst({
    where: { slug: buildPendencyOrganizationSlug(userId) },
  });

  return (organization?.id ?? null) as Id<"organization"> | null;
}

/** O torneio do plantio de duplas, quando ele ja existe na organizacao. */
async function findDoublesSeedTournament(
  ctx: SeedCtx,
  organizationId: Id<"organization">
) {
  const tournament = await ctx.orm.query.tournament.findFirst({
    where: {
      name: DOUBLES_SEED_TOURNAMENT.name,
      organizationId,
    },
  });

  return tournament;
}

/**
 * Organizacao-alvo do plantio: onde o torneio de duplas JA existe (ancora de
 * idempotencia) ou, na primeira execucao, a primeira que o alvo gerencia.
 */
async function resolveDoublesTargetOrganization(
  ctx: SeedCtx,
  input: {
    excludeOrganizationId: Id<"organization"> | null;
    userId: Id<"user">;
  }
) {
  const organizations = await listPrimaryManagedOrganizations(ctx, input);

  for (const organizationId of organizations) {
    const existing = await findDoublesSeedTournament(ctx, organizationId);

    if (existing) {
      return organizationId;
    }
  }

  return organizations[0] ?? null;
}

/**
 * Elenco PROPRIO do plantio. O username e o que faz o convite de dupla existir
 * de verdade: sem ele o perfil nem aparece na busca do parceiro.
 */
async function ensureDoublesSeedPlayers(ctx: SeedCtx) {
  const profiles: SeedProfileRef[] = [];
  let playerProfilesCreated = 0;
  let usersCreated = 0;

  for (const seedProfile of DOUBLES_SEED_PROFILES) {
    const userResult = await ensureSeedUser(ctx, seedProfile);

    if (userResult.created) {
      usersCreated += 1;
    }

    const profileResult = await ensureSeedPlayerProfile(
      ctx,
      userResult.user.id as Id<"user">,
      seedProfile
    );

    if (profileResult.created) {
      playerProfilesCreated += 1;
    }

    profiles.push({
      gender: profileResult.profile.gender,
      profileId: profileResult.profile.id as Id<"playerProfile">,
      userId: userResult.user.id as Id<"user">,
    });
  }

  return { playerProfilesCreated, profiles, usersCreated };
}

/**
 * Torneio do plantio: PUBLICADO e com inscricao aberta. O prazo e o inicio sao
 * recalculados a cada execucao (a conferencia seguinte segue valendo), mas o
 * status so sai de `draft`: depois do sorteio a rodada nao desfaz a chave.
 */
async function ensureDoublesSeedTournament(
  ctx: SeedCtx,
  input: { organizationId: Id<"organization"> }
) {
  const now = new Date();
  const registrationDeadlineAt = addDays(
    now,
    DOUBLES_SEED_TOURNAMENT.registrationDeadlineDays
  );
  const startDate = addDays(now, DOUBLES_SEED_TOURNAMENT.startDateDays);
  const existing = await ctx.orm.query.tournament.findFirst({
    where: {
      name: DOUBLES_SEED_TOURNAMENT.name,
      organizationId: input.organizationId,
    },
  });

  if (existing) {
    await ctx.db.patch(existing.id as Id<"tournament">, {
      registrationDeadlineAt: registrationDeadlineAt.getTime(),
      startDate: startDate.getTime(),
      ...(existing.status === "draft" ? { status: "published" } : {}),
      updatedAt: now.getTime(),
    });

    return { created: false, tournament: existing };
  }

  const [createdTournament] = await ctx.orm
    .insert(tournamentTables.tournament)
    .values({
      approvalMode: "auto",
      city: DOUBLES_SEED_TOURNAMENT.city,
      courts: [],
      createdAt: now,
      description: "Torneio de duplas do plantio de conferencia (seed).",
      locationNotes: "",
      matchConfig: defaultSeedRuleConfig.matchConfig,
      name: DOUBLES_SEED_TOURNAMENT.name,
      organizationId: input.organizationId,
      registrationDeadlineAt,
      startDate,
      state: DOUBLES_SEED_TOURNAMENT.state,
      status: "published",
      updatedAt: now,
      visibility: "public",
    })
    .returning();

  return { created: true, tournament: createdTournament };
}

/** Categoria por (modalidade, genero) — a chave do indice unico do schema. */
async function ensureDoublesSeedCategory(
  ctx: SeedCtx,
  input: { gender: TournamentGender; tournamentId: Id<"tournament"> }
) {
  const existing = await ctx.orm.query.tournamentCategory.findFirst({
    where: {
      gender: input.gender,
      modality: "doubles",
      tournamentId: input.tournamentId,
    },
  });

  if (existing) {
    return { category: existing, created: false };
  }

  const now = new Date();
  const [createdCategory] = await ctx.orm
    .insert(tournamentTables.tournamentCategory)
    .values({
      createdAt: now,
      displayName: buildCategoryDisplayName("doubles", input.gender),
      entryFeeCents: DOUBLES_SEED_ENTRY_FEE_CENTS,
      gender: input.gender,
      maxEntries: DOUBLES_SEED_MAX_ENTRIES,
      modality: "doubles",
      tournamentId: input.tournamentId,
      updatedAt: now,
    })
    .returning();

  return { category: createdCategory, created: true };
}

/**
 * `seed:doublesScenario` — torneio de DUPLAS na organizacao que o email informado
 * ja gerencia: publicado, gratuito e com duplas masculinas e femininas
 * inscritas. O alvo e o TOTAL por categoria e status: repetir a execucao nao
 * acumula dupla nem mexe em dado que ja existia na organizacao.
 */
export const doublesScenario = privateMutation
  .input(DoublesScenarioSchema)
  .output(doublesScenarioResultSchema)
  .mutation(async ({ ctx, input }) => {
    const primaryUser = await requirePrimaryUser(ctx, input.primaryUserEmail);
    const userId = primaryUser.id as Id<"user">;
    const targetOrganizationId = await resolveDoublesTargetOrganization(ctx, {
      excludeOrganizationId: await findPendencyOrganizationId(ctx, userId),
      userId,
    });

    if (!targetOrganizationId) {
      throw new Error(
        `A conta ${input.primaryUserEmail} não gerencia nenhuma organização.`
      );
    }

    const organization = await ctx.orm.query.organization.findFirst({
      where: { id: targetOrganizationId },
    });
    const playerResult = await ensureDoublesSeedPlayers(ctx);
    const tournamentResult = await ensureDoublesSeedTournament(ctx, {
      organizationId: targetOrganizationId,
    });
    const tournamentId = tournamentResult.tournament.id as Id<"tournament">;
    // Vagas ocupadas no torneio inteiro: a inscricao viva reserva o perfil pela
    // coluna espelhada, e o indice unico e por (categoria, lado).
    const occupied: string[] = [];
    const categories: DoublesScenarioResult["categories"] = [];
    let activePairsCreated = 0;
    let categoriesCreated = 0;
    let invitePairsCreated = 0;

    for (const template of DOUBLES_SEED_CATEGORIES) {
      const categoryResult = await ensureDoublesSeedCategory(ctx, {
        gender: template.gender,
        tournamentId,
      });
      const categoryId = categoryResult.category.id as Id<"tournamentCategory">;

      if (categoryResult.created) {
        categoriesCreated += 1;
      }

      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: DOUBLES_SEED_ENTRY_SCAN_LIMIT,
        where: { categoryId },
      });

      for (const entry of entries) {
        for (const profileId of [entry.activeAId, entry.activeBId]) {
          if (typeof profileId === "string") {
            occupied.push(profileId);
          }
        }
      }

      const missingActive = Math.max(
        0,
        DOUBLES_SEED_ACTIVE_PAIRS -
          entries.filter((entry) => entry.status === "active").length
      );
      const missingInvite = Math.max(
        0,
        DOUBLES_SEED_INVITE_PAIRS -
          entries.filter((entry) => entry.status === "pending_partner").length
      );
      const pairs = selectDoublesSeedPairs({
        candidates: playerResult.profiles.map((profile) => ({
          gender: profile.gender,
          profileId: profile.profileId,
        })),
        gender: template.gender,
        occupied,
        pairCount: missingActive + missingInvite,
      });

      for (const [index, pair] of pairs.entries()) {
        const [playerAId, playerBId] = pair;
        const profileA = playerResult.profiles.find(
          (profile) => profile.profileId === playerAId
        );
        const profileB = playerResult.profiles.find(
          (profile) => profile.profileId === playerBId
        );

        if (!(playerAId && playerBId && profileA && profileB)) {
          continue;
        }

        const status = index < missingActive ? "active" : "pending_partner";
        const entryResult = await ensureSeedEntry(ctx, {
          categoryId,
          createdByUserId: profileA.userId,
          partnerUserId: profileB.userId,
          playerAId,
          playerBId,
          status,
        });

        if (entryResult.created) {
          if (status === "active") {
            activePairsCreated += 1;
          } else {
            invitePairsCreated += 1;
          }
        }
      }

      // Totais LIDOS depois do plantio: e o que a segunda execucao tem de manter.
      const plantedEntries = await ctx.orm.query.tournamentEntry.findMany({
        limit: DOUBLES_SEED_ENTRY_SCAN_LIMIT,
        where: { categoryId },
      });

      categories.push({
        activePairs: plantedEntries.filter((entry) => entry.status === "active")
          .length,
        displayName: categoryResult.category.displayName,
        gender: template.gender,
        invitePairs: plantedEntries.filter(
          (entry) => entry.status === "pending_partner"
        ).length,
      });
    }

    return {
      activePairsCreated,
      categories,
      categoriesCreated,
      invitePairsCreated,
      organizationId: targetOrganizationId as string,
      organizationName: organization?.name ?? "",
      organizationsTouched: 1,
      playerProfilesCreated: playerResult.playerProfilesCreated,
      tournamentId: tournamentId as string,
      tournamentName: DOUBLES_SEED_TOURNAMENT.name,
      tournamentsCreated: tournamentResult.created ? 1 : 0,
      usersCreated: playerResult.usersCreated,
    };
  });

/** Bounds do plantio de agenda (mesmo molde dos caps das leituras). */
const DOUBLES_SEED_CATEGORY_SCAN_LIMIT = 10;
const DOUBLES_SEED_MATCH_SCAN_LIMIT = 200;
const DOUBLES_SEED_SIDE_PROFILE_LIMIT = 60;

/** Quadras minimas da agenda: sem quadra o card sai sem o local do jogo. */
function buildDoublesSeedCourts() {
  return DOUBLES_SEED_COURTS.map((court) => ({
    availability: buildSeedCourtAvailability(),
    id: court.id,
    name: court.name,
  }));
}

/**
 * Confirma os convites pendentes da categoria. O convite JA reserva as duas
 * vagas, entao aceitar e so virar o status — o mesmo efeito do
 * `respondPartnerInvite` em torneio gratuito com aprovacao automatica.
 */
async function acceptDoublesSeedInvites(
  ctx: SeedCtx,
  categoryId: Id<"tournamentCategory">
) {
  const pending = await ctx.orm.query.tournamentEntry.findMany({
    limit: DOUBLES_SEED_ENTRY_SCAN_LIMIT,
    where: { categoryId, status: "pending_partner" },
  });

  if (pending.length === 0) {
    return 0;
  }

  const now = Date.now();

  for (const entry of pending) {
    await ctx.db.patch(entry.id as Id<"tournamentEntry">, {
      status: "active",
      updatedAt: now,
    });
  }

  return pending.length;
}

/**
 * Duplas que faltam para o alvo de ativas da categoria: a chave de 4 slots
 * precisa de 4 duplas por categoria.
 */
async function plantDoublesSeedPairsUpToTarget(
  ctx: SeedCtx,
  input: {
    categoryId: Id<"tournamentCategory">;
    gender: TournamentGender;
    profiles: readonly SeedProfileRef[];
    target: number;
  }
) {
  const entries = await ctx.orm.query.tournamentEntry.findMany({
    limit: DOUBLES_SEED_ENTRY_SCAN_LIMIT,
    where: { categoryId: input.categoryId, status: "active" },
  });
  const missing = input.target - entries.length;

  if (missing < 1) {
    return 0;
  }

  const occupied = entries
    .flatMap((entry) => [entry.activeAId, entry.activeBId])
    .filter(
      (profileId): profileId is Id<"playerProfile"> =>
        typeof profileId === "string"
    );
  const pairs = selectDoublesSeedPairs({
    candidates: input.profiles.map((profile) => ({
      gender: profile.gender,
      profileId: profile.profileId,
    })),
    gender: input.gender,
    occupied,
    pairCount: missing,
  });
  let planted = 0;

  for (const pair of pairs) {
    const [playerAId, playerBId] = pair;
    const profileA = input.profiles.find(
      (profile) => profile.profileId === playerAId
    );
    const profileB = input.profiles.find(
      (profile) => profile.profileId === playerBId
    );

    if (!(playerAId && playerBId && profileA && profileB)) {
      continue;
    }

    const entryResult = await ensureSeedEntry(ctx, {
      categoryId: input.categoryId,
      createdByUserId: profileA.userId,
      partnerUserId: profileB.userId,
      playerAId,
      playerBId,
      status: "active",
    });

    if (entryResult.created) {
      planted += 1;
    }
  }

  return planted;
}

/**
 * `seed:doublesAgendaScenario` — fecha as duplas e cadastra as quadras do torneio
 * do cenario de duplas e, quando a chave ja existe, agenda a PRIMEIRA rodada da
 * chave nos dias de hoje e amanhã. O sorteio (`tournament/bracket:performDraw`) e
 * o inicio (`performStart`) sao os cores do produto e rodam como comando proprio:
 * de dentro daqui a paginacao deles colide com a das leituras desta mutation. A
 * agenda e escrita por estado desejado: repetir no mesmo dia nao escreve nada.
 */
export const doublesAgendaScenario = privateMutation
  .input(DoublesAgendaScenarioSchema)
  .output(doublesAgendaScenarioResultSchema)
  .mutation(async ({ ctx, input }) => {
    const primaryUser = await requirePrimaryUser(ctx, input.primaryUserEmail);
    const userId = primaryUser.id as Id<"user">;
    const targetOrganizationId = await resolveDoublesTargetOrganization(ctx, {
      excludeOrganizationId: await findPendencyOrganizationId(ctx, userId),
      userId,
    });

    if (!targetOrganizationId) {
      throw new Error(
        `A conta ${input.primaryUserEmail} não gerencia nenhuma organização.`
      );
    }

    const currentTournament = await findDoublesSeedTournament(
      ctx,
      targetOrganizationId
    );

    if (!currentTournament) {
      throw new Error(
        `Rode o cenário de duplas antes: o torneio "${DOUBLES_SEED_TOURNAMENT.name}" não existe nessa organização.`
      );
    }

    const tournamentId = currentTournament.id as Id<"tournament">;
    // Entrada so se mexe ANTES do sorteio: depois da chave montada, dupla nova
    // deixaria o torneio com uma inscricao fora da chave.
    const beforeDraw = currentTournament.status === "published";
    let acceptedInvites = 0;
    let pairsPlanted = 0;

    if (beforeDraw) {
      const playerResult = await ensureDoublesSeedPlayers(ctx);

      for (const template of DOUBLES_SEED_CATEGORIES) {
        const categoryResult = await ensureDoublesSeedCategory(ctx, {
          gender: template.gender,
          tournamentId,
        });
        const categoryId = categoryResult.category
          .id as Id<"tournamentCategory">;

        acceptedInvites += await acceptDoublesSeedInvites(ctx, categoryId);
        pairsPlanted += await plantDoublesSeedPairsUpToTarget(ctx, {
          categoryId,
          gender: template.gender,
          profiles: playerResult.profiles,
          target: DOUBLES_SEED_AGENDA_ACTIVE_TARGET,
        });
      }
    }

    // Quadra cadastrada pelo organizador nunca e sobrescrita.
    const currentCourts = currentTournament.courts ?? [];
    let courtsAdded = 0;

    if (currentCourts.length === 0) {
      const courts = buildDoublesSeedCourts();
      await ctx.db.patch(tournamentId, {
        courts,
        updatedAt: Date.now(),
      });
      courtsAdded = courts.length;
    }

    // Sorteio e inicio ficam FORA daqui: `performDraw`/`performStart` sao os
    // cores do produto e rodam como comando proprio. Chamados de dentro desta
    // mutation, o delete/update paginado deles colide com a paginacao das
    // leituras ja feitas aqui (Convex so aceita uma por transacao).

    const now = new Date();
    const nowMs = now.getTime();
    const matchConfig = currentTournament.matchConfig as LeagueMatchConfig;
    const categories = await ctx.orm.query.tournamentCategory.findMany({
      limit: DOUBLES_SEED_CATEGORY_SCAN_LIMIT,
      where: { tournamentId },
    });
    const matches = await ctx.orm.query.tournamentMatch.findMany({
      limit: DOUBLES_SEED_MATCH_SCAN_LIMIT,
      where: {
        categoryId: {
          in: categories.map(
            (category) => category.id as Id<"tournamentCategory">
          ),
        },
      },
    });

    // Chave ja montada (ela nasce pelo core de colocacao do produto): o status
    // vira o que o sorteio deixaria (`drawn`), unico estado de onde o produto
    // aceita iniciar o torneio. Sem chave, nada muda.
    if (matches.length > 0 && currentTournament.status === "published") {
      await ctx.db.patch(tournamentId, { status: "drawn", updatedAt: nowMs });
    }

    const categoryResults: DoublesAgendaScenarioResult["categories"] = [];
    const allEntries: TournamentEntryRecord[] = [];
    const scheduled: Array<{
      category: string;
      courtName: string;
      entryAId: null | string;
      entryBId: null | string;
      matchDate: string;
      round: number;
      startMinute: number;
    }> = [];
    let matchesRescheduled = 0;
    let matchesScheduled = 0;

    for (const [categoryIndex, template] of DOUBLES_SEED_CATEGORIES.entries()) {
      const category = categories.find((row) => row.gender === template.gender);

      if (!category) {
        continue;
      }

      const categoryId = category.id as Id<"tournamentCategory">;
      const entries = await ctx.orm.query.tournamentEntry.findMany({
        limit: DOUBLES_SEED_ENTRY_SCAN_LIMIT,
        where: { categoryId },
      });
      allEntries.push(...entries);
      const round1 = matches
        .filter(
          (match) =>
            match.categoryId === categoryId &&
            match.round === 1 &&
            match.status !== "vacant" &&
            !match.walkover
        )
        .sort((left, right) => left.slotInRound - right.slotInRound);
      let scheduledInCategory = 0;

      for (const [matchIndex, match] of round1.entries()) {
        const slot = resolveDoublesSeedAgendaSlot({
          categoryIndex,
          matchIndex,
          nowMs,
        });

        if (!slot) {
          continue;
        }

        scheduledInCategory += 1;

        const endMinute = resolveMatchOccupiedEndMinute({
          matchConfig,
          startMinute: slot.startMinute,
        });
        const alreadyAsPlanned =
          match.courtId === slot.courtId &&
          match.matchDate === slot.matchDate &&
          match.startMinute === slot.startMinute &&
          match.endMinute === endMinute;
        const conflict = alreadyAsPlanned
          ? null
          : findCourtSlotConflict({
              courtId: slot.courtId,
              endMinute,
              ignoredMatchId: match.id as string,
              matchConfig,
              matchDate: slot.matchDate,
              scheduledMatches: matches,
              startMinute: slot.startMinute,
            });

        if (conflict) {
          throw new Error(
            `A quadra ${slot.courtName} ja tem confronto em ${slot.matchDate} ${slot.startMinute}.`
          );
        }

        if (!alreadyAsPlanned) {
          await ctx.db.patch(match.id as Id<"tournamentMatch">, {
            courtId: slot.courtId,
            endMinute,
            matchDate: slot.matchDate,
            rowVersion: match.rowVersion + 1,
            scheduledById: userId,
            startMinute: slot.startMinute,
            // W.O. do sorteio continua W.O.: so o horario se pendura nele.
            status: match.status === "walkover" ? "walkover" : "scheduled",
            updatedAt: now.getTime(),
          });

          if (typeof match.matchDate === "string") {
            matchesRescheduled += 1;
          } else {
            matchesScheduled += 1;
          }
        }

        scheduled.push({
          category: category.displayName,
          courtName: slot.courtName,
          entryAId: match.entryAId ?? null,
          entryBId: match.entryBId ?? null,
          matchDate: slot.matchDate,
          round: match.round,
          startMinute: slot.startMinute,
        });
      }

      categoryResults.push({
        activeEntries: entries.filter((entry) => entry.status === "active")
          .length,
        displayName: category.displayName,
        gender: template.gender,
        round1Matches: round1.length,
        scheduledMatches: scheduledInCategory,
      });
    }

    const sideProfileIds = [
      ...new Set(
        allEntries
          .flatMap((entry) => [entry.playerAId, entry.playerBId])
          .filter(
            (profileId): profileId is Id<"playerProfile"> =>
              typeof profileId === "string"
          )
      ),
    ];
    const sideProfiles = await ctx.orm.query.playerProfile.findMany({
      limit: DOUBLES_SEED_SIDE_PROFILE_LIMIT,
      where: { id: { in: sideProfileIds } },
    });
    const nameByProfileId = new Map(
      sideProfiles.map((profile) => [profile.id as string, profile.fullName])
    );
    const labelByEntryId = new Map(
      allEntries.map((entry) => [
        entry.id as string,
        [entry.playerAId, entry.playerBId]
          .filter(
            (profileId): profileId is Id<"playerProfile"> =>
              typeof profileId === "string"
          )
          .map((profileId) => nameByProfileId.get(profileId) ?? "")
          .join(" / "),
      ])
    );
    const finalTournament = await ctx.orm.query.tournament.findFirst({
      where: { id: tournamentId },
    });

    const finalStatus = finalTournament?.status ?? currentTournament.status;

    return {
      acceptedInvites,
      categories: categoryResults,
      courtsAdded,
      matchesRescheduled,
      matchesScheduled,
      // O que falta do fluxo do produto: sem chave, montar a chave; com a chave
      // montada e o torneio ainda `drawn`, iniciar (chave e agenda so ficam
      // publicas para quem NAO tem inscricao a partir de `ongoing`).
      nextStep:
        matches.length === 0
          ? "assemble_bracket"
          : finalStatus === "drawn"
            ? "start_tournament"
            : null,
      pairsPlanted,
      scheduled: scheduled.map((row) => ({
        category: row.category,
        courtName: row.courtName,
        matchDate: row.matchDate,
        round: row.round,
        sideA: row.entryAId
          ? (labelByEntryId.get(row.entryAId) ?? "A definir")
          : "A definir",
        sideB: row.entryBId
          ? (labelByEntryId.get(row.entryBId) ?? "A definir")
          : "A definir",
        startMinute: row.startMinute,
      })),
      status: finalStatus,
      totalMatches: matches.length,
      tournamentId: tournamentId as string,
      tournamentName: DOUBLES_SEED_TOURNAMENT.name,
    };
  });
