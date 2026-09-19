import { BRAZIL_UTC_OFFSET_MS, MS_PER_DAY } from "../payment/rules";
import {
  rangesOverlap,
  resolveMatchOccupiedEndMinute,
} from "../league/challenge-scheduling-rules";
import type { LeagueMatchConfig } from "../league/contract";

/**
 * IBX-0069: a tournament whose start date has arrived (on the BRAZILIAN
 * calendar, repo convention — BUG-0024) starts ITSELF — the organizer no
 * longer has to touch Iniciar. Day-boundary comparison of both instants
 * (not a 24h window): a startDate at any hour of day D must fire during D.
 * `drawn` starts directly; `published` draws FIRST and then starts (IBX-0069
 * round 2, user decision: with no draw by the start day, the random draw
 * runs itself — "azar do organizador"). Past states are untouchable —
 * idempotent by status: once `ongoing`, the rule can never fire again.
 */
export function shouldAutoStartTournament(input: {
  nowMs: number;
  startDateMs: number;
  status: string;
}): boolean {
  if (input.status !== "drawn" && input.status !== "published") {
    return false;
  }
  return (
    Math.floor((input.startDateMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY) <=
    Math.floor((input.nowMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY)
  );
}

/**
 * Minimal scheduling fields the court conflict check needs from a match row.
 * Absent keys are modeled explicitly: Convex omits unset keys, so runtime
 * values can be undefined even where the row type says `| null` (BUG-0030).
 */
export type TournamentScheduledMatch = {
  courtId: string | null | undefined;
  id: string;
  matchDate: string | null | undefined;
  startMinute: number | null | undefined;
};

export function isScheduledTournamentMatch(
  match: TournamentScheduledMatch
): match is TournamentScheduledMatch & {
  courtId: string;
  matchDate: string;
  startMinute: number;
} {
  return (
    typeof match.courtId === "string" &&
    typeof match.matchDate === "string" &&
    typeof match.startMinute === "number"
  );
}

/**
 * First scheduled match occupying [start, start + defaultDurationMinutes) on
 * the same court and date, or null. Occupancy is derived from the rules'
 * default duration on BOTH sides, so a client-sent endMinute can never shrink
 * a booking out of the way (BUG-0027). The match being rescheduled ignores
 * itself. Walkovers keep occupying the court: the booking was made.
 */
export function findCourtSlotConflict(input: {
  courtId: string;
  endMinute: number;
  ignoredMatchId?: string;
  matchConfig: LeagueMatchConfig;
  matchDate: string;
  scheduledMatches: TournamentScheduledMatch[];
  startMinute: number;
}): TournamentScheduledMatch | null {
  for (const match of input.scheduledMatches) {
    if (match.id === input.ignoredMatchId) {
      continue;
    }
    if (
      match.courtId !== input.courtId ||
      match.matchDate !== input.matchDate ||
      typeof match.startMinute !== "number"
    ) {
      continue;
    }

    const occupiedEndMinute = resolveMatchOccupiedEndMinute({
      matchConfig: input.matchConfig,
      startMinute: match.startMinute,
    });

    if (
      rangesOverlap({
        leftEndMinute: input.endMinute,
        leftStartMinute: input.startMinute,
        rightEndMinute: occupiedEndMinute,
        rightStartMinute: match.startMinute,
      })
    ) {
      return match;
    }
  }

  return null;
}
