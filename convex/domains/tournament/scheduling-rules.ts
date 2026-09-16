import {
  rangesOverlap,
  resolveMatchOccupiedEndMinute,
} from "../league/challenge-scheduling-rules";
import type { LeagueMatchConfig } from "../league/contract";

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
