import { describe, expect, it } from "bun:test";

import {
  AdminManageLeagueChallengeSchema,
  ChallengeRuleConfigSchema,
  LeagueMatchConfigSchema,
  LeagueScoringModeOptions,
  leagueChallengeScoreSchema,
  leagueScheduleItemSchema,
  resolveLeagueScheduleOutcome,
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
    gamesPerSet: 6,
    hasTieBreak: true,
    scoringMode: "advantage",
    setMustWinByTwoGames: true,
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

describe("LeagueMatchConfigSchema", () => {
  it("aceita melhor de 1, 3 e 5 sets", () => {
    for (const bestOfSets of [1, 3, 5]) {
      const result = LeagueMatchConfigSchema.safeParse({
        ...validRuleConfig.matchConfig,
        bestOfSets,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejeita melhor de 2 e 4 (sem cair no default)", () => {
    for (const bestOfSets of [2, 4]) {
      const result = LeagueMatchConfigSchema.safeParse({
        ...validRuleConfig.matchConfig,
        bestOfSets,
      });

      expect(result.success).toBe(false);
    }
  });

  it("aponta o erro para bestOfSets com a mensagem do produto", () => {
    const result = LeagueMatchConfigSchema.safeParse({
      ...validRuleConfig.matchConfig,
      bestOfSets: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["bestOfSets"]);
      expect(result.error.issues[0]?.message).toBe(
        "Escolha melhor de 1, 3 ou 5 sets."
      );
    }
  });
});

describe("LeagueMatchConfigSchema tie-break points", () => {
  it("aceita 7 e 10 pontos no tie-break", () => {
    for (const points of [7, 10]) {
      const result = LeagueMatchConfigSchema.safeParse({
        ...validRuleConfig.matchConfig,
        tieBreakPoints: points,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejeita 2 e 5 pontos com a mensagem de produto", () => {
    for (const points of [2, 5]) {
      const result = LeagueMatchConfigSchema.safeParse({
        ...validRuleConfig.matchConfig,
        tieBreakPoints: points,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (item) => item.path[0] === "tieBreakPoints"
        );
        expect(issue?.message).toBe("Escolha 7 ou 10 pontos no tie-break.");
      }
    }
  });
});

describe("LeagueMatchConfigSchema legado (R11)", () => {
  it("stripa a chave tieBreakAtGamesAll de docs antigos sem erro", () => {
    const result = LeagueMatchConfigSchema.safeParse({
      ...validRuleConfig.matchConfig,
      finalSetTieBreakAtGamesAll: 6,
      tieBreakAtGamesAll: 6,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("tieBreakAtGamesAll");
      expect(result.data).not.toHaveProperty("finalSetTieBreakAtGamesAll");
    }
  });

  it("ChallengeRuleConfigSchema não dispara o .catch com matchConfig legado", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      matchConfig: {
        ...validRuleConfig.matchConfig,
        tieBreakAtGamesAll: 6,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matchConfig.bestOfSets).toBe(3);
      expect(result.data.matchConfig).not.toHaveProperty("tieBreakAtGamesAll");
    }
  });
});

describe("LeagueMatchConfigSchema legado (DEC-0004)", () => {
  it("stripa as chaves finalSet* de configs antigos sem erro", () => {
    const result = LeagueMatchConfigSchema.safeParse({
      ...validRuleConfig.matchConfig,
      finalSetGamesPerSet: 4,
      finalSetHasTieBreak: false,
      finalSetMode: "super_tiebreak",
      finalSetSuperTieBreakPoints: 10,
      finalSetTieBreakPoints: 7,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("finalSetMode");
      expect(result.data).not.toHaveProperty("finalSetTieBreakPoints");
    }
  });

  it("ChallengeRuleConfigSchema nao dispara o .catch com matchConfig legado finalSet*", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      matchConfig: {
        ...validRuleConfig.matchConfig,
        finalSetMode: "super_tiebreak",
        finalSetTieBreakPoints: 7,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matchConfig).not.toHaveProperty("finalSetMode");
    }
  });
});

const scheduleItemFixture = {
  challenged: { avatarUrl: null, fullName: "Ana" },
  challenger: { avatarUrl: null, fullName: "Bia" },
  courtName: "Quadra 1",
  id: "challenge-1",
  matchDate: "2026-09-24",
  matchStatus: "scheduled",
  scoreSets: null,
  startMinute: 480,
};

describe("resolveLeagueScheduleOutcome", () => {
  it("deixa o desafio confirmado como Agendado e sem placar", () => {
    expect(
      resolveLeagueScheduleOutcome({ score: null, status: "confirmed" })
    ).toEqual({ matchStatus: "scheduled", scoreSets: null });
  });

  it("leva o resultado liquidado para o vocabulário A/B do card", () => {
    const score = leagueChallengeScoreSchema.parse({
      sets: [
        { challengedGames: 4, challengerGames: 6, kind: "set" },
        {
          challengedGames: 6,
          challengerGames: 7,
          kind: "set",
          tieBreak: { challengedPoints: 3, challengerPoints: 7 },
        },
      ],
    });

    expect(resolveLeagueScheduleOutcome({ score, status: "finished" })).toEqual(
      {
        matchStatus: "finished",
        scoreSets: [
          { aGames: 6, bGames: 4, kind: "set", tieBreak: null },
          {
            aGames: 7,
            bGames: 6,
            kind: "set",
            tieBreak: { aPoints: 7, bPoints: 3 },
          },
        ],
      }
    );
  });

  it("marca W.O. e mantém o set zerado do resultado", () => {
    const score = leagueChallengeScoreSchema.parse({
      sets: [{ challengedGames: 0, challengerGames: 0, kind: "set" }],
      walkover: true,
      winnerMembershipId: "membership-1",
    });

    expect(resolveLeagueScheduleOutcome({ score, status: "finished" })).toEqual(
      {
        matchStatus: "walkover",
        scoreSets: [{ aGames: 0, bGames: 0, kind: "set", tieBreak: null }],
      }
    );
  });

  it("não publica placar enquanto o resultado não está liquidado", () => {
    const score = leagueChallengeScoreSchema.parse({
      sets: [{ challengedGames: 4, challengerGames: 6, kind: "set" }],
    });

    expect(
      resolveLeagueScheduleOutcome({
        score,
        status: "pending_result_confirmation",
      })
    ).toEqual({ matchStatus: "pending", scoreSets: null });
  });
});

describe("leagueScheduleItemSchema", () => {
  it("recusa o status cru do domínio no item da agenda", () => {
    const result = leagueScheduleItemSchema.safeParse({
      ...scheduleItemFixture,
      matchStatus: "confirmed",
    });

    expect(result.success).toBe(false);
  });

  it("aceita o item com o status do card", () => {
    const result = leagueScheduleItemSchema.safeParse(scheduleItemFixture);

    expect(result.success).toBe(true);
  });
});
