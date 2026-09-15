import { describe, expect, it } from "bun:test";

import { DEFAULT_LEAGUE_MATCH_CONFIG } from "../../league/contract";
import { CreateTournamentSchema, UpdateTournamentSchema } from "../contract";

const DAY_MS = 24 * 60 * 60 * 1000;

function buildTournamentInput(bestOfSets: number) {
  const now = Date.now();

  return {
    approvalMode: "auto",
    avatarStorageId: null,
    categories: [
      {
        entryFeeCents: 0,
        gender: "male",
        maxEntries: null,
        modality: "singles",
      },
    ],
    city: "Dracena",
    courts: [],
    coverStorageId: null,
    matchConfig: { ...DEFAULT_LEAGUE_MATCH_CONFIG, bestOfSets },
    name: "Circuito Dracena Open",
    registrationDeadlineAt: now + DAY_MS,
    startDate: now + 2 * DAY_MS,
    state: "SP",
    visibility: "public",
  };
}

describe("CreateTournamentSchema matchConfig", () => {
  it("aceita melhor de 1, 3 e 5 sets", () => {
    for (const bestOfSets of [1, 3, 5]) {
      const result = CreateTournamentSchema.safeParse(
        buildTournamentInput(bestOfSets)
      );

      expect(result.success).toBe(true);
    }
  });

  it("rejeita melhor de 2 — sem cair silenciosamente no default", () => {
    const result = CreateTournamentSchema.safeParse(buildTournamentInput(2));

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "matchConfig.bestOfSets"
      );
      expect(issue?.message).toBe("Escolha melhor de 1, 3 ou 5 sets.");
    }
  });
});

describe("UpdateTournamentSchema matchConfig", () => {
  it("rejeita melhor de 2 — sem cair silenciosamente no default", () => {
    const result = UpdateTournamentSchema.safeParse({
      ...buildTournamentInput(2),
      tournamentId: "tournament-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "matchConfig.bestOfSets"
      );
      expect(issue?.message).toBe("Escolha melhor de 1, 3 ou 5 sets.");
    }
  });
});

describe("CreateTournamentSchema tie-break points (R11)", () => {
  it("rejeita tieBreakPoints fora de {7, 10}", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 3,
        tieBreakPoints: 5,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "matchConfig.tieBreakPoints"
      );
      expect(issue?.message).toBe("Escolha 7 ou 10 pontos no tie-break.");
    }
  });

  it("rejeita finalSetSuperTieBreakPoints fora de {7, 10}", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 3,
        finalSetMode: "super_tiebreak",
        finalSetSuperTieBreakPoints: 2,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) =>
          item.path.join(".") === "matchConfig.finalSetSuperTieBreakPoints"
      );
      expect(issue?.message).toBe("Escolha 7 ou 10 pontos no tie-break.");
    }
  });
});
