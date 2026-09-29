import { describe, expect, it } from "bun:test";

import { DEFAULT_MATCH_CONFIG } from "../../match/contract";
import { BRAZIL_UTC_OFFSET_MS } from "../../payment/rules";
import {
  CancelTournamentMatchesSchema,
  CreateTournamentSchema,
  MAX_TOURNAMENT_CATEGORIES,
  MAX_TOURNAMENT_MATCH_CANCEL_BATCH,
  SetTournamentUnavailabilitySchema,
  UpdateTournamentSchema,
} from "../contract";
import { brazilDayKey } from "../window-rules";

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

describe("CreateTournamentSchema janela de datas", () => {
  it("aceita o fim no MESMO dia do início, mesmo com horas diferentes", () => {
    const input = buildTournamentInput(3);
    // Meia-noite brasileira do dia do início, fixada depois às 14:00 BRT: o
    // deslocamento de 6h cai às 08:00 do MESMO dia em qualquer hora do relógio.
    const dayStart =
      input.startDate - ((input.startDate + BRAZIL_UTC_OFFSET_MS) % DAY_MS);
    const startDate = dayStart + 14 * 60 * 60 * 1000;
    const endDate = startDate - 6 * 60 * 60 * 1000;
    const result = CreateTournamentSchema.safeParse({
      ...input,
      endDate,
      startDate,
    });

    expect(brazilDayKey(endDate)).toBe(brazilDayKey(startDate));
    expect(result.success).toBe(true);
  });

  it("recusa o fim antes do dia do início", () => {
    const input = buildTournamentInput(3);
    const result = CreateTournamentSchema.safeParse({
      ...input,
      endDate: input.startDate - DAY_MS,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "endDate"
      );
      expect(issue?.message).toBe(
        "O fim do torneio não pode ser antes do início."
      );
    }
  });

  it("sem fim informado o torneio segue sem teto", () => {
    const result = CreateTournamentSchema.safeParse(buildTournamentInput(3));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endDate).toBeUndefined();
    }

    const explicitNull = CreateTournamentSchema.safeParse({
      ...buildTournamentInput(3),
      endDate: null,
    });
    expect(explicitNull.success).toBe(true);
  });

  it("update aceita fim, nulo (sem teto) e ausente (intocado)", () => {
    const input = buildTournamentInput(3);
    const base = { ...input, tournamentId: "tournament-1" };

    const withEnd = UpdateTournamentSchema.safeParse({
      ...base,
      endDate: input.startDate + DAY_MS,
    });
    expect(withEnd.success).toBe(true);
    if (withEnd.success) {
      expect(withEnd.data.endDate).toBe(input.startDate + DAY_MS);
    }

    const cleared = UpdateTournamentSchema.safeParse({
      ...base,
      endDate: null,
    });
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect(cleared.data.endDate).toBeNull();
    }

    const untouched = UpdateTournamentSchema.safeParse(base);
    expect(untouched.success).toBe(true);
    if (untouched.success) {
      expect(untouched.data.endDate).toBeUndefined();
    }
  });
});

describe("SetTournamentUnavailabilitySchema", () => {
  const base = {
    courtId: null,
    date: "2026-10-12",
    endMinute: null,
    reason: "Chuva",
    startMinute: null,
    tournamentId: "tournament-1",
  };

  it("os dois horários nulos fecham o dia inteiro", () => {
    expect(SetTournamentUnavailabilitySchema.safeParse(base).success).toBe(
      true
    );
  });

  it("aceita um pedaço do dia com a quadra", () => {
    const result = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      courtId: "court-3",
      endMinute: 1200,
      startMinute: 960,
    });

    expect(result.success).toBe(true);
  });

  it("recusa só um dos horários e um período invertido", () => {
    const halfFilled = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      startMinute: 960,
    });
    expect(halfFilled.success).toBe(false);
    if (!halfFilled.success) {
      const issue = halfFilled.error.issues.find(
        (item) => item.message === "Informe o início e o fim do período."
      );
      expect(issue?.path.join(".")).toBe("startMinute");
    }

    const inverted = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      endMinute: 960,
      startMinute: 1200,
    });
    expect(inverted.success).toBe(false);
    if (!inverted.success) {
      const issue = inverted.error.issues.find(
        (item) =>
          item.message === "O horário de início deve ser antes do término."
      );
      expect(issue?.path.join(".")).toBe("startMinute");
    }
  });

  it("recusa data fora do formato de dia", () => {
    expect(
      SetTournamentUnavailabilitySchema.safeParse({
        ...base,
        date: "12/10/2026",
      }).success
    ).toBe(false);
  });

  it("motivo é opcional: ausente ou em branco vira sem motivo", () => {
    const absent = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      reason: undefined,
    });
    expect(absent.success).toBe(true);
    if (absent.success) {
      expect(absent.data.reason).toBeNull();
    }

    const blank = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      reason: "   ",
    });
    expect(blank.success).toBe(true);
    if (blank.success) {
      expect(blank.data.reason).toBeNull();
    }

    // Curto agora passa; o teto continua e o motivo vem aparado.
    const short = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      reason: "Ch",
    });
    expect(short.success).toBe(true);
    if (short.success) {
      expect(short.data.reason).toBe("Ch");
    }

    const trimmed = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      reason: "  Chuva  ",
    });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) {
      expect(trimmed.data.reason).toBe("Chuva");
    }

    const long = SetTournamentUnavailabilitySchema.safeParse({
      ...base,
      reason: "x".repeat(81),
    });
    expect(long.success).toBe(false);
    if (!long.success) {
      const issue = long.error.issues.find(
        (item) => item.message === "Use um motivo mais curto."
      );
      expect(issue?.path.join(".")).toBe("reason");
    }
  });
});

describe("CancelTournamentMatchesSchema", () => {
  const base = {
    matchIds: ["match-1"],
    reason: "Chuva",
    tournamentId: "tournament-1",
  };

  it("aceita um lote com motivo", () => {
    expect(CancelTournamentMatchesSchema.safeParse(base).success).toBe(true);
  });

  it("aceita o lote sem motivo", () => {
    const absent = CancelTournamentMatchesSchema.safeParse({
      ...base,
      reason: undefined,
    });
    expect(absent.success).toBe(true);

    const blank = CancelTournamentMatchesSchema.safeParse({
      ...base,
      reason: "",
    });
    expect(blank.success).toBe(true);
  });

  it("recusa lote vazio e acima do teto", () => {
    expect(
      CancelTournamentMatchesSchema.safeParse({ ...base, matchIds: [] }).success
    ).toBe(false);
    expect(
      CancelTournamentMatchesSchema.safeParse({
        ...base,
        matchIds: Array.from(
          { length: MAX_TOURNAMENT_MATCH_CANCEL_BATCH + 1 },
          (_, i) => `match-${i + 1}`
        ),
      }).success
    ).toBe(false);
  });
});
