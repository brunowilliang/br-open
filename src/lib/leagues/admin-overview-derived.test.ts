import { describe, expect, it } from "bun:test";

import {
  buildAdminActivityRateCard,
  buildAdminJoinRequestsAlert,
  buildAdminMonthlyMatchesCard,
  buildAdminOngoingChallengesCard,
  buildAdminOccupationCard,
  buildAdminValidationsAlert,
  summarizeAdminPendingActions,
  type ChallengeStatus,
} from "./admin-overview-derived";

function makeChallenge(status: ChallengeStatus) {
  return {
    status,
    challenger: { membershipId: "m-1", playerProfileId: "p-1" },
    challenged: { membershipId: "m-2", playerProfileId: "p-2" },
  } as never;
}

describe("buildAdminJoinRequestsAlert", () => {
  it("returns null when there are no pending requests", () => {
    expect(buildAdminJoinRequestsAlert({ pendingRequestsCount: 0 })).toBeNull();
  });

  it("returns the count when there are pending requests", () => {
    expect(buildAdminJoinRequestsAlert({ pendingRequestsCount: 3 })).toEqual({
      total: 3,
    });
  });
});

describe("buildAdminValidationsAlert", () => {
  it("returns null when no challenges need admin attention", () => {
    expect(
      buildAdminValidationsAlert({
        challenges: [makeChallenge("confirmed"), makeChallenge("finished")],
      })
    ).toBeNull();
  });

  it("groups admin-attention statuses into actions", () => {
    const result = buildAdminValidationsAlert({
      challenges: [
        makeChallenge("pending_admin_challenge_validation"),
        makeChallenge("pending_admin_challenge_validation"),
        makeChallenge("pending_admin_result_validation"),
        makeChallenge("pending_admin_decision"),
        makeChallenge("pending_result_correction"),
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.total).toBe(5);
    expect(result?.actions).toHaveLength(5);
  });
});

describe("summarizeAdminPendingActions", () => {
  it("returns empty string for no actions", () => {
    expect(summarizeAdminPendingActions([])).toBe("");
  });

  it("summarizes each kind with pt-BR pluralization, joined by ' · '", () => {
    const summary = summarizeAdminPendingActions([
      { kind: "challenge_validation" },
      { kind: "challenge_validation" },
      { kind: "result_approval" },
      { kind: "decision" },
      { kind: "result_correction" },
    ]);

    expect(summary).toBe(
      "2 desafios para validar · 1 resultado para aprovar · 1 disputa para decidir · 1 placar para corrigir"
    );
  });

  it("uses singular form for a single item", () => {
    const summary = summarizeAdminPendingActions([
      { kind: "challenge_validation" },
    ]);

    expect(summary).toBe("1 desafio para validar");
  });
});

const NOW = new Date("2026-06-15T12:00:00Z").getTime();
const MONTH_START = new Date("2026-06-15T12:00:00Z");
MONTH_START.setDate(1);
MONTH_START.setHours(0, 0, 0, 0);
const MONTH_START_MS = MONTH_START.getTime();

function makeFinishedChallenge(
  finishedAt: number,
  challengerMembershipId = "m-1",
  challengedMembershipId = "m-2"
) {
  return {
    status: "finished",
    finishedAt,
    challenger: {
      membershipId: challengerMembershipId,
      playerProfileId: "p-1",
    },
    challenged: {
      membershipId: challengedMembershipId,
      playerProfileId: "p-2",
    },
  } as never;
}

describe("buildAdminOccupationCard", () => {
  it("shows remaining slots when maxPlayers is set", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 12, maxPlayers: 20 })
    ).toEqual({ activeCount: 12, label: "8 vagas restantes" });
  });

  it("shows 'Liga lotada' when activeCount reaches maxPlayers", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 20, maxPlayers: 20 })
    ).toEqual({ activeCount: 20, label: "Liga lotada" });
  });

  it("shows 'Liga lotada' when activeCount exceeds maxPlayers", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 21, maxPlayers: 20 })
    ).toEqual({ activeCount: 21, label: "Liga lotada" });
  });

  it("shows 'vagas ilimitadas' when maxPlayers is null", () => {
    expect(
      buildAdminOccupationCard({ activeCount: 5, maxPlayers: null })
    ).toEqual({ activeCount: 5, label: "vagas ilimitadas" });
  });
});

describe("buildAdminMonthlyMatchesCard", () => {
  it("counts only finished challenges within the current month", () => {
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000),
      makeFinishedChallenge(MONTH_START_MS + 2000),
      makeFinishedChallenge(MONTH_START_MS - 1000), // mês anterior
    ];

    expect(buildAdminMonthlyMatchesCard({ challenges, now: NOW })).toEqual({
      finishedCount: 2,
    });
  });

  it("returns zero when nothing finished this month", () => {
    const challenges = [makeFinishedChallenge(MONTH_START_MS - 1000)];

    expect(buildAdminMonthlyMatchesCard({ challenges, now: NOW })).toEqual({
      finishedCount: 0,
    });
  });
});

describe("buildAdminOngoingChallengesCard", () => {
  it("counts only ongoing statuses", () => {
    const challenges = [
      { status: "confirmed" } as never,
      { status: "pending_result_confirmation" } as never,
      { status: "finished" } as never, // não conta
      { status: "pending_admin_decision" } as never, // não conta (vai pro alerta)
    ];

    expect(buildAdminOngoingChallengesCard({ challenges })).toEqual({
      ongoingCount: 2,
    });
  });
});

describe("buildAdminActivityRateCard", () => {
  const ranking = [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }] as never;

  it("returns rate 0 with no division by zero when ranking is empty", () => {
    expect(
      buildAdminActivityRateCard({ challenges: [], now: NOW, ranking: [] })
    ).toEqual({ activeCount: 0, rate: 0 });
  });

  it("computes the fraction of active members who played this month", () => {
    // m-1 e m-2 jogaram este mês; m-3 não. → 2/3.
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-2"),
    ];

    const result = buildAdminActivityRateCard({
      challenges,
      now: NOW,
      ranking,
    });

    expect(result).toEqual({
      activeCount: 3,
      rate: expect.closeTo(2 / 3, 5),
    });
  });

  it("ignores players not in the active ranking", () => {
    // A partida envolve m-1 e m-4, mas m-4 não está no ranking. → 1/3.
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-4"),
    ];

    const result = buildAdminActivityRateCard({
      challenges,
      now: NOW,
      ranking,
    });

    expect(result).toEqual({
      activeCount: 3,
      rate: expect.closeTo(1 / 3, 5),
    });
  });

  it("caps at 1.0 when all active members played", () => {
    const challenges = [
      makeFinishedChallenge(MONTH_START_MS + 1000, "m-1", "m-2"),
      makeFinishedChallenge(MONTH_START_MS + 2000, "m-1", "m-3"),
    ];

    expect(
      buildAdminActivityRateCard({ challenges, now: NOW, ranking })
    ).toEqual({ activeCount: 3, rate: 1 });
  });
});
