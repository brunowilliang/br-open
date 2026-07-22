import { describe, expect, it } from "bun:test";

import {
  AdminManageLeagueChallengeSchema,
  ChallengeRuleConfigSchema,
  LeagueScoringModeOptions,
} from "../contract";

describe("league contract", () => {
  it("allows admin challenge actions without requiring a reason", () => {
    const result = AdminManageLeagueChallengeSchema.safeParse({
      action: "cancel",
      challengeId: "challenge-1",
    });

    expect(result.success).toBe(true);
  });
});

const validRuleConfig = {
  challengeValidationMode: "automatic",
  hasInactivityPenalty: false,
  lossBehavior: "stay_put",
  matchConfig: {
    bestOfSets: 3,
    defaultDurationMinutes: 90,
    finalSetGamesPerSet: 6,
    finalSetHasTieBreak: true,
    finalSetMode: "same_as_previous",
    finalSetMustWinByTwoGames: true,
    finalSetScoringMode: "advantage",
    finalSetSuperTieBreakMustWinByTwo: true,
    finalSetSuperTieBreakPoints: 10,
    finalSetTieBreakAtGamesAll: 6,
    finalSetTieBreakMustWinByTwo: true,
    finalSetTieBreakPoints: 7,
    gamesPerSet: 6,
    hasTieBreak: true,
    scoringMode: "advantage",
    setMustWinByTwoGames: true,
    tieBreakAtGamesAll: 6,
    tieBreakMustWinByTwo: true,
    tieBreakPoints: 7,
  },
  maxActiveChallengesPerPlayer: { enabled: true, value: 1 },
  maxChallengeDistance: { enabled: true, value: 4 },
  maxChallengesPerMonth: { enabled: true, value: 4 },
  newPlayerPlacement: "end_of_ranking",
  responseDeadlineHours: { enabled: true, value: 48 },
  resultValidationMode: "automatic",
  scheduleVisibility: "public",
  walkoverBehavior: "automatic_loss",
  winBehavior: "take_opponent_position",
};

describe("ChallengeRuleConfigSchema", () => {
  it("accepts a valid rule config with toggleable rules", () => {
    const result = ChallengeRuleConfigSchema.safeParse(validRuleConfig);
    expect(result.success).toBe(true);
  });

  it("keeps validating the value when a toggleable rule is disabled", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      maxChallengeDistance: { enabled: false, value: 4 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a toggleable rule missing the value", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      maxChallengeDistance: { enabled: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a required enum that is missing", () => {
    const { winBehavior: _omit, ...rest } = validRuleConfig;
    const result = ChallengeRuleConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when scheduleVisibility is missing (required enum)", () => {
    const { scheduleVisibility: _omit, ...rest } = validRuleConfig;
    const result = ChallengeRuleConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts members_only for scheduleVisibility", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      scheduleVisibility: "members_only",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid scheduleVisibility value", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      scheduleVisibility: "secret",
    });
    expect(result.success).toBe(false);
  });
});

describe("LeagueScoringModeOptions", () => {
  it("uses no_advantage instead of no_ad", () => {
    expect(LeagueScoringModeOptions).toContain("no_advantage");
    expect(LeagueScoringModeOptions).not.toContain("no_ad");
  });
});
