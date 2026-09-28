import { describe, expect, it } from "bun:test";

import { DEFAULT_MATCH_CONFIG } from "../../match/contract";
import {
  CreateTournamentSchema,
  MAX_TOURNAMENT_CATEGORIES,
  UpdateTournamentSchema,
} from "../contract";

const DAY_MS = 24 * 60 * 60 * 1000;

function buildTournamentInput(bestOfSets: number) {
  const now = Date.now();

  return {
    allowMultipleEntriesPerType: true,
    approvalMode: "auto",
    avatarStorageId: null,
    categories: [
      {
        entryFeeCents: 0,
        gender: "male",
        maxEntries: null,
        modality: "singles",
        name: "Simples Masculino",
      },
    ],
    city: "Dracena",
    courts: [],
    coverStorageId: null,
    matchConfig: { ...DEFAULT_MATCH_CONFIG, bestOfSets },
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
        ...DEFAULT_MATCH_CONFIG,
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

  it("stripa chaves finalSet* legadas sem erro (DEC-0004)", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      matchConfig: {
        ...DEFAULT_MATCH_CONFIG,
        bestOfSets: 3,
        finalSetMode: "super_tiebreak",
        finalSetSuperTieBreakPoints: 10,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matchConfig).not.toHaveProperty("finalSetMode");
    }
  });
});

describe("CreateTournamentSchema categorias", () => {
  function buildCategory(input: {
    gender: "female" | "male" | "mixed";
    modality: "doubles" | "singles";
    name: string;
  }) {
    return { entryFeeCents: 0, maxEntries: null, ...input };
  }

  it("aceita nomes livres, inclusive curtos (A, B, C)", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      categories: [
        buildCategory({ gender: "male", modality: "singles", name: "A" }),
        buildCategory({ gender: "male", modality: "singles", name: "B" }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("recusa o mesmo nome no MESMO tipo, ignorando caixa e espaços", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      categories: [
        buildCategory({
          gender: "male",
          modality: "singles",
          name: "Amador A",
        }),
        buildCategory({
          gender: "male",
          modality: "singles",
          name: "  amador a  ",
        }),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) =>
          item.message === "Já existe uma categoria com esse nome nesse tipo."
      );
      expect(issue?.path.join(".")).toBe("categories.1.name");
    }
  });

  it("aceita o mesmo nome em tipos diferentes", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      categories: [
        buildCategory({ gender: "male", modality: "singles", name: "A" }),
        buildCategory({ gender: "female", modality: "singles", name: "A" }),
        buildCategory({ gender: "mixed", modality: "doubles", name: "A" }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("recusa acima do teto de categorias por torneio", () => {
    const result = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      categories: Array.from(
        { length: MAX_TOURNAMENT_CATEGORIES + 1 },
        (_, i) =>
          buildCategory({
            gender: "male",
            modality: "singles",
            name: `Categoria ${i + 1}`,
          })
      ),
    });

    expect(result.success).toBe(false);
  });

  it("update aceita `id` na categoria existente e o omite na nova", () => {
    const result = UpdateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      categories: [
        {
          ...buildCategory({
            gender: "male",
            modality: "singles",
            name: "A",
          }),
          id: "category-1",
        },
        buildCategory({ gender: "male", modality: "singles", name: "B" }),
      ],
      tournamentId: "tournament-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories[0]?.id).toBe("category-1");
      expect(result.data.categories[1]?.id).toBeUndefined();
    }
  });
});
