import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import {
  playerDashboardOverviewSchema,
  type PlayerDashboardOverview,
  type PlayerDashboardPlayerCard,
  type PlayerDashboardUpcomingMatch,
} from "../../domains/player/contract";
import {
  brazilDayKey,
  bucketResultsByMonth,
  classifyResultOutcome,
  countActiveEntriesByCategory,
  findMostFrequentPartner,
  selectUpcomingMatches,
  type DashResult,
} from "../../domains/player/dashboard-rules";
import {
  buildRecentMonthKeys,
  monthKeyWindowStartMs,
} from "../../domains/payment/rules";
import type {
  tournament,
  tournamentCategory,
  tournamentEntry,
} from "../../domains/tournament/tables";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../generated/server";
import { resolveStorageUrl } from "../../shared/media-rules";
import { authQuery } from "../../lib/crpc";
import { requireActivePlayerProfile } from "../viewer/context";

type TournamentEntryRecord = InferSelectModel<typeof tournamentEntry>;
type TournamentCategoryRecord = InferSelectModel<typeof tournamentCategory>;
type TournamentRecord = InferSelectModel<typeof tournament>;

// Read bounds — every list below is explicit and index-backed; a home query
// must stay cheap even for a player with many competitions.
const DEFAULT_MONTHS = 6;
const UPCOMING_LIMIT = 20;
const ENTRY_LIMIT = 100;
const ENTRY_MATCH_LIMIT = 50;
const MATCH_SCAN_LIMIT = 50;

/** Tolerant court lookup — a missing court id degrades to null, never throws. */
function resolveCourtName(
  courts: unknown,
  courtId: null | string | undefined
): null | string {
  if (!(courtId && Array.isArray(courts))) {
    return null;
  }
  const court = courts.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      (candidate as { id?: unknown }).id === courtId
  ) as { name?: unknown } | undefined;
  return typeof court?.name === "string" ? court.name : null;
}

/**
 * Player card cache — profiles repeat across matches/partners; one lookup
 * each. A vanished profile degrades to a placeholder card (the dash must
 * not fail because one row went missing).
 */
function createPlayerCardLoader(ctx: QueryCtx) {
  const cache = new Map<string, Promise<PlayerDashboardPlayerCard>>();
  return (playerProfileId: string): Promise<PlayerDashboardPlayerCard> => {
    const cached = cache.get(playerProfileId);
    if (cached) {
      return cached;
    }
    const card = (async () => {
      // Nullable columns come back as undefined (not null) on ORM records;
      // callers may hand one through — degrade to the placeholder card.
      if (!playerProfileId) {
        return {
          avatarUrl: null,
          fullName: "Jogador",
          playerProfileId: "",
        } satisfies PlayerDashboardPlayerCard;
      }
      const profile = await ctx.orm.query.playerProfile.findFirst({
        where: { id: playerProfileId as Id<"playerProfile"> },
      });
      if (!profile) {
        return {
          avatarUrl: null,
          fullName: "Jogador",
          playerProfileId,
        } satisfies PlayerDashboardPlayerCard;
      }
      const user = await ctx.orm.query.user.findFirst({
        where: { id: profile.userId },
      });
      const avatarUrl = await resolveStorageUrl(ctx, profile.avatarStorageId);
      return {
        avatarUrl: avatarUrl ?? user?.image ?? null,
        fullName: profile.fullName?.trim() || user?.name || "Jogador",
        playerProfileId,
      } satisfies PlayerDashboardPlayerCard;
    })();
    cache.set(playerProfileId, card);
    return card;
  };
}

/**
 * Player-mode home dash: one read-only aggregate over the tournament
 * buckets of the active player profile — upcoming matches, consolidated W/L with
 * the monthly series, active entries per category and the most frequent doubles
 * partner.
 */
