import { describe, expect, it } from "bun:test";

import { resolveChallengeCreationRuleError } from "../challenge-rules";

const baseInput = {
  challengedActiveChallengeCount: 0,
  challengedMembershipId: "membership-2",
  challengedPosition: 2,
  challengerActiveChallengeCount: 0,
  challengerCreatedThisMonthCount: 0,
  challengerMembershipId: "membership-4",
  challengerPosition: 4,
  maxActiveChallengesPerPlayer: 1,
  maxChallengeDistance: 4,
  maxChallengesPerMonth: 4,
};

describe("challenge creation rules", () => {
  it("allows a lower ranked player to challenge within the allowed distance", () => {
    expect(resolveChallengeCreationRuleError(baseInput)).toBeNull();
  });

  it("blocks a player from challenging themselves", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengedMembershipId: "membership-4",
      })
    ).toBe("Você não pode desafiar a si mesmo.");
  });

  it("blocks challenges when ranking positions are incomplete", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerPosition: null,
      })
    ).toBe("O ranking da liga está incompleto para abrir esse desafio.");
  });

  it("blocks challenges against players below the challenger", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengedPosition: 5,
      })
    ).toBe("Você só pode desafiar jogadores acima da sua posição.");
  });

  it("blocks challenges beyond the max ranking distance", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        maxChallengeDistance: 1,
      })
    ).toBe("Esse desafio ultrapassa a distância máxima permitida.");
  });

  it("blocks challenges when either player reached the active limit", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerActiveChallengeCount: 1,
      })
    ).toBe("Você já atingiu o limite de desafios ativos.");

    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengedActiveChallengeCount: 1,
      })
    ).toBe("O adversário já atingiu o limite de desafios ativos.");
  });

  it("blocks challenges when the challenger reached the monthly limit", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerCreatedThisMonthCount: 4,
      })
    ).toBe("Você já atingiu o limite mensal de desafios.");
  });

  it("allows any distance when maxChallengeDistance is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengedPosition: 1,
        challengerPosition: 500,
        maxChallengeDistance: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });

  it("allows any active challenge count when maxActiveChallengesPerPlayer is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerActiveChallengeCount: 99,
        challengedActiveChallengeCount: 99,
        maxActiveChallengesPerPlayer: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });

  it("allows any monthly count when maxChallengesPerMonth is Infinity", () => {
    expect(
      resolveChallengeCreationRuleError({
        ...baseInput,
        challengerCreatedThisMonthCount: 99,
        maxChallengesPerMonth: Number.POSITIVE_INFINITY,
      })
    ).toBeNull();
  });
});
