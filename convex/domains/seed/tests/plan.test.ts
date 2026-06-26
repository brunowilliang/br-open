import { describe, expect, it } from "bun:test";

import {
  buildTargetLeagueChallengePlans,
  buildTargetLeagueMemberships,
  getNextTargetLeagueRankingPosition,
  shouldSeedScenarioLeagues,
} from "../plan";

const userIds = Array.from({ length: 20 }, (_, index) => `user-${index + 1}`);
const activeMemberships = Array.from({ length: 14 }, (_, index) => ({
  id: `membership-${index + 1}`,
  rankingPosition: index + 1,
}));

describe("seed plan", () => {
  it("does not create standalone seed leagues by default", () => {
    expect(shouldSeedScenarioLeagues({})).toBe(false);
    expect(shouldSeedScenarioLeagues({ targetLeagueId: "league-1" })).toBe(
      false
    );
  });

  it("keeps standalone seed leagues available when explicitly requested", () => {
    expect(shouldSeedScenarioLeagues({ createScenarioLeagues: true })).toBe(
      true
    );
  });

  it("starts target league ranking after the highest existing position", () => {
    expect(
      getNextTargetLeagueRankingPosition([
        { rankingPosition: 1 },
        { rankingPosition: 3 },
        { rankingPosition: null },
      ])
    ).toBe(4);
  });

  it("builds target league memberships without duplicated ranking positions", () => {
    const memberships = buildTargetLeagueMemberships({
      startingPosition: 4,
      userIds,
    });
    const activePositions = memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.rankingPosition);

    expect(activePositions).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
    expect(
      new Set(activePositions.filter((position) => position !== null)).size
    ).toBe(activePositions.length);
  });

  it("builds target league challenges from active ranking memberships", () => {
    const challengePlans = buildTargetLeagueChallengePlans({
      activeMemberships,
    });
    const statuses = challengePlans.map((plan) => plan.status);

    // Os cenários originais (de fluxo de desafio) continuam presentes.
    const expectedStatuses = [
      "pending_opponent_response",
      "confirmed",
      "pending_result_submission",
      "pending_result_confirmation",
      "pending_admin_result_validation",
      "pending_admin_decision",
      "finished",
    ] as const;
    for (const expectedStatus of expectedStatuses) {
      expect(statuses).toContain(expectedStatus);
    }

    // Os cenários de agenda adicionam muitos desafios confirmados.
    expect(statuses.filter((status) => status === "confirmed").length).toBe(
      15
    );

    // O desafiante sempre desafia alguém com posição melhor (menor índice).
    expect(
      challengePlans.every(
        (plan) =>
          plan.challenger.rankingPosition > plan.challenged.rankingPosition
      )
    ).toBe(true);
    expect(
      new Set(
        challengePlans
          .filter((plan) => plan.status !== "finished")
          .flatMap((plan) => [plan.challenger.id, plan.challenged.id])
      ).size
    ).toBe(14);
  });

  it("skips target league challenges until enough ranking memberships exist", () => {
    expect(
      buildTargetLeagueChallengePlans({
        activeMemberships: activeMemberships.slice(0, 8),
      })
    ).toEqual([]);
  });
});