export const getOverview = authQuery
  .input(z.object({ months: z.number().int().min(1).max(24).optional() }))
  .output(playerDashboardOverviewSchema)
  .query(async ({ ctx, input }) => {
    const playerProfileId = await requireActivePlayerProfile(ctx);
    const months = input.months ?? DEFAULT_MONTHS;
    const nowMs = Date.now();
    const monthKeys = buildRecentMonthKeys({ months, nowMs });
    const windowStartMs = monthKeyWindowStartMs(monthKeys[0]);
    const todayKey = brazilDayKey(nowMs);

    const getPlayerCard = createPlayerCardLoader(ctx);
    const results: DashResult[] = [];
    const upcoming: PlayerDashboardUpcomingMatch[] = [];
    // --- Tournaments: every non-cancelled entry (playerA or invited
    // playerB), same pattern as tournament.discovery.listParticipating.
    const [asA, asB] = await Promise.all([
      ctx.orm.query.tournamentEntry.findMany({
        limit: ENTRY_LIMIT,
        where: { playerAId: playerProfileId as Id<"playerProfile"> },
      }),
      ctx.orm.query.tournamentEntry.findMany({
        limit: ENTRY_LIMIT,
        where: { playerBId: playerProfileId as Id<"playerProfile"> },
      }),
    ]);
    const entryById = new Map<string, TournamentEntryRecord>();
    for (const entry of [...asA, ...asB]) {
      if (entry.status !== "cancelled") {
        entryById.set(entry.id, entry);
      }
    }
    const entries = [...entryById.values()];

    const categoryById = new Map<string, TournamentCategoryRecord>();
    for (const categoryId of new Set(
      entries.map((entry) => entry.categoryId)
    )) {
      const category = await ctx.orm.query.tournamentCategory.findFirst({
        where: { id: categoryId as Id<"tournamentCategory"> },
      });
      if (category) {
        categoryById.set(categoryId, category);
      }
    }
    const tournamentById = new Map<string, TournamentRecord>();
    for (const tournamentId of new Set(
      [...categoryById.values()].map((category) => category.tournamentId)
    )) {
      const tournament = await ctx.orm.query.tournament.findFirst({
        where: { id: tournamentId as Id<"tournament"> },
      });
      if (tournament) {
        tournamentById.set(tournamentId, tournament);
      }
    }

    // Entries per category (active only — the confirmed-entry distribution).
    const activeCounts = countActiveEntriesByCategory({
      entries: entries.map((entry) => ({
        categoryId: entry.categoryId,
        status: entry.status,
      })),
    });
    const entryCategories = [...activeCounts.entries()]
      .map(([categoryId, entryCount]) => ({
        categoryId,
        displayName: categoryById.get(categoryId)?.displayName ?? "Categoria",
        entryCount,
      }))
      .sort(
        (a, b) =>
          b.entryCount - a.entryCount ||
          a.categoryId.localeCompare(b.categoryId)
      );

    // Most frequent doubles partner across the entry history.
    const frequentPartnerStats = findMostFrequentPartner({
      entries: entries.map((entry) => ({
        createdAtMs: entry.createdAt.getTime(),
        playerAId: entry.playerAId,
        playerBId: entry.playerBId ?? null,
        status: entry.status,
      })),
      playerProfileId,
    });
    const frequentPartner = frequentPartnerStats
      ? {
          count: frequentPartnerStats.count,
          player: await getPlayerCard(frequentPartnerStats.playerProfileId),
        }
      : null;

    // Matches per entry — decided results inside the window + scheduled
    // matches from today on. Draw-time byes (walkover winner set without a
    // publishedAt) are bracket plumbing, not played results: never counted.
    const seenMatchIds = new Set<string>();
    const opponentEntryCache = new Map<string, TournamentEntryRecord>();
    for (const entry of entries.slice(0, ENTRY_MATCH_LIMIT)) {
      const tournament = tournamentById.get(
        categoryById.get(entry.categoryId)?.tournamentId ?? ""
      );
      if (!tournament) {
        continue;
      }
      const [asEntryA, asEntryB] = await Promise.all([
        ctx.orm.query.tournamentMatch.findMany({
          limit: MATCH_SCAN_LIMIT,
          where: { entryAId: entry.id as Id<"tournamentEntry"> },
        }),
        ctx.orm.query.tournamentMatch.findMany({
          limit: MATCH_SCAN_LIMIT,
          where: { entryBId: entry.id as Id<"tournamentEntry"> },
        }),
      ]);

      for (const match of [...asEntryA, ...asEntryB]) {
        if (seenMatchIds.has(match.id)) {
          continue;
        }
        seenMatchIds.add(match.id);

        if (match.status === "finished") {
          if (match.walkover && !match.publishedAt) {
            continue;
          }
          if (!match.winnerEntryId) {
            continue;
          }
          const at = (match.publishedAt ?? match.updatedAt).getTime();
          if (at < windowStartMs) {
            continue;
          }
          const outcome = classifyResultOutcome({
            subjectId: entry.id,
            winnerId: match.winnerEntryId,
          });
          if (!outcome) {
            continue;
          }
          results.push({
            at,
            competitionId: tournament.id,
            competitionName: tournament.name,
            outcome,
          });
          continue;
        }

        if (
          match.status !== "scheduled" ||
          !match.matchDate ||
          match.matchDate < todayKey
        ) {
          continue;
        }
        const myIsA = match.entryAId === entry.id;
        const otherEntryId = myIsA ? match.entryBId : match.entryAId;
        // My doubles partner is the OTHER player of MY entry (I may be the
        // invited playerB) — not the other side of the match.
        const partnerId =
          entry.playerAId === playerProfileId
            ? (entry.playerBId ?? null)
            : entry.playerAId;
        let otherEntry = otherEntryId
          ? opponentEntryCache.get(otherEntryId)
          : undefined;
        if (otherEntryId && !otherEntry) {
          const fetched = await ctx.orm.query.tournamentEntry.findFirst({
            where: { id: otherEntryId as Id<"tournamentEntry"> },
          });
          if (fetched) {
            opponentEntryCache.set(otherEntryId, fetched);
            otherEntry = fetched;
          }
        }
        const opponentIds = otherEntry
          ? [otherEntry.playerAId, otherEntry.playerBId].filter(
              (id) => typeof id === "string"
            )
          : [];
        upcoming.push({
          categoryDisplayName:
            categoryById.get(entry.categoryId)?.displayName ?? null,
          categoryId: entry.categoryId,
          competitionId: tournament.id,
          competitionName: tournament.name,
          courtName: resolveCourtName(tournament.courts, match.courtId),
          endMinute: match.endMinute ?? null,
          id: match.id,
          matchDate: match.matchDate,
          opponents: await Promise.all(opponentIds.map(getPlayerCard)),
          partner: partnerId ? await getPlayerCard(partnerId) : null,
          startMinute: match.startMinute ?? 0,
        });
      }
    }

    const byMonth = bucketResultsByMonth({ monthKeys, results });
    const wins = byMonth.reduce((sum, bucket) => sum + bucket.wins, 0);
    const losses = byMonth.reduce((sum, bucket) => sum + bucket.losses, 0);
    const decided = wins + losses;

    const upcomingMatches = selectUpcomingMatches({
      limit: UPCOMING_LIMIT,
      matches: upcoming,
    });

    return playerDashboardOverviewSchema.parse({
      entryCategories,
      frequentPartner,
      performance: {
        byMonth,
        losses,
        winRate: decided > 0 ? wins / decided : 0,
        wins,
      },
      upcomingMatches,
    } satisfies PlayerDashboardOverview);
  });
