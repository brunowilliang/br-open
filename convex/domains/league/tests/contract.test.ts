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
  maxChallengeDistance: { enabled: true, value: 4 },
  maxActiveChallengesPerPlayer: { enabled: true, value: 1 },
  maxChallengesPerMonth: { enabled: true, value: 4 },
  responseDeadlineHours: { enabled: true, value: 48 },
  challengeValidationMode: "automatic",
  resultValidationMode: "automatic",
  scheduleVisibility: "public",
  winBehavior: "take_opponent_position",
  lossBehavior: "stay_put",
  walkoverBehavior: "automatic_loss",
  newPlayerPlacement: "end_of_ranking",
  matchConfig: {
    bestOfSets: 3,
    gamesPerSet: 6,
    defaultDurationMinutes: 90,
    scoringMode: "advantage",
    setMustWinByTwoGames: true,
    hasTieBreak: true,
    tieBreakAtGamesAll: 6,
    tieBreakPoints: 7,
    tieBreakMustWinByTwo: true,
    finalSetMode: "same_as_previous",
    finalSetGamesPerSet: 6,
    finalSetScoringMode: "advantage",
    finalSetMustWinByTwoGames: true,
    finalSetHasTieBreak: true,
    finalSetTieBreakAtGamesAll: 6,
    finalSetTieBreakPoints: 7,
    finalSetTieBreakMustWinByTwo: true,
    finalSetSuperTieBreakPoints: 10,
    finalSetSuperTieBreakMustWinByTwo: true,
  },
  hasInactivityPenalty: false,
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
