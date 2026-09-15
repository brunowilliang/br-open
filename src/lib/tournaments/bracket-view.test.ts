import { describe, expect, test } from "bun:test";

import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";
import {
  buildMatchSides,
  canSwapMatch,
  hasScheduledMatch,
} from "./bracket-view";

function buildEntryView(id: string, name: string): TournamentEntryWithPlayers {
  return {
    categoryId: "cat-1",
    createdAt: 0,
    createdByUserId: null,
    entryRound: null,
    id,
    partnerUserId: null,
    playerA: {
      avatarUrl: null,
      fullName: name,
      nickname: name,
      playerProfileId: `pp-${id}`,
      username: name.toLowerCase(),
    },
    playerAId: id,
    playerB: null,
    playerBId: null,
    seedRank: null,
    status: "active",
    updatedAt: 0,
  };
}

function buildMatch(input: {
  entryAId: null | string;
  entryBId: null | string;
  id: string;
  round: number;
  score?: null | {
    sets: Array<{
      aGames: number;
      bGames: number;
      kind: "set" | "super_tiebreak";
    }>;
    winnerEntryId: string;
  };
  slotInRound: number;
  status?: "finished" | "pending" | "scheduled" | "walkover";
}) {
  return {
    categoryId: "cat-1",
    courtId: null,
    createdAt: 0,
    endMinute: null,
    entryAId: input.entryAId,
    entryBId: input.entryBId,
    id: input.id,
    matchDate: null,
    round: input.round,
    rowVersion: 0,
    scheduledById: null,
    score: input.score ?? null,
    slotInRound: input.slotInRound,
    startMinute: null,
    status: input.status ?? ("pending" as const),
    updatedAt: 0,
    walkover: false,
    winnerEntryId: null,
  };
}

describe("buildMatchSides", () => {
  test("joins sides by entryAId/entryBId against enriched entries", () => {
    const entriesById = {
      "e-1": buildEntryView("e-1", "Ana"),
      "e-2": buildEntryView("e-2", "Bruno"),
    };
    const matches = [
      buildMatch({
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      }),
    ];

    const withSides = buildMatchSides({ entriesById, matches });

    expect(withSides[0]?.entryA?.playerA?.fullName).toBe("Ana");
    expect(withSides[0]?.entryB?.playerA?.fullName).toBe("Bruno");
  });

  test("null side (bye/tbd) stays null even without a known entry", () => {
    const withSides = buildMatchSides({
      entriesById: {},
      matches: [
        buildMatch({
          entryAId: "e-x",
          entryBId: null,
          id: "m-1",
          round: 1,
          slotInRound: 0,
        }),
      ],
    });

    expect(withSides[0]?.entryA).toBeNull();
    expect(withSides[0]?.entryB).toBeNull();
  });
});

describe("hasScheduledMatch", () => {
  const slot = {
    courtId: "court-1",
    matchDate: "2026-09-12",
    startMinute: 840,
  };

  test("any match with date, minute and court counts", () => {
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: null, startMinute: null },
        slot,
      ])
    ).toBeTrue();
  });

  test("incomplete scheduling (any field missing) does not count", () => {
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: "2026-09-12", startMinute: 840 },
      ])
    ).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: "court-1", matchDate: null, startMinute: 840 },
      ])
    ).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: "court-1", matchDate: "2026-09-12", startMinute: null },
      ])
    ).toBeFalse();
  });

  test("empty bracket (or a fully unscheduled one) stays silent", () => {
    expect(hasScheduledMatch([])).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: null, startMinute: null },
        { courtId: null, matchDate: null, startMinute: null },
      ])
    ).toBeFalse();
  });
});

describe("canSwapMatch", () => {
  test("any round without a score can swap (same-round slots)", () => {
    expect(canSwapMatch({ score: null, status: "pending" })).toBeTrue();
    expect(canSwapMatch({ score: null, status: "scheduled" })).toBeTrue();
  });

  test("finished match with a score cannot swap", () => {
    expect(
      canSwapMatch({
        score: { sets: [], winnerEntryId: "e-1" },
        status: "finished",
      })
    ).toBeFalse();
  });

  test("vacant row (pruned subtree of a head of seed) never swaps", () => {
    expect(canSwapMatch({ score: null, status: "vacant" })).toBeFalse();
  });
});
