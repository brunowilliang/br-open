import { describe, expect, it } from "bun:test";

import { buildOrganizerMonthlyMatchesSeries } from "./organizer-overview-derived";

function makeFinishedChallenge(finishedAt: number) {
  return {
    challenged: { membershipId: "m-2", playerProfileId: "p-2" },
    challenger: { membershipId: "m-1", playerProfileId: "p-1" },
    finishedAt,
    status: "finished",
  } as never;
}

describe("buildOrganizerMonthlyMatchesSeries", () => {
  it("builds six chronological months, filling quiet months with zero", () => {
    // Datas construídas no fuso LOCAL (mesma semântica de getMonthStartMs).
    const now = new Date(2026, 5, 15, 12).getTime();
    const challenges = [
      makeFinishedChallenge(new Date(2026, 5, 3).getTime()),
      makeFinishedChallenge(new Date(2026, 5, 10).getTime()),
      makeFinishedChallenge(new Date(2026, 4, 20).getTime()), // mês anterior
    ];

    const series = buildOrganizerMonthlyMatchesSeries({
      challenges,
      now,
    });

    expect(series).toHaveLength(6);
    expect(series[5]).toEqual({ matches: 2, month: "jun." });
    expect(series[4]).toEqual({ matches: 1, month: "mai." });
    expect(series[0]).toEqual({ matches: 0, month: "jan." });
  });

  it("keeps challenges finished before the window out of the series", () => {
    const now = new Date(2026, 5, 15, 12).getTime();
    const challenges = [
      makeFinishedChallenge(new Date(2025, 11, 10).getTime()),
    ];

    const series = buildOrganizerMonthlyMatchesSeries({
      challenges,
      now,
    });

    expect(series.reduce((total, point) => total + point.matches, 0)).toBe(0);
  });
});
