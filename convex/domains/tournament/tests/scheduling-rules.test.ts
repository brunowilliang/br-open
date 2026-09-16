import { describe, expect, it } from "bun:test";

import { resolveMatchOccupiedEndMinute } from "../../league/challenge-scheduling-rules";
import type { LeagueMatchConfig } from "../../league/contract";
import {
  findCourtSlotConflict,
  isScheduledTournamentMatch,
  type TournamentScheduledMatch,
} from "../scheduling-rules";

const matchConfig = { defaultDurationMinutes: 90 } as LeagueMatchConfig;

const scheduled: TournamentScheduledMatch[] = [
  {
    courtId: "court-1",
    id: "match-1",
    matchDate: "2026-09-20",
    startMinute: 540,
  },
  {
    courtId: "court-2",
    id: "match-2",
    matchDate: "2026-09-20",
    startMinute: 540,
  },
  {
    courtId: "court-1",
    id: "match-3",
    matchDate: "2026-09-21",
    startMinute: 540,
  },
  {
    courtId: "court-1",
    id: "match-4",
    matchDate: "2026-09-20",
    startMinute: null,
  },
];

describe("tournament scheduling rules", () => {
  it("derives the occupied end from the default duration", () => {
    expect(
      resolveMatchOccupiedEndMinute({ matchConfig, startMinute: 540 })
    ).toBe(630);
  });

  it("flags an overlapping booking on the same court and date", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 690,
      ignoredMatchId: "new-match",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 600,
    });
    expect(conflict?.id).toBe("match-1");
  });

  it("derives occupancy from the rule even when the stored end is understated", () => {
    // match-1 occupies [540, 630) by rule. A client sending [570, 590) would
    // not overlap a 20-minute window, but the rule-derived window does.
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 590,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 570,
    });
    expect(conflict?.id).toBe("match-1");
  });

  it("allows back-to-back bookings (half-open windows)", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 720,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 630,
    });
    expect(conflict).toBeNull();
  });

  it("ignores other courts, other dates and unscheduled matches", () => {
    const otherCourt = findCourtSlotConflict({
      courtId: "court-9",
      endMinute: 690,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(otherCourt).toBeNull();

    const otherDay = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 690,
      matchConfig,
      matchDate: "2026-09-22",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(otherDay).toBeNull();

    const unscheduled = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 630,
      ignoredMatchId: "match-1",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(unscheduled).toBeNull();
  });

  it("skips the match being rescheduled", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 630,
      ignoredMatchId: "match-1",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(conflict).toBeNull();
  });
});

describe("absent scheduling keys (BUG-0030)", () => {
  it("treats matches with absent keys as unscheduled", () => {
    expect(
      isScheduledTournamentMatch({
        courtId: undefined,
        id: "match-x",
        matchDate: undefined,
        startMinute: undefined,
      })
    ).toBe(false);
    expect(
      isScheduledTournamentMatch({
        courtId: "court-1",
        id: "match-y",
        matchDate: "2026-09-20",
        startMinute: 540,
      })
    ).toBe(true);
  });
});
