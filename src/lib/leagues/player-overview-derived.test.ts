import { describe, expect, it } from "bun:test";

import {
  buildPlayerMonthlyWinLoss,
  buildPlayerPositionCard,
  buildPlayerWinRate,
} from "./player-overview-derived";

const NOW = new Date(2026, 8, 19, 12).getTime(); // 19/09/2026 local

function makeFinishedChallenge(input: {
  challengedMembershipId?: string;
  challengerMembershipId?: string;
  finishedAt: number;
  status?: string;
  winnerMembershipId?: string;
}) {
  return {
    challenged: {
      membershipId: input.challengedMembershipId ?? "m-2",
      playerProfileId: "p-2",
    },
    challenger: {
      membershipId: input.challengerMembershipId ?? "m-1",
      playerProfileId: "p-1",
    },
    finishedAt: input.finishedAt,
    latestResultSubmission: {
      score: { sets: [], walkover: false },
      winnerMembershipId: input.winnerMembershipId,
    },
    status: input.status ?? "finished",
  } as never;
}

describe("buildPlayerMonthlyWinLoss", () => {
  it("returns empty series without a viewer membership", () => {
    expect(
      buildPlayerMonthlyWinLoss({
        challenges: [],
        now: NOW,
        viewerMembershipId: null,
      })
    ).toEqual([]);
  });

  it("fills the last six months and splits wins and losses", () => {
    const challenges = [
      // Corrente (setembro): 2 vitórias, 1 derrota do viewer (m-1).
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 2).getTime(),
        winnerMembershipId: "m-1",
      }),
      makeFinishedChallenge({
        challengedMembershipId: "m-1",
        challengerMembershipId: "m-3",
        finishedAt: new Date(2026, 8, 5).getTime(),
        winnerMembershipId: "m-1",
      }),
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 10).getTime(),
        winnerMembershipId: "m-2",
      }),
      // Agosto: 1 derrota.
      makeFinishedChallenge({
        finishedAt: new Date(2026, 7, 8).getTime(),
        winnerMembershipId: "m-2",
      }),
      // Fevereiro (fora da janela de 6 meses): não conta.
      makeFinishedChallenge({
        finishedAt: new Date(2026, 1, 8).getTime(),
        winnerMembershipId: "m-1",
      }),
    ];

    const series = buildPlayerMonthlyWinLoss({
      challenges,
      now: NOW,
      viewerMembershipId: "m-1",
    });

    expect(series).toHaveLength(6);
    expect(series[5]).toEqual({ losses: 1, month: "set.", wins: 2 });
    expect(series[4]).toEqual({ losses: 1, month: "ago.", wins: 0 });
    expect(series[0]).toEqual({ losses: 0, month: "abr.", wins: 0 });
  });

  it("ignores challenges of other players and unfinished ones", () => {
    const challenges = [
      makeFinishedChallenge({
        challengedMembershipId: "m-8",
        challengerMembershipId: "m-7",
        finishedAt: new Date(2026, 8, 2).getTime(),
        winnerMembershipId: "m-7",
      }),
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 2).getTime(),
        status: "pending_result_confirmation",
        winnerMembershipId: "m-1",
      }),
    ];

    const series = buildPlayerMonthlyWinLoss({
      challenges,
      now: NOW,
      viewerMembershipId: "m-1",
    });

    expect(series[5]).toEqual({ losses: 0, month: "set.", wins: 0 });
  });
});

describe("buildPlayerWinRate", () => {
  it("counts all finished challenges of the viewer, all time", () => {
    const challenges = [
      makeFinishedChallenge({
        finishedAt: new Date(2026, 0, 2).getTime(),
        winnerMembershipId: "m-1",
      }),
      makeFinishedChallenge({
        finishedAt: new Date(2026, 7, 8).getTime(),
        winnerMembershipId: "m-2",
      }),
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 10).getTime(),
        winnerMembershipId: "m-1",
      }),
    ];

    expect(
      buildPlayerWinRate({ challenges, viewerMembershipId: "m-1" })
    ).toEqual({ losses: 1, rate: 2 / 3, total: 3, wins: 2 });
  });

  it("returns zeroed totals with no viewer or no matches", () => {
    expect(
      buildPlayerWinRate({ challenges: [], viewerMembershipId: null })
    ).toEqual({ losses: 0, rate: 0, total: 0, wins: 0 });

    expect(
      buildPlayerWinRate({ challenges: [], viewerMembershipId: "m-1" })
    ).toEqual({ losses: 0, rate: 0, total: 0, wins: 0 });
  });

  it("rates 1 with wins only", () => {
    const challenges = [
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 2).getTime(),
        winnerMembershipId: "m-1",
      }),
      makeFinishedChallenge({
        challengedMembershipId: "m-1",
        challengerMembershipId: "m-3",
        finishedAt: new Date(2026, 8, 9).getTime(),
        winnerMembershipId: "m-1",
      }),
    ];

    expect(
      buildPlayerWinRate({ challenges, viewerMembershipId: "m-1" })
    ).toEqual({ losses: 0, rate: 1, total: 2, wins: 2 });
  });

  it("rates 0 with losses only", () => {
    const challenges = [
      makeFinishedChallenge({
        finishedAt: new Date(2026, 8, 2).getTime(),
        winnerMembershipId: "m-2",
      }),
    ];

    expect(
      buildPlayerWinRate({ challenges, viewerMembershipId: "m-1" })
    ).toEqual({ losses: 1, rate: 0, total: 1, wins: 0 });
  });
});

describe("buildPlayerPositionCard", () => {
  it("treats undefined as no position (KPI must not render #undefined)", () => {
    expect(
      buildPlayerPositionCard({
        rankingItemsCount: 0,
        viewerPosition: undefined,
      })
    ).toBeNull();
  });

  it("treats null as no position", () => {
    expect(
      buildPlayerPositionCard({ rankingItemsCount: 0, viewerPosition: null })
    ).toBeNull();
  });

  it("carries position and total when the viewer is ranked", () => {
    expect(
      buildPlayerPositionCard({ rankingItemsCount: 3, viewerPosition: 1 })
    ).toEqual({ position: 1, totalPlayers: 3 });
  });
});
