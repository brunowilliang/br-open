import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./generated/server";

import * as authTables from "../domains/auth/tables";
import {
  SEED_EMAIL_DOMAIN,
  SEED_EMAIL_PREFIX,
  DoublesAgendaScenarioSchema,
  DoublesScenarioSchema,
  doublesAgendaScenarioResultSchema,
  doublesScenarioResultSchema,
  pendencyScenarioResultSchema,
  PendencyScenarioSchema,
  seedPreviewResultSchema,
  SeedPreviewSchema,
  type DoublesAgendaScenarioResult,
  type DoublesScenarioResult,
} from "../domains/seed/contract";
import { defaultSeedRuleConfig, seedPlayers } from "../domains/seed/data";
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
  comparePendencyTargetRecency,
  PENDENCY_SEED_ORGANIZATION_NAME,
  PENDENCY_SEED_PRIMARY_ENTRY_TARGETS,
  PENDENCY_SEED_PRIMARY_ORGANIZATION_LIMIT,
  PENDENCY_SEED_PRIMARY_TOURNAMENT_STATUSES,
  PENDENCY_SEED_TOURNAMENTS,
  PENDENCY_SEED_VIEWER_GENDER,
  type PendencySeedEntry,
  type PendencySeedTournament,
  selectFreePendencyEntryProfiles,
} from "../domains/seed/pendency-plan";
import * as playerTables from "../domains/player/tables";
import {
  buildCategoryDisplayName,
  entrySlotFields,
} from "../domains/tournament/entry-rules";
import type { MatchConfig } from "../domains/match/contract";
import { resolveMatchOccupiedEndMinute } from "../domains/match/scheduling";
import { findCourtSlotConflict } from "../domains/tournament/scheduling-rules";
import type {
  TournamentGender,
  TournamentModality,
} from "../domains/tournament/contract";
import * as tournamentTables from "../domains/tournament/tables";
import { privateMutation } from "../lib/crpc";

type SeedCtx = MutationCtx;
type TournamentEntryRecord = InferSelectModel<
  typeof tournamentTables.tournamentEntry
>;

type SeedPlayerInput = {
  emailLocalPart: string;
  fullName: string;
  gender: "Feminino" | "Masculino";
  image: string;
  nickname: string;
  /** Opcional: so o elenco de duplas precisa (o convite e por username). */
  username?: string;
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function buildSeedEmail(localPart: string) {
  return `${SEED_EMAIL_PREFIX}${localPart}@${SEED_EMAIL_DOMAIN}`;
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

async function listSeedUsers(ctx: SeedCtx) {
  const users = await ctx.orm.query.user.findMany({
    limit: 500,
    orderBy: { createdAt: "asc" },
  });

  return users.filter((user) => isSeedUserEmail(user.email));
}

async function deleteByIds<T extends "playerProfile" | "user">(
  ctx: SeedCtx,
  tableName: T,
  ids: string[]
) {
  for (const id of ids) {
    switch (tableName) {
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
  const [seedUsers, playerProfiles] = await Promise.all([
    listSeedUsers(ctx),
    ctx.orm.query.playerProfile.findMany({
      limit: 500,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const seedUserIds = new Set(seedUsers.map((user) => user.id));

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

export const preview = privateMutation
  .input(SeedPreviewSchema)
  .output(seedPreviewResultSchema)
  .mutation(async ({ ctx, input }) => {
    if (input.reset) {
      await resetSeedData(ctx);
    }

    if (input.primaryUserEmail) {
      await requirePrimaryUser(ctx, input.primaryUserEmail);
    }

    const { playerProfilesCreated, usersCreated } = await seedCoreUsers(ctx);
    const skipped =
      !input.reset && playerProfilesCreated === 0 && usersCreated === 0;

    return {
      playerProfilesCreated,
      primaryUserLinked: Boolean(input.primaryUserEmail),
      resetApplied: Boolean(input.reset),
      skipped,
      usersCreated,
    };
  });

// Cenario de pendencias na CONTA do usuario: o estado que
// `domains/pendings/registry.ts` le. Tudo idempotente pelo nome/correlationId;
// NUNCA faz reset nem apaga linha.

/** Bounds do plantio na organizacao do alvo (mesmo molde dos caps das leituras). */
const PENDENCY_SEED_PRIMARY_CATEGORY_SCAN_LIMIT = 10;
const PENDENCY_SEED_PRIMARY_ENTRY_SCAN_LIMIT = 300;
const PENDENCY_SEED_PRIMARY_TOURNAMENT_SCAN_LIMIT = 50;

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

  for (const organizationId of organizations) {
    entriesCreated += await ensurePrimaryEntryPendencies(ctx, {
      organizationId,
      seedProfiles: input.seedProfiles,
    });
  }

  return {
    entriesCreated,
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
      entriesCreated,
      organizationId: organizationId as string,
      playerProfileId: playerProfileId as string,
      playerProfilesCreated:
        seedCoreResult.playerProfilesCreated + (profileResult.created ? 1 : 0),
      primaryEntriesCreated: primaryPendencies.entriesCreated,
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
    const matchConfig = currentTournament.matchConfig as MatchConfig;
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
