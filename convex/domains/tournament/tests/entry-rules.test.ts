import { describe, expect, it } from "bun:test";

import {
  buildCategoryDisplayName,
  isEntryDrawable,
  normalizeUsernameLookup,
  resolveEntryStatusAfterPartnerAccepted,
  selectViewerTournamentEntryIds,
  validateEntryGenders,
} from "../entry-rules";
import {
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "../score-rules";
import { CreateTournamentSchema, PublishMatchResultSchema } from "../contract";
import { DEFAULT_LEAGUE_MATCH_CONFIG } from "../../league/contract";

describe("buildCategoryDisplayName", () => {
  it("nomeia as 5 categorias do produto", () => {
    expect(buildCategoryDisplayName("singles", "male")).toBe(
      "Simples Masculino"
    );
    expect(buildCategoryDisplayName("singles", "female")).toBe(
      "Simples Feminino"
    );
    expect(buildCategoryDisplayName("doubles", "male")).toBe(
      "Duplas Masculinas"
    );
    expect(buildCategoryDisplayName("doubles", "female")).toBe(
      "Duplas Femininas"
    );
    expect(buildCategoryDisplayName("doubles", "mixed")).toBe("Duplas Mistas");
  });
});

describe("validateEntryGenders", () => {
  it("misto exige gênero definido nos dois perfis", () => {
    expect(
      validateEntryGenders({
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: null,
      })
    ).toContain("gênero definido");
  });

  it("misto aceita 1 homem + 1 mulher em qualquer ordem", () => {
    expect(
      validateEntryGenders({
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Masculino",
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Feminino",
      })
    ).toBeNull();
  });

  it("misto rejeita dois jogadores do mesmo gênero", () => {
    expect(
      validateEntryGenders({
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Masculino",
      })
    ).toContain("1 homem e 1 mulher");
  });

  it("categorias não-mistas não validam gênero do perfil", () => {
    expect(
      validateEntryGenders({
        gender: "male",
        modality: "doubles",
        playerAGender: null,
        playerBGender: null,
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        gender: "female",
        modality: "singles",
        playerAGender: "Masculino",
        playerBGender: null,
      })
    ).toBeNull();
  });
});

describe("resolveEntryStatusAfterPartnerAccepted", () => {
  it("categoria paga + auto vai para checkout", () => {
    expect(
      resolveEntryStatusAfterPartnerAccepted({
        approvalMode: "auto",
        entryFeeCents: 5000,
      })
    ).toBe("awaiting_payment");
  });

  it("categoria paga + manual espera aprovação", () => {
    expect(
      resolveEntryStatusAfterPartnerAccepted({
        approvalMode: "manual",
        entryFeeCents: 5000,
      })
    ).toBe("pending_approval");
  });

  it("grátis + auto ativa direto", () => {
    expect(
      resolveEntryStatusAfterPartnerAccepted({
        approvalMode: "auto",
        entryFeeCents: 0,
      })
    ).toBe("active");
  });

  it("grátis + manual espera aprovação", () => {
    expect(
      resolveEntryStatusAfterPartnerAccepted({
        approvalMode: "manual",
        entryFeeCents: 0,
      })
    ).toBe("pending_approval");
  });
});

describe("isEntryDrawable", () => {
  it("somente active entra no sorteio", () => {
    expect(isEntryDrawable("active")).toBeTrue();
    expect(isEntryDrawable("pending_partner")).toBeFalse();
    expect(isEntryDrawable("awaiting_payment")).toBeFalse();
    expect(isEntryDrawable("cancelled")).toBeFalse();
  });
});

describe("selectViewerTournamentEntryIds (BUG-0017)", () => {
  const entries = [
    { categoryId: "c1", id: "e1", status: "active" },
    { categoryId: "c1", id: "e2", status: "cancelled" },
    { categoryId: "c2", id: "e3", status: "awaiting_payment" },
    { categoryId: "other", id: "e4", status: "active" },
  ];

  it("mantém só entradas não-canceladas das categorias do torneio", () => {
    expect(
      selectViewerTournamentEntryIds({
        categoryIds: ["c1", "c2"],
        entries,
      })
    ).toEqual(["e1", "e3"]);
  });

  it("não deixa inscrição de outro torneio furar o gate", () => {
    expect(
      selectViewerTournamentEntryIds({ categoryIds: ["c3"], entries })
    ).toEqual([]);
  });
});

describe("validateTournamentMatchScore", () => {
  const config = DEFAULT_LEAGUE_MATCH_CONFIG; // melhor de 3, sets até 6, tie-break

  it("placar válido 6x3 6x4 retorna o vencedor", () => {
    const result = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [
          { aGames: 6, bGames: 3, kind: "set" },
          { aGames: 6, bGames: 4, kind: "set" },
        ],
        winnerEntryId: "entryA",
      },
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entryA");
  });

  it("linha empatada é aceita; empate total sem explícito é erro claro", () => {
    const explicit = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [{ aGames: 4, bGames: 4, kind: "set" }],
        winnerEntryId: "entryA",
      },
    });
    expect(explicit.error).toBeNull();
    expect(explicit.winnerEntryId).toBe("entryA");

    const undecided = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [{ aGames: 4, bGames: 4, kind: "set" }],
        winnerEntryId: null,
      },
    });
    expect(undecided.error).toBe(
      "O placar não define o vencedor; informe o vencedor do confronto."
    );
  });

  it("rejeita vencedor inconsistente com o placar", () => {
    const result = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [
          { aGames: 6, bGames: 3, kind: "set" },
          { aGames: 6, bGames: 4, kind: "set" },
        ],
        winnerEntryId: "entryB",
      },
    });
    expect(result.error).toContain("vencedor");
  });

  it("aceita qualquer número de linhas, com números e kinds livres", () => {
    const result = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [
          { aGames: 6, bGames: 3, kind: "set" },
          { aGames: 6, bGames: 4, kind: "set" },
          { aGames: 3, bGames: 3, kind: "tiebreak" },
          { aGames: 10, bGames: 8, kind: "super_tiebreak" },
        ],
        winnerEntryId: "entryA",
      },
    });
    // linhas: A, A, empate, A → derivado A (confere com o explícito)
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entryA");
  });

  it("linhas sem decisão usam o vencedor explícito (derivado null)", () => {
    const result = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [
          { aGames: 4, bGames: 6, kind: "set" },
          { aGames: 6, bGames: 4, kind: "set" },
        ],
        winnerEntryId: "entryB",
      },
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entryB");
  });

  it("6x6 com TB no vocabulário A/B decide a linha pelo TB (rodada 4)", () => {
    const result = validateTournamentMatchScore({
      entryAId: "entryA",
      entryBId: "entryB",
      matchConfig: config,
      score: {
        sets: [
          {
            aGames: 6,
            bGames: 6,
            kind: "set",
            tieBreak: { aPoints: 7, bPoints: 3 },
          },
        ],
        winnerEntryId: null,
      },
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entryA");
  });
});

