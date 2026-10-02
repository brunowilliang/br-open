import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";
import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "../payment/contract";
import { canChargeBeCanceled, canRequestRefund } from "../payment/rules";
import { MAX_TOURNAMENT_CATEGORIES } from "../tournament/contract";
import { isLiveEntryStatus } from "../tournament/entry-rules";
import {
  isActiveTournamentForDeletion,
  resolveAccountDeletionEntryAction,
  type AccountDeletionOrgSnapshot,
  type AccountDeletionSnapshot,
} from "./deletion-rules";

export type AccountDeletionReadCtx = QueryCtx | MutationCtx;

const MEMBER_SCAN_LIMIT = 100;
/** Mesmos tetos do registry de pendencias e das varreduras de chave. */
const ORG_TOURNAMENT_SCAN_LIMIT = 50;
const ORG_DRAFT_SCAN_LIMIT = 10;
const ORG_MONEY_SCAN_LIMIT = 100;
const PLAYER_ENTRY_SCAN_LIMIT = 100;
const ENTRY_MATCH_SCAN_LIMIT = 300;
const ENTRY_CHARGE_SCAN_LIMIT = 300;

export type AccountDeletionPlan = {
  /** Inscricoes vivas que saem inteiras (sem partidas). */
  cancellableEntryIds: string[];
  /** Rascunhos sem inscricao de organizacoes geridas pelo usuario. */
  draftTournamentIds: string[];
  /** Arquivos (avatar/capa) dos rascunhos: saem junto com as linhas. */
  draftStorageIds: string[];
  /** Todas as inscricoes vivas: fonte do cancelamento de PIX aberto. */
  liveEntryIds: string[];
  /** Organizacoes que viram "Organizador removido" na exclusao. */
  managedOrganizations: Array<{
    logo: null | string;
    organizationId: Id<"organization">;
  }>;
  playerProfileId: null | Id<"playerProfile">;
  /** Visao da regua (bloqueios + resolucoes) tirada da MESMA leitura. */
  snapshot: AccountDeletionSnapshot;
  /** Partidas pendentes que viram W.O. na exclusao. */
  walkoverMatchIds: string[];
};

async function collectOrganizationSnapshots(
  ctx: AccountDeletionReadCtx,
  userId: Id<"user">
): Promise<{
  managedOrganizations: AccountDeletionPlan["managedOrganizations"];
  organizationDraftStorageIds: string[];
  organizations: AccountDeletionOrgSnapshot[];
  organizationDraftIds: string[];
}> {
  const memberships = await ctx.orm.query.member.findMany({
    limit: MEMBER_SCAN_LIMIT,
    where: { userId },
  });
  const managedMemberships = memberships.filter(
    (membership) => membership.role === "owner" || membership.role === "admin"
  );

  const managedOrganizations: AccountDeletionPlan["managedOrganizations"] = [];
  const organizations: AccountDeletionOrgSnapshot[] = [];
  const organizationDraftIds: string[] = [];
  const organizationDraftStorageIds = new Set<string>();

  for (const membership of managedMemberships) {
    const organizationId = membership.organizationId as Id<"organization">;
    const [
      organization,
      members,
      tournaments,
      pendingWithdrawals,
      pendingRecoveries,
      pendingRefunds,
      failedRefunds,
      balance,
    ] = await Promise.all([
      ctx.orm.query.organization.findFirst({ where: { id: organizationId } }),
      ctx.orm.query.member.findMany({
        limit: 2,
        where: { organizationId },
      }),
      ctx.orm.query.tournament.findMany({
        limit: ORG_TOURNAMENT_SCAN_LIMIT,
        orderBy: { updatedAt: "desc" },
        where: { organizationId },
      }),
      ctx.orm.query.withdrawals.findMany({
        limit: ORG_MONEY_SCAN_LIMIT,
        where: { organizationId, status: "pending" },
      }),
      ctx.orm.query.paymentCharge.findMany({
        limit: ORG_MONEY_SCAN_LIMIT,
        where: { organizationId, refundRecoveryStatus: "pending" },
      }),
      ctx.orm.query.paymentCharge.findMany({
        limit: ORG_MONEY_SCAN_LIMIT,
        where: { organizationId, refundStatus: "pending" },
      }),
      ctx.orm.query.paymentCharge.findMany({
        limit: ORG_MONEY_SCAN_LIMIT,
        where: { organizationId, refundStatus: "failed" },
      }),
      ctx.orm.query.subaccountBalance.findFirst({
        where: { organizationId },
      }),
    ]);

    managedOrganizations.push({
      logo: organization?.logo ?? null,
      organizationId,
    });

    const activeTournamentRows = tournaments.filter((row) =>
      isActiveTournamentForDeletion(row.status)
    );

    const draftTournamentIds: string[] = [];
    for (const draft of tournaments
      .filter((row) => row.status === "draft")
      .slice(0, ORG_DRAFT_SCAN_LIMIT)) {
      const categories = await ctx.orm.query.tournamentCategory.findMany({
        limit: MAX_TOURNAMENT_CATEGORIES,
        where: { tournamentId: draft.id as Id<"tournament"> },
      });
      let hasEntry = false;
      for (const category of categories) {
        const entries = await ctx.orm.query.tournamentEntry.findMany({
          limit: 1,
          where: { categoryId: category.id as Id<"tournamentCategory"> },
        });
        if (entries.length > 0) {
          hasEntry = true;
          break;
        }
      }
      if (!hasEntry) {
        draftTournamentIds.push(draft.id as string);
        if (draft.avatarStorageId) {
          organizationDraftStorageIds.add(draft.avatarStorageId);
        }
        if (draft.coverStorageId) {
          organizationDraftStorageIds.add(draft.coverStorageId);
        }
      }
    }
    organizationDraftIds.push(...draftTournamentIds);

    organizations.push({
      activeTournaments: activeTournamentRows.map((row) => ({
        id: row.id as string,
        organizationId,
      })),
      draftTournamentIds,
      lockedBalanceCents: balance?.balanceCents ?? 0,
      moneyInFlightCount:
        pendingWithdrawals.length +
        pendingRecoveries.length +
        pendingRefunds.length +
        failedRefunds.length,
      organizationId: organizationId as string,
      otherMemberCount: members.filter((row) => row.userId !== userId).length,
    });
  }

  return {
    managedOrganizations,
    organizationDraftIds,
    organizationDraftStorageIds: [...organizationDraftStorageIds],
    organizations,
  };
}

