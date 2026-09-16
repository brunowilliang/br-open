import {
  DEFAULT_LEAGUE_MATCH_CONFIG,
  LeagueCourtDayKeys,
  type LeagueCourtDay,
  type LeagueMatchConfig,
} from "./contract";

/**
 * Day-of-week key (mon-sun) for a YYYY-MM-DD matchDate, derived in UTC so it
 * stays consistent with how court availability is stored (see
 * leagueCourt.availability).
 */
export function getDayKeyFromMatchDate(matchDate: string): LeagueCourtDay {
  const parsedDate = new Date(`${matchDate}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Data da partida inválida.");
  }

  return LeagueCourtDayKeys[
    parsedDate.getUTCDay() === 0 ? 6 : parsedDate.getUTCDay() - 1
  ];
}

/**
 * Builds the absolute scheduled Date for a matchDate (YYYY-MM-DD, UTC midnight)
 * plus a minute offset within that day. Throws on invalid dates.
 */
export function buildScheduledDate(matchDate: string, minute: number) {
  const baseDate = new Date(`${matchDate}T00:00:00.000Z`);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Data da partida inválida.");
  }

  baseDate.setUTCMinutes(minute, 0, 0);

  return baseDate;
}

/**
 * Half-open interval overlap test for [start, end) minute ranges. Two ranges
 * that only touch at an endpoint (one ends exactly when the other starts) do
 * NOT overlap.
 */
export function rangesOverlap(input: {
  leftEndMinute: number;
  leftStartMinute: number;
  rightEndMinute: number;
  rightStartMinute: number;
}) {
  return (
    input.leftStartMinute < input.rightEndMinute &&
    input.rightStartMinute < input.leftEndMinute
  );
}

/**
 * Effective end of a match's occupied court window, derived from the rules'
 * default duration (defaultDurationMinutes). Occupancy is always derived from
 * the rule instead of trusting a client-sent endMinute, so a booking can
 * never shrink itself out of a conflict (BUG-0027).
 */
export function resolveMatchOccupiedEndMinute(input: {
  matchConfig: LeagueMatchConfig;
  startMinute: number;
}) {
  // BUG-0030: old configs may lack defaultDurationMinutes (and stored keys
  // can be absent/invalid) — fall back to the shipped default instead of
  // deriving a NaN occupied window.
  const duration = input.matchConfig.defaultDurationMinutes;
  const effectiveDuration =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : DEFAULT_LEAGUE_MATCH_CONFIG.defaultDurationMinutes;

  return input.startMinute + effectiveDuration;
}