describe("normalizeUsernameLookup", () => {
  it("normaliza para lowercase com trim (forma canônica do plugin)", () => {
    expect(normalizeUsernameLookup("  Ana.Braga  ")).toBe("ana.braga");
    expect(normalizeUsernameLookup("JOAO")).toBe("joao");
  });

  it("string só de espaços vira vazia (busca não roda)", () => {
    expect(normalizeUsernameLookup("   ")).toBe("");
  });

  it("idempotente", () => {
    expect(normalizeUsernameLookup(normalizeUsernameLookup(" MiXeD "))).toBe(
      "mixed"
    );
  });
});

describe("validateWalkoverWinner (M4)", () => {
  it("aceita vencedor que é um dos lados", () => {
    const result = validateWalkoverWinner({
      entryAId: "entryA",
      entryBId: "entryB",
      winnerEntryId: "entryB",
    });
    expect(result.error).toBeNull();
    expect(result.winnerEntryId).toBe("entryB");
  });

  it("rejeita vencedor fora dos dois lados (walkover arbitrário)", () => {
    const result = validateWalkoverWinner({
      entryAId: "entryA",
      entryBId: "entryB",
      winnerEntryId: "entryC",
    });
    expect(result.error).toContain("não participa");
    expect(result.winnerEntryId).toBeNull();
  });

  it("refine do contract: W.O. leva exatamente 1 set placeholder", () => {
    const base = { matchId: "m1", walkover: true };
    const ok = PublishMatchResultSchema.safeParse({
      ...base,
      score: {
        sets: [{ aGames: 0, bGames: 0, kind: "set" }],
        winnerEntryId: "x",
      },
    });
    expect(ok.success).toBeTrue();
    const bad = PublishMatchResultSchema.safeParse({
      ...base,
      score: {
        sets: [
          { aGames: 0, bGames: 0, kind: "set" },
          { aGames: 0, bGames: 0, kind: "set" },
        ],
        winnerEntryId: "x",
      },
    });
    expect(bad.success).toBeFalse();
  });
});

describe("refineTournamentWindow — prazo vs início (strict)", () => {
  const DAY = 86_400_000;
  const START = 1_800_000_000_000;

  function parseWindow(registrationDeadlineAt: number, startDate: number) {
    return CreateTournamentSchema.safeParse({
      approvalMode: "auto",
      avatarStorageId: null,
      categories: [
        {
          entryFeeCents: 0,
          gender: "male",
          maxEntries: null,
          modality: "doubles",
        },
      ],
      city: "São Paulo",
      courts: [],
      coverStorageId: null,
      matchConfig: DEFAULT_LEAGUE_MATCH_CONFIG,
      name: "Aberto de Verão",
      registrationDeadlineAt,
      startDate,
      state: "SP",
      visibility: "public",
    });
  }

  it("véspera do início é aceita", () => {
    const result = parseWindow(START - DAY, START);
    expect(result.success).toBeTrue();
  });

  it("prazo no MESMO dia do início é rejeitado", () => {
    const result = parseWindow(START, START);
    expect(result.success).toBeFalse();
  });

  it("prazo posterior ao início é rejeitado", () => {
    const result = parseWindow(START + DAY, START);
    expect(result.success).toBeFalse();
  });
});
