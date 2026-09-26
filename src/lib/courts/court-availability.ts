import type { Court, CourtDay } from "@convex/domains/match/contract";
import { CourtDayKeys } from "@convex/domains/match/contract";

export const COURT_DAYS = CourtDayKeys;

export type CourtTimeRange = {
  endMinute: number;
  startMinute: number;
};

export type ApplyCourtRangeInput = {
  court: Court;
  days: readonly CourtDay[];
  endMinute: number;
  startMinute: number;
  /** Edit path: day + exact range being replaced in place. */
  replacing?: {
    day: CourtDay;
    range: CourtTimeRange;
  };
};

export type ApplyCourtRangeResult =
  | { conflictDays: CourtDay[]; status: "conflict" }
  | { court: Court; status: "ok" };

export function hasRangeOverlap(ranges: readonly CourtTimeRange[]): boolean {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startMinute - right.startMinute
  );

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previousRange = sortedRanges[index - 1];
    const currentRange = sortedRanges[index];

    if (currentRange.startMinute < previousRange.endMinute) {
      return true;
    }
  }

  return false;
}

function buildNextRanges(
  court: Court,
  day: CourtDay,
  replacing: ApplyCourtRangeInput["replacing"],
  addedRange: CourtTimeRange
): CourtTimeRange[] {
  const baseRanges =
    replacing && day === replacing.day
      ? court.availability[day].filter(
          (range) =>
            !(
              range.startMinute === replacing.range.startMinute &&
              range.endMinute === replacing.range.endMinute
            )
        )
      : court.availability[day];

  return [...baseRanges, addedRange].sort(
    (left, right) => left.startMinute - right.startMinute
  );
}

export function applyCourtRange(
  input: ApplyCourtRangeInput
): ApplyCourtRangeResult {
  const { court, days, endMinute, startMinute, replacing } = input;
  const orderedDays = COURT_DAYS.filter((day) => days.includes(day));
  const addedRange: CourtTimeRange = { endMinute, startMinute };

  const conflictDays = orderedDays.filter((day) =>
    hasRangeOverlap(buildNextRanges(court, day, replacing, addedRange))
  );

  if (conflictDays.length > 0) {
    return { conflictDays, status: "conflict" };
  }

  return {
    court: {
      ...court,
      availability: {
        ...court.availability,
        ...Object.fromEntries(
          orderedDays.map((day) => [
            day,
            buildNextRanges(court, day, replacing, addedRange),
          ])
        ),
      },
    },
    status: "ok",
  };
}

export function buildCourtTimeOptions(): Array<{
  label: string;
  value: string;
}> {
  return Array.from({ length: 49 }, (_, index) => {
    const totalMinutes = index * 30;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");

    return {
      label: `${hours}:${minutes}`,
      value: String(totalMinutes),
    };
  });
}