async function collectPlayerSnapshot(
  ctx: AccountDeletionReadCtx,
  userId: Id<"user">
): Promise<{
  cancellableEntryIds: string[];
  liveEntryIds: string[];
  player: AccountDeletionPlan["snapshot"]["player"];
  playerProfileId: null | Id<"playerProfile">;
  walkoverMatchIds: string[];
}> {
  const profile = await ctx.orm.query.playerProfile.findFirst({
    where: { userId },
  });
  if (!profile) {
    return {
      cancellableEntryIds: [],
      liveEntryIds: [],
      player: null,
      playerProfileId: null,
      walkoverMatchIds: [],
    };
  }

  const playerProfileId = profile.id as Id<"playerProfile">;
  const [asPlayerA, asPlayerB] = await Promise.all([
    ctx.orm.query.tournamentEntry.findMany({
      limit: PLAYER_ENTRY_SCAN_LIMIT,
      orderBy: { createdAt: "desc" },
      where: { playerAId: playerProfileId },
    }),
    ctx.orm.query.tournamentEntry.findMany({
      limit: PLAYER_ENTRY_SCAN_LIMIT,
      orderBy: { createdAt: "desc" },
      where: { playerBId: playerProfileId },
    }),
  ]);
  const liveEntries = [
    ...new Map(
      [...asPlayerA, ...asPlayerB].map((entry) => [entry.id as string, entry])
    ).values(),
  ].filter((entry) => isLiveEntryStatus(entry.status));
  const liveEntryIds = liveEntries.map((entry) => entry.id as string);

  if (liveEntries.length === 0) {
    return {
      cancellableEntryIds: [],
      liveEntryIds,
      player: {
        cancellableEntryCount: 0,
        pendingMatchCount: 0,
        pendingPixCount: 0,
        refundableChargeCount: 0,
      },
      playerProfileId,
      walkoverMatchIds: [],
    };
  }

  const categoryIds = [
    ...new Set(liveEntries.map((entry) => entry.categoryId as string)),
  ] as Id<"tournamentCategory">[];
  const categories = await ctx.orm.query.tournamentCategory.findMany({
    limit: categoryIds.length,
    where: { id: { in: categoryIds } },
  });
  const categoryById = new Map(
    categories.map((category) => [category.id as string, category])
  );
  const tournamentIds = [
    ...new Set(categories.map((category) => category.tournamentId as string)),
  ] as Id<"tournament">[];
  const tournaments = await ctx.orm.query.tournament.findMany({
    limit: tournamentIds.length,
    where: { id: { in: tournamentIds } },
  });
  const tournamentById = new Map(
    tournaments.map((row) => [row.id as string, row])
  );

  const entryIds = liveEntryIds as Id<"tournamentEntry">[];
  const [matchesAsA, matchesAsB] = await Promise.all([
    ctx.orm.query.tournamentMatch.findMany({
      limit: ENTRY_MATCH_SCAN_LIMIT,
      where: { entryAId: { in: entryIds } },
    }),
    ctx.orm.query.tournamentMatch.findMany({
      limit: ENTRY_MATCH_SCAN_LIMIT,
      where: { entryBId: { in: entryIds } },
    }),
  ]);
  const pendingMatches = [
    ...new Map(
      [...matchesAsA, ...matchesAsB].map((match) => [match.id as string, match])
    ).values(),
  ].filter(
    (match) =>
      (match.status === "pending" || match.status === "scheduled") &&
      !match.publishedAt &&
      match.entryAId !== null &&
      match.entryBId !== null
  );

  const cancellableEntryIds: string[] = [];
  const walkoverMatchIds: string[] = [];
  for (const entry of liveEntries) {
    const category = categoryById.get(entry.categoryId as string);
    const currentTournament = category
      ? tournamentById.get(category.tournamentId as string)
      : undefined;
    const entryMatches = pendingMatches.filter(
      (match) => match.entryAId === entry.id || match.entryBId === entry.id
    );
    const action = resolveAccountDeletionEntryAction({
      entryStatus: entry.status,
      pendingMatchCount: entryMatches.length,
      tournamentStatus: currentTournament?.status ?? "",
    });
    if (action === "cancel") {
      cancellableEntryIds.push(entry.id as string);
    }
    if (action === "walkover") {
      walkoverMatchIds.push(...entryMatches.map((match) => match.id as string));
    }
  }

  const cancellableIds = cancellableEntryIds as Id<"tournamentEntry">[];
  const [pendingPixCharges, cancellablePaidCharges] = await Promise.all([
    ctx.orm.query.paymentCharge.findMany({
      limit: ENTRY_CHARGE_SCAN_LIMIT,
      where: {
        sourceId: { in: liveEntryIds },
        sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
        status: "PENDING",
      },
    }),
    cancellableIds.length > 0
      ? ctx.orm.query.paymentCharge.findMany({
          limit: ENTRY_CHARGE_SCAN_LIMIT,
          where: {
            sourceId: { in: cancellableEntryIds },
            sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
            status: "PAID",
          },
        })
      : [],
  ]);

  return {
    cancellableEntryIds,
    liveEntryIds,
    player: {
      cancellableEntryCount: cancellableEntryIds.length,
      pendingMatchCount: new Set(walkoverMatchIds).size,
      pendingPixCount: pendingPixCharges.filter((charge) =>
        canChargeBeCanceled(charge)
      ).length,
      refundableChargeCount: cancellablePaidCharges.filter((charge) =>
        canRequestRefund(charge)
      ).length,
    },
    playerProfileId,
    walkoverMatchIds: [...new Set(walkoverMatchIds)],
  };
}

/**
 * Leitura UNICA da regua: o status mostra e o execute repete (mesma tx), entao
 * bloqueio/resolucao nunca divergem entre tela e execucao. Todo cap e declarado
 * acima; nenhuma varredura e ilimitada.
 */
export async function collectAccountDeletionPlan(
  ctx: AccountDeletionReadCtx,
  userId: Id<"user">
): Promise<AccountDeletionPlan> {
  const [organizationPlan, playerPlan] = await Promise.all([
    collectOrganizationSnapshots(ctx, userId),
    collectPlayerSnapshot(ctx, userId),
  ]);

  return {
    cancellableEntryIds: playerPlan.cancellableEntryIds,
    draftStorageIds: organizationPlan.organizationDraftStorageIds,
    draftTournamentIds: organizationPlan.organizationDraftIds,
    liveEntryIds: playerPlan.liveEntryIds,
    managedOrganizations: organizationPlan.managedOrganizations,
    playerProfileId: playerPlan.playerProfileId,
    snapshot: {
      organizations: organizationPlan.organizations,
      player: playerPlan.player,
    },
    walkoverMatchIds: playerPlan.walkoverMatchIds,
  };
}
