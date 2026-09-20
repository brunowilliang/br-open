/**
 * Player personal dashboard rules — pure functions only.
 *
 * IBX-0071: the player home dash consolidates leagues + tournaments for the
 * viewer. Every rule here takes small typed projections (no ORM records, no
 * ctx) so the aggregation in `functions/player/dashboard.ts` stays a thin
 * wiring layer. Month/day boundaries follow the repo product calendar
 * (Brazil, UTC-3 fixed — `BRAZIL_UTC_OFFSET_MS` in `payment/rules.ts`, the
 * same convention as the renewal reminders and tournament auto-start).
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
 * Whether the subject won their side of a decided match/challenge. `null`
 * when the result carries no winner yet (pending/undecided rows are never
 * counted as either outcome). One rule for both domains: the league compares
 * membership ids, the tournament entry ids — the shape is the same.
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

/** One consolidated result of the player (league challenge or tournament match). */
export type DashResult = {
  at: number;
  competitionId: string;
  competitionName: string;
  kind: "league_challenge" | "tournament_match";
  outcome: "loss" | "win";
};

/**
 * Bucket results into the given month keys (ascending), counting wins and
 * losses per month. Results outside the window are dropped — the window is
 * the contract, so totals and the series always agree.
 */
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

/** Minimal finished-challenge projection for the position series. */
export type PositionSnapshotInput = {
  finishedAtMs: null | number;
  rankingAppliedAtMs: null | number;
  rankingSnapshotAfterResult: null | string[];
};

/**
 * The viewer's position over time in one league, reconstructed from the
 * league-wide snapshots written after each finished challenge
 * (`rankingSnapshotAfterResult`). Points without the member in the snapshot
 * or without any timestamp are skipped; the timestamp is the applied time
 * falling back to `finishedAt`. Same-instant points keep the last snapshot.
 */
export function buildPositionSeries(input: {
  challenges: PositionSnapshotInput[];
  membershipId: string;
}): { points: { at: number; position: number }[]; rankingSize: null | number } {
  const raw: { at: number; position: number; size: number }[] = [];
  for (const challenge of input.challenges) {
    const snapshot = challenge.rankingSnapshotAfterResult;
    if (!snapshot) {
      continue;
    }
    const index = snapshot.indexOf(input.membershipId);
    if (index === -1) {
      continue;
    }
    const at = challenge.rankingAppliedAtMs ?? challenge.finishedAtMs ?? null;
    if (at === null) {
      continue;
    }
    raw.push({ at, position: index + 1, size: snapshot.length });
  }
  raw.sort((a, b) => a.at - b.at);
  const points: { at: number; position: number }[] = [];
  for (const point of raw) {
    const last = points.at(-1);
    if (last && last.at === point.at) {
      points[points.length - 1] = { at: point.at, position: point.position };
      continue;
    }
    points.push({ at: point.at, position: point.position });
  }
  return {
    points,
    rankingSize: raw.at(-1)?.size ?? null,
  };
}

/**
 * The most frequent doubles partner across the player's entries (both sides
 * counted: the player may be playerA or the invited playerB). Cancelled and
 * singles entries are ignored. Deterministic tie-break: most recent entry
 * first, then profile id ascending.
 */
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

/**
 * Count of ACTIVE entries per category id — the "entries by category"
 * distribution (doc decision: active only; pending/cancelled rows are not
 * a confirmed entry).
 */
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

/**
 * Order + cut of the upcoming list: by date, then start minute, capped.
 * Both domains push freely and the NEAREST matches win regardless of origin
 * (review M2: a player loaded with scheduled league challenges must still
 * see their nearer tournament match).
 */
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
