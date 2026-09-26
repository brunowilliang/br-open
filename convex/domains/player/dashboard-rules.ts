/**
 * Player personal dashboard rules — pure functions only.
 *
 * Every rule takes small typed projections (no ORM records, no ctx) so the
 * aggregation in `functions/player/dashboard.ts` stays a thin wiring layer. The
 * product calendar is Brazil, fixed UTC-3 (`BRAZIL_UTC_OFFSET_MS`), same
 * convention as the renewal reminders.
 */

import { BRAZIL_UTC_OFFSET_MS, buildBrazilMonthKey } from "../payment/rules";

/** Day key ("YYYY-MM-DD") of an instant on the Brazilian calendar. */
export function brazilDayKey(ms: number): string {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Whether the subject won their side of a decided match; `null` when the result
 * carries no winner yet (pending rows are never an outcome). The tournament
 * compares entry ids.
 */
export function classifyResultOutcome(args: {
  subjectId: string;
  winnerId: null | string | undefined;
}): null | "loss" | "win" {
  if (!args.winnerId) {
    return null;
  }
  return args.winnerId === args.subjectId ? "win" : "loss";
}

/** One consolidated result of the player (tournament match). */
export type DashResult = {
  at: number;
  competitionId: string;
  competitionName: string;
  outcome: "loss" | "win";
};

/** Bucket results into the given month keys: results outside the window are dropped, so the totals
 * and the series always agree. */
export function bucketResultsByMonth(input: {
  monthKeys: string[];
  results: DashResult[];
}): { losses: number; month: string; wins: number }[] {
  const buckets = new Map<string, { losses: number; wins: number }>(
    input.monthKeys.map((month) => [month, { losses: 0, wins: 0 }])
  );
  for (const result of input.results) {
    const bucket = buckets.get(buildBrazilMonthKey(result.at));
    if (!bucket) {
      continue;
    }
    if (result.outcome === "win") {
      bucket.wins += 1;
    } else {
      bucket.losses += 1;
    }
  }
  return input.monthKeys.map((month) => ({
    losses: buckets.get(month)?.losses ?? 0,
    month,
    wins: buckets.get(month)?.wins ?? 0,
  }));
}

/** The most frequent doubles partner across the player's entries, either side counted. Cancelled and
 * singles entries are ignored. Deterministic tie-break: most recent entry first, then profile id. */
export function findMostFrequentPartner(input: {
  entries: {
    createdAtMs: number;
    playerAId: string;
    playerBId: null | string;
    status: string;
  }[];
  playerProfileId: string;
}): { count: number; lastCreatedAtMs: number; playerProfileId: string } | null {
  const stats = new Map<
    string,
    { count: number; lastCreatedAtMs: number; playerProfileId: string }
  >();
  for (const entry of input.entries) {
    if (entry.status === "cancelled" || !entry.playerBId) {
      continue;
    }
    const partnerId =
      entry.playerAId === input.playerProfileId
        ? entry.playerBId
        : entry.playerBId === input.playerProfileId
          ? entry.playerAId
          : null;
    if (!partnerId) {
      continue;
    }
    const current = stats.get(partnerId) ?? {
      count: 0,
      lastCreatedAtMs: 0,
      playerProfileId: partnerId,
    };
    current.count += 1;
    current.lastCreatedAtMs = Math.max(
      current.lastCreatedAtMs,
      entry.createdAtMs
    );
    stats.set(partnerId, current);
  }
  return (
    [...stats.values()].sort(
      (a, b) =>
        b.count - a.count ||
        b.lastCreatedAtMs - a.lastCreatedAtMs ||
        a.playerProfileId.localeCompare(b.playerProfileId)
    )[0] ?? null
  );
}

/** Count of ACTIVE entries per category id — active only, since a pending or cancelled row is not
 * a confirmed entry. */
export function countActiveEntriesByCategory(input: {
  entries: { categoryId: string; status: string }[];
}): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of input.entries) {
    if (entry.status !== "active") {
      continue;
    }
    counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
  }
  return counts;
}

/** Minimum shape the upcoming cut needs (contract items satisfy this). */
export type UpcomingMatchCandidate = {
  matchDate: string;
  startMinute: number;
};

/** Order + cut of the upcoming list: by date, then start minute, capped. Both domains push freely
 * and the NEAREST matches win regardless of origin. */
export function selectUpcomingMatches<T extends UpcomingMatchCandidate>(input: {
  limit: number;
  matches: T[];
}): T[] {
  return [...input.matches]
    .sort((a, b) =>
      a.matchDate === b.matchDate
        ? a.startMinute - b.startMinute
        : a.matchDate.localeCompare(b.matchDate)
    )
    .slice(0, input.limit);
}
