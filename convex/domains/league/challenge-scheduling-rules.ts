import { LeagueCourtDayKeys, type LeagueCourtDay } from "./contract";

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
