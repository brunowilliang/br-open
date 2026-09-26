import { describe, expect, it } from "bun:test";

import {
  brazilDayKey,
  bucketResultsByMonth,
  classifyResultOutcome,
  countActiveEntriesByCategory,
  findMostFrequentPartner,
  resolveCategoryTotalRounds,
  selectUpcomingMatches,
  type DashResult,
} from "../dashboard-rules";

const result = (overrides: Partial<DashResult>): DashResult => ({
  at: Date.UTC(2026, 8, 10, 12),
  competitionId: "tournament-1",
  competitionName: "Torneio Teste",
  outcome: "win",
  ...overrides,
});

describe("brazilDayKey", () => {
  it("flips the day at the Brazilian midnight", () => {
    // 02:59 UTC = 23:59 BRT do dia anterior.
    expect(brazilDayKey(Date.UTC(2026, 8, 19, 2, 59))).toBe("2026-09-18");
    expect(brazilDayKey(Date.UTC(2026, 8, 19, 3, 0))).toBe("2026-09-19");
  });
});

describe("classifyResultOutcome", () => {
  it("returns null while there is no winner", () => {
    expect(
      classifyResultOutcome({ subjectId: "m1", winnerId: null })
    ).toBeNull();
    expect(
      classifyResultOutcome({ subjectId: "m1", winnerId: undefined })
    ).toBeNull();
  });

  it("compares the subject side against the winner", () => {
    expect(classifyResultOutcome({ subjectId: "m1", winnerId: "m1" })).toBe(
      "win"
    );
    expect(classifyResultOutcome({ subjectId: "m1", winnerId: "m2" })).toBe(
      "loss"
    );
  });
});

describe("bucketResultsByMonth", () => {
  it("counts wins and losses per month and drops results outside the window", () => {
    const byMonth = bucketResultsByMonth({
      monthKeys: ["2026-07", "2026-08", "2026-09"],
      results: [
        result({ at: Date.UTC(2026, 8, 2), outcome: "win" }),
        result({
          at: Date.UTC(2026, 8, 9),
          outcome: "win",
        }),
        result({ at: Date.UTC(2026, 8, 15), outcome: "loss" }),
        result({ at: Date.UTC(2026, 7, 20), outcome: "win" }),
        result({ at: Date.UTC(2026, 6, 5), outcome: "loss" }),
        result({ at: Date.UTC(2026, 5, 5), outcome: "win" }),
      ],
    });

    expect(byMonth).toEqual([
      { losses: 1, month: "2026-07", wins: 0 },
      { losses: 0, month: "2026-08", wins: 1 },
      { losses: 1, month: "2026-09", wins: 2 },
    ]);
  });
});

describe("findMostFrequentPartner", () => {
  it("counts both sides and breaks ties by the most recent entry", () => {
    const partner = findMostFrequentPartner({
      entries: [
        {
          createdAtMs: Date.UTC(2026, 0, 1),
          playerAId: "m1",
          playerBId: "p2",
          status: "active",
        },
        {
          createdAtMs: Date.UTC(2026, 1, 1),
          playerAId: "m1",
          playerBId: "p2",
          status: "active",
        },
        {
          createdAtMs: Date.UTC(2026, 2, 1),
          playerAId: "p3",
          playerBId: "m1",
          status: "active",
        },
        {
          createdAtMs: Date.UTC(2026, 3, 1),
          playerAId: "m1",
          playerBId: "p3",
          status: "active",
        },
      ],
      playerProfileId: "m1",
    });

    // p2 e p3 empatam em 2; a entrada mais recente do p3 (abr) vence a do p2 (fev).
    expect(partner).toMatchObject({ count: 2, playerProfileId: "p3" });
  });

  it("ignores cancelled entries, singles and rows without the subject", () => {
    const partner = findMostFrequentPartner({
      entries: [
        {
          createdAtMs: Date.UTC(2026, 0, 1),
          playerAId: "m1",
          playerBId: "p2",
          status: "cancelled",
        },
        {
          createdAtMs: Date.UTC(2026, 0, 2),
          playerAId: "m1",
          playerBId: null,
          status: "pending_partner",
        },
        {
          createdAtMs: Date.UTC(2026, 0, 3),
          playerAId: "p3",
          playerBId: "p4",
          status: "active",
        },
      ],
      playerProfileId: "m1",
    });

    expect(partner).toBeNull();
  });
});

describe("selectUpcomingMatches", () => {
  const candidate = (matchDate: string, startMinute = 0) => ({
    id: `${matchDate}-${startMinute}`,
    matchDate,
    startMinute,
  });

  it("keeps the nearest match when the list is over the limit", () => {
    const farMatches = Array.from({ length: 20 }, (_, index) =>
      candidate(`2026-10-${String(index + 1).padStart(2, "0")}`, 600)
    );
    const tournamentMatch = {
      id: "tournament-tomorrow",
      matchDate: "2026-09-20",
      startMinute: 900,
    };

    const selected = selectUpcomingMatches({
      limit: 20,
      matches: [...farMatches, tournamentMatch],
    });

    expect(selected).toHaveLength(20);
    expect(selected[0]).toMatchObject({ id: "tournament-tomorrow" });
  });

  it("breaks same-date ties by start minute and caps the list", () => {
    const selected = selectUpcomingMatches({
      limit: 2,
      matches: [
        candidate("2026-09-20", 900),
        candidate("2026-09-20", 480),
        candidate("2026-09-21", 600),
      ],
    });

    expect(selected.map((item) => item.startMinute)).toEqual([480, 900]);
  });
});

describe("resolveCategoryTotalRounds", () => {
  it("uses the furthest round of the category board", () => {
    expect(
      resolveCategoryTotalRounds([{ round: 1 }, { round: 3 }, { round: 2 }])
    ).toBe(3);
  });

  it("keeps 1 for a board with no match (or none drawn yet)", () => {
    expect(resolveCategoryTotalRounds([])).toBe(1);
    expect(resolveCategoryTotalRounds([{ round: 1 }])).toBe(1);
  });
});

describe("countActiveEntriesByCategory", () => {
  it("counts only active entries per category", () => {
    const counts = countActiveEntriesByCategory({
      entries: [
        { categoryId: "cat-sm", status: "active" },
        { categoryId: "cat-sm", status: "active" },
        { categoryId: "cat-sf", status: "active" },
        { categoryId: "cat-sf", status: "awaiting_payment" },
        { categoryId: "cat-dm", status: "pending_partner" },
        { categoryId: "cat-dm", status: "cancelled" },
      ],
    });

    expect([...counts.entries()]).toEqual([
      ["cat-sm", 2],
      ["cat-sf", 1],
    ]);
  });
});
