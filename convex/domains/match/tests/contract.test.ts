import { describe, expect, it } from "bun:test";

import {
  CourtsSchema,
  MatchConfigSchema,
  MatchScoringModeOptions,
  MatchScoreSchema,
} from "../contract";

const validMatchConfig = {
  bestOfSets: 3,
  defaultDurationMinutes: 90,
  gamesPerSet: 6,
  hasTieBreak: true,
  scoringMode: "advantage",
  setMustWinByTwoGames: true,
  tieBreakMustWinByTwo: true,
  tieBreakPoints: 7,
};

describe("MatchScoringModeOptions", () => {
  it("uses no_advantage instead of no_ad", () => {
    expect(MatchScoringModeOptions).toContain("no_advantage");
    expect(MatchScoringModeOptions).not.toContain("no_ad");
  });
});

describe("MatchConfigSchema", () => {
  it("aceita melhor de 1, 3 e 5 sets", () => {
    for (const bestOfSets of [1, 3, 5]) {
      const result = MatchConfigSchema.safeParse({
        ...validMatchConfig,
        bestOfSets,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejeita melhor de 2 e 4 (sem cair no default)", () => {
    for (const bestOfSets of [2, 4]) {
      const result = MatchConfigSchema.safeParse({
        ...validMatchConfig,
        bestOfSets,
      });

      expect(result.success).toBe(false);
    }
  });

  it("aponta o erro para bestOfSets com a mensagem do produto", () => {
    const result = MatchConfigSchema.safeParse({
      ...validMatchConfig,
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

describe("MatchConfigSchema tie-break points", () => {
  it("aceita 7 e 10 pontos no tie-break", () => {
    for (const points of [7, 10]) {
      const result = MatchConfigSchema.safeParse({
        ...validMatchConfig,
        tieBreakPoints: points,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejeita 2 e 5 pontos com a mensagem de produto", () => {
    for (const points of [2, 5]) {
      const result = MatchConfigSchema.safeParse({
        ...validMatchConfig,
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

describe("MatchConfigSchema legado (R11)", () => {
  it("stripa a chave tieBreakAtGamesAll de docs antigos sem erro", () => {
    const result = MatchConfigSchema.safeParse({
      ...validMatchConfig,
      finalSetTieBreakAtGamesAll: 6,
      tieBreakAtGamesAll: 6,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("tieBreakAtGamesAll");
      expect(result.data).not.toHaveProperty("finalSetTieBreakAtGamesAll");
    }
  });
});

describe("MatchConfigSchema legado (DEC-0004)", () => {
  it("stripa as chaves finalSet* de configs antigos sem erro", () => {
    const result = MatchConfigSchema.safeParse({
      ...validMatchConfig,
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
});

const emptyAvailability = {
  fri: [],
  mon: [],
  sat: [],
  sun: [],
  thu: [],
  tue: [],
  wed: [],
};

describe("CourtsSchema", () => {
  it("aceita quadra sem faixa e com faixa na grade de 30 minutos", () => {
    const result = CourtsSchema.safeParse([
      { availability: emptyAvailability, id: "court-1", name: "Quadra 1" },
      {
        availability: {
          ...emptyAvailability,
          mon: [{ endMinute: 90, startMinute: 60 }],
        },
        id: "court-2",
        name: "Quadra 2",
      },
    ]);

    expect(result.success).toBe(true);
  });

  it("rejeita nome de quadra repetido (ignorando caixa e espaços)", () => {
    const result = CourtsSchema.safeParse([
      { availability: emptyAvailability, id: "court-1", name: "Quadra 1" },
      { availability: emptyAvailability, id: "court-2", name: " quadra 1 " },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([1, "name"]);
    }
  });

  it("rejeita faixas sobrepostas no mesmo dia e aponta o dia", () => {
    const result = CourtsSchema.safeParse([
      {
        availability: {
          ...emptyAvailability,
          mon: [
            { endMinute: 90, startMinute: 0 },
            { endMinute: 120, startMinute: 60 },
          ],
        },
        id: "court-1",
        name: "Quadra 1",
      },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([0, "availability", "mon"]);
    }
  });

  it("rejeita faixa fora da grade de 30 minutos", () => {
    const result = CourtsSchema.safeParse([
      {
        availability: {
          ...emptyAvailability,
          mon: [{ endMinute: 90, startMinute: 45 }],
        },
        id: "court-1",
        name: "Quadra 1",
      },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Os horários devem seguir intervalos de 30 minutos."
      );
    }
  });
});

describe("MatchScoreSchema", () => {
  it("aceita W.O. com um único set zerado e vencedor explícito", () => {
    const result = MatchScoreSchema.safeParse({
      sets: [{ challengedGames: 0, challengerGames: 0, kind: "set" }],
      walkover: true,
      winnerMembershipId: "membership-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejeita W.O. com mais de um set", () => {
    const result = MatchScoreSchema.safeParse({
      sets: [
        { challengedGames: 0, challengerGames: 0, kind: "set" },
        { challengedGames: 0, challengerGames: 0, kind: "set" },
      ],
      walkover: true,
      winnerMembershipId: "membership-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Em W.O. não há resultado por sets."
      );
    }
  });
});
