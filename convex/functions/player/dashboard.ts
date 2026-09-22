import { z } from "zod";
import type { InferSelectModel } from "kitcn/orm";
import { LEAGUE_MEMBERSHIP_STATUSES } from "../../domains/league/contract";
import type { leagueChallenge } from "../../domains/league/tables";
import {
  playerDashboardOverviewSchema,
  type PlayerDashboardLeaguePosition,
  type PlayerDashboardOverview,
  type PlayerDashboardPlayerCard,
  type PlayerDashboardUpcomingMatch,
} from "../../domains/player/contract";
import {
  brazilDayKey,
  bucketResultsByMonth,
  buildPositionSeries,
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

type LeagueChallengeRecord = InferSelectModel<typeof leagueChallenge>;
type TournamentEntryRecord = InferSelectModel<typeof tournamentEntry>;
type TournamentCategoryRecord = InferSelectModel<typeof tournamentCategory>;
type TournamentRecord = InferSelectModel<typeof tournament>;

// Read bounds — every list below is explicit and index-backed; a home query
// must stay cheap even for a player with many competitions.
const DEFAULT_MONTHS = 6;
const UPCOMING_LIMIT = 20;
const POSITION_SERIES_LIMIT = 24;
const LEAGUE_LIMIT = 20;
const CHALLENGE_SCAN_LIMIT = 200;
const PROPOSAL_SCAN_LIMIT = 10;
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
 * Player-mode home dash: one read-only aggregate over the league + tournament
 * buckets of the active player profile — upcoming matches, consolidated W/L with
 * the monthly series, current league positions with their ranking-snapshot
 * series, active entries per category and the most frequent doubles partner.
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
    const leagues: PlayerDashboardLeaguePosition[] = [];

    // --- Leagues: active memberships only (the same set listParticipating
    // shows; payment_due/suspended members are treated as guests).
    const memberships = await ctx.orm.query.leagueMembership.findMany({
      limit: LEAGUE_LIMIT,
      where: {
        playerProfileId: playerProfileId as Id<"playerProfile">,
        status: LEAGUE_MEMBERSHIP_STATUSES.ACTIVE,
      },
    });

    for (const membership of memberships) {
      const league = await ctx.orm.query.league.findFirst({
        where: { id: membership.leagueId },
      });
      if (!league) {
        continue;
      }

      const [asChallenger, asChallenged] = await Promise.all([
        ctx.orm.query.leagueChallenge.findMany({
          limit: CHALLENGE_SCAN_LIMIT,
          where: {
            challengerMembershipId: membership.id as Id<"leagueMembership">,
            status: "finished",
          },
        }),
        ctx.orm.query.leagueChallenge.findMany({
          limit: CHALLENGE_SCAN_LIMIT,
          where: {
            challengedMembershipId: membership.id as Id<"leagueMembership">,
            status: "finished",
          },
        }),
      ]);
      const finishedById = new Map<string, LeagueChallengeRecord>();
      for (const challenge of [...asChallenger, ...asChallenged]) {
        finishedById.set(challenge.id, challenge);
      }
      const finished = [...finishedById.values()];

      // Position series from the league-wide ranking snapshots.
      const series = buildPositionSeries({
        challenges: finished.map((challenge) => ({
          finishedAtMs: challenge.finishedAt?.getTime() ?? null,
          rankingAppliedAtMs: challenge.rankingAppliedAt?.getTime() ?? null,
          rankingSnapshotAfterResult:
            challenge.rankingSnapshotAfterResult ?? null,
        })),
        membershipId: membership.id,
      });
      leagues.push({
        leagueId: league.id,
        leagueName: league.name,
        membershipId: membership.id,
        position: membership.rankingPosition ?? null,
        rankingSize: series.rankingSize,
        series: series.points.slice(-POSITION_SERIES_LIMIT),
      });

      // W/L: decided challenges inside the window; the winner comes from the
      // latest result submission (the challenge row itself carries none).
      for (const challenge of finished) {
        if (
          !challenge.finishedAt ||
          challenge.finishedAt.getTime() < windowStartMs
        ) {
          continue;
        }
        const submission =
          await ctx.orm.query.leagueChallengeResultSubmission.findFirst({
            orderBy: { submittedAt: "desc" },
            where: { challengeId: challenge.id as Id<"leagueChallenge"> },
          });
        const outcome = classifyResultOutcome({
          subjectId: membership.id,
          winnerId: submission?.winnerMembershipId ?? null,
        });
        if (!outcome) {
          continue;
        }
        results.push({
          at: challenge.finishedAt.getTime(),
          competitionId: league.id,
          competitionName: league.name,
          kind: "league_challenge",
          outcome,
        });
      }

      // Upcoming: confirmed challenges (accepted proposal) from today on —
      // same semantics as league.challenges.listScheduled.
      const [confirmedAsChallenger, confirmedAsChallenged] = await Promise.all([
        ctx.orm.query.leagueChallenge.findMany({
          limit: CHALLENGE_SCAN_LIMIT,
          where: {
            challengerMembershipId: membership.id as Id<"leagueMembership">,
            status: "confirmed",
          },
        }),
        ctx.orm.query.leagueChallenge.findMany({
          limit: CHALLENGE_SCAN_LIMIT,
          where: {
            challengedMembershipId: membership.id as Id<"leagueMembership">,
            status: "confirmed",
          },
        }),
      ]);
      const confirmedById = new Map<string, LeagueChallengeRecord>();
      for (const challenge of [
        ...confirmedAsChallenger,
        ...confirmedAsChallenged,
      ]) {
        confirmedById.set(challenge.id, challenge);
      }

      for (const challenge of confirmedById.values()) {
        const proposals = await ctx.orm.query.leagueChallengeProposal.findMany({
          limit: PROPOSAL_SCAN_LIMIT,
          orderBy: { revisionNumber: "desc" },
          where: { challengeId: challenge.id as Id<"leagueChallenge"> },
        });
        const proposal =
          proposals.find((item) => item.id === challenge.currentProposalId) ??
          proposals[0];
        if (!proposal || proposal.matchDate < todayKey) {
          continue;
        }
        const rivalMembershipId =
          challenge.challengerMembershipId === membership.id
            ? challenge.challengedMembershipId
            : challenge.challengerMembershipId;
        const rivalMembership = await ctx.orm.query.leagueMembership.findFirst({
          where: { id: rivalMembershipId as Id<"leagueMembership"> },
        });
        if (!rivalMembership) {
          continue;
        }
        upcoming.push({
          categoryDisplayName: null,
          categoryId: null,
          competitionId: league.id,
          competitionName: league.name,
          courtName: resolveCourtName(league.courts, proposal.courtId),
          endMinute: proposal.endMinute,
          id: challenge.id,
          kind: "league_challenge",
          matchDate: proposal.matchDate,
          opponents: [await getPlayerCard(rivalMembership.playerProfileId)],
          partner: null,
          startMinute: proposal.startMinute,
        });
      }
    }

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
            kind: "tournament_match",
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
          kind: "tournament_match",
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
      leagues,
      performance: {
        byMonth,
        losses,
        winRate: decided > 0 ? wins / decided : 0,
        wins,
      },
      upcomingMatches,
    } satisfies PlayerDashboardOverview);
  });
