import { describe, expect, it } from "bun:test";

import {
  ENTRY_LIVE_STATUSES,
  entrySlotFields,
  isEntryDrawable,
  isRegistrationOpen,
  normalizeUsernameLookup,
  registrationClosedMessage,
  resolveCallerEligibility,
  resolveEntryCancelledRecipients,
  resolveEntryStatusAfterPartnerAccepted,
  resolvePaidActivation,
  resolvePartnerGenderTarget,
  resolvePartnerSearchGender,
  scopeEntryPlacement,
  selectUsernameMatches,
  selectViewerTournamentEntryIds,
  shouldDecideArrivalWalkover,
  validateEntryGenders,
} from "../entry-rules";
import {
  validateTournamentMatchScore,
  validateWalkoverWinner,
} from "../score-rules";
import { CreateTournamentSchema, PublishMatchResultSchema } from "../contract";
import { DEFAULT_MATCH_CONFIG } from "../../match/contract";

describe("validateEntryGenders", () => {
  it("misto exige gênero definido nos dois perfis", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
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
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Masculino",
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
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
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Masculino",
      })
    ).toContain("1 homem e 1 mulher");
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

describe("resolvePaidActivation (IBX-0067 review HIGH-1)", () => {
  it("capacidade 8 paga com 9 pagamentos: 8 ativam, o 9º estorna", () => {
    // pagamentos 1..8 chegam com activeCount 0..7 → ativam
    for (let activeCount = 0; activeCount < 8; activeCount += 1) {
      expect(resolvePaidActivation({ activeCount, maxEntries: 8 })).toBe(
        "activate"
      );
    }
    // o 9º pagamento chega com as 8 vagas ocupadas → refund
    expect(resolvePaidActivation({ activeCount: 8, maxEntries: 8 })).toBe(
      "refund"
    );
  });

  it("approve + pagamento overflow cai na mesma porta (conta só active)", () => {
    // 8 ativos já confirmados (approve/pagamento); um awaiting_payment
    // aprovado não ocupa vaga — o pagamento dele encontra a chave cheia
    expect(resolvePaidActivation({ activeCount: 8, maxEntries: 8 })).toBe(
      "refund"
    );
    // pendências não reservam vaga: 6 ativos + 3 aguardando → ativa
    expect(resolvePaidActivation({ activeCount: 6, maxEntries: 8 })).toBe(
      "activate"
    );
  });

  it("categoria sem limite ativa sempre", () => {
    expect(resolvePaidActivation({ activeCount: 500, maxEntries: null })).toBe(
      "activate"
    );
  });
});

describe("registrationClosedMessage", () => {
  const pastDeadline = { nowMs: 2000, registrationDeadlineMs: 1000 };

  it("prazo vencido em published/drawn fala do prazo", () => {
    expect(
      registrationClosedMessage({ ...pastDeadline, status: "published" })
    ).toBe("O prazo de inscrições já encerrou.");
    expect(
      registrationClosedMessage({ ...pastDeadline, status: "drawn" })
    ).toBe("O prazo de inscrições já encerrou.");
  });

  it("estado que não aceita inscrição fala do fechamento", () => {
    expect(
      registrationClosedMessage({ ...pastDeadline, status: "ongoing" })
    ).toBe("As inscrições deste torneio estão fechadas.");
    expect(
      registrationClosedMessage({ ...pastDeadline, status: "draft" })
    ).toBe("As inscrições deste torneio estão fechadas.");
  });

  it("janela aberta é detectada pela fonte única", () => {
    expect(
      isRegistrationOpen({
        nowMs: 500,
        registrationDeadlineMs: 1000,
        status: "drawn",
      })
    ).toBe(true);
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
  const config = DEFAULT_MATCH_CONFIG; // melhor de 3, sets até 6, tie-break

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

describe("refineTournamentWindow — prazo vs início (strict) e divulgação", () => {
  const DAY = 86_400_000;
  const START = 1_800_000_000_000;

  function parseWindow(
    registrationDeadlineAt: number,
    startDate: number,
    bracketReleaseAt?: null | number
  ) {
    return CreateTournamentSchema.safeParse({
      allowMultipleEntriesPerType: true,
      approvalMode: "auto",
      avatarStorageId: null,
      ...(bracketReleaseAt === undefined ? {} : { bracketReleaseAt }),
      categories: [
        {
          entryFeeCents: 0,
          gender: "male",
          maxEntries: null,
          modality: "doubles",
          name: "Duplas Masculinas",
        },
      ],
      city: "São Paulo",
      courts: [],
      coverStorageId: null,
      matchConfig: DEFAULT_MATCH_CONFIG,
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

  it("sem data (ou com null) segue sem divulgação agendada", () => {
    expect(parseWindow(START - DAY, START).success).toBeTrue();
    expect(parseWindow(START - DAY, START, null).success).toBeTrue();
  });

  it("divulgação entre o prazo e o início é aceita, inclusive no instante do prazo", () => {
    expect(parseWindow(START - DAY, START, START - DAY / 2).success).toBeTrue();
    expect(parseWindow(START - DAY, START, START - DAY).success).toBeTrue();
  });

  it("divulgação antes do prazo é rejeitada", () => {
    const result = parseWindow(START - DAY, START, START - DAY - 1);
    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "bracketReleaseAt"
      );
      expect(issue?.message).toBe(
        "A divulgação da chave não pode ser antes do prazo de inscrições."
      );
    }
  });

  it("divulgação no MESMO dia do início é aceita (o start dispara pelo dia)", () => {
    // 23h antes do início, mesmo dia do calendário brasileiro.
    expect(
      parseWindow(START - 2 * DAY, START, START - 3_600_000).success
    ).toBeTrue();
  });

  it("divulgação depois do dia do início é rejeitada", () => {
    const result = parseWindow(START - DAY, START, START + DAY);
    expect(result.success).toBeFalse();
    if (!result.success) {
      const issue = result.error.issues.find(
        (item) => item.path.join(".") === "bracketReleaseAt"
      );
      expect(issue?.message).toBe(
        "A divulgação da chave não pode ser depois do início do torneio."
      );
    }
  });
});

describe("entrySlotFields", () => {
  it("status vivo reserva o slot do playerA (singles)", () => {
    for (const status of ENTRY_LIVE_STATUSES) {
      expect(
        entrySlotFields({ playerAId: "player-a", playerBId: null, status })
      ).toEqual({ activeAId: "player-a" });
    }
  });

  it("duplas viva reserva os dois lados", () => {
    expect(
      entrySlotFields({
        playerAId: "player-a",
        playerBId: "player-b",
        status: "pending_partner",
      })
    ).toEqual({ activeAId: "player-a", activeBId: "player-b" });
  });

  it("entrada cancelada ou rejeitada não reserva slot nenhum", () => {
    for (const status of ["cancelled", "rejected"]) {
      expect(
        entrySlotFields({
          playerAId: "player-a",
          playerBId: "player-b",
          status,
        })
      ).toEqual({});
    }
  });
});

describe("selectUsernameMatches", () => {
  const users = [
    { id: "u1", username: "brunowilliang" },
    { id: "u2", username: "bruno.lima" },
    { id: "u3", username: "bruno.ferreira" },
    { id: "u4", username: "rafael.souza" },
    { id: "u5" },
    { id: "u6", username: null },
  ];

  it("prefixo parcial acha em qualquer caixa (o termo chega normalizado)", () => {
    expect(
      selectUsernameMatches({
        limit: 10,
        prefix: normalizeUsernameLookup("  BRU "),
        users,
      }).map((match) => match.username)
    ).toEqual(["bruno.ferreira", "bruno.lima", "brunowilliang"]);
  });

  it("usuário sem username definido nunca aparece", () => {
    const ids = selectUsernameMatches({
      limit: 10,
      prefix: "bruno",
      users,
    }).map((match) => match.id);
    expect(ids).not.toContain("u5");
    expect(ids).not.toContain("u6");
  });

  it("limita em ordem alfabética de username", () => {
    expect(
      selectUsernameMatches({
        limit: 2,
        prefix: "bruno",
        users,
      }).map((match) => match.username)
    ).toEqual(["bruno.ferreira", "bruno.lima"]);
  });

  it("prefixo sem nenhum match devolve vazio", () => {
    expect(
      selectUsernameMatches({ limit: 10, prefix: "brunoz", users })
    ).toEqual([]);
  });
});

describe("resolvePartnerGenderTarget", () => {
  it("categoria fixa decide o gênero do parceiro independente de quem convida", () => {
    expect(
      resolvePartnerGenderTarget({
        categoryGender: "male",
        playerGender: "Feminino",
      })
    ).toBe("Masculino");
    expect(
      resolvePartnerGenderTarget({
        categoryGender: "female",
        playerGender: "Masculino",
      })
    ).toBe("Feminino");
  });

  it("mista pede o OPOSTO de quem convida", () => {
    expect(
      resolvePartnerGenderTarget({
        categoryGender: "mixed",
        playerGender: "Masculino",
      })
    ).toBe("Feminino");
    expect(
      resolvePartnerGenderTarget({
        categoryGender: "mixed",
        playerGender: "Feminino",
      })
    ).toBe("Masculino");
  });

  it("mista com gênero do convidado indefinido não decide", () => {
    expect(
      resolvePartnerGenderTarget({
        categoryGender: "mixed",
        playerGender: null,
      })
    ).toBeNull();
  });
});

// A recusa cita o NOME LIVRE da categoria: o rotulo de tipo ("Simples
// masculino") e do app, nao do servidor.
const CATEGORY_NAME = "Duplas do Vale";
const CALLER_MASCULINO = `Você não pode se inscrever em ${CATEGORY_NAME}. A categoria aceita apenas o gênero masculino.`;
const CALLER_FEMININO = `Você não pode se inscrever em ${CATEGORY_NAME}. A categoria aceita apenas o gênero feminino.`;
const CALLER_MISTA_SEM_GENERO =
  "Duplas mistas exigem o gênero definido no perfil dos dois jogadores.";

// Rótulos de DISPLAY (chip do rodapé): ≤2 palavras, nunca a frase do erro.
// Perfil SEM gênero é legado (a escrita do perfil exige gender) e não tem chip.
const LABEL_MULHERES = "Mulheres";
const LABEL_HOMENS = "Homens";

describe("validateEntryGenders — gênero do parceiro (r25)", () => {
  it("duplas masculinas aceitam parceiro masculino", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Masculino",
      })
    ).toBeNull();
  });

  it("duplas masculinas recusam parceira feminina", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Feminino",
      })
    ).toBe(
      "Duplas Masculinas exigem parceiro com o gênero masculino definido no perfil."
    );
  });

  it("duplas masculinas recusam parceiro sem gênero definido", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: null,
      })
    ).toBe(
      "Duplas Masculinas exigem parceiro com o gênero masculino definido no perfil."
    );
  });

  it("duplas femininas recusam parceiro masculino", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Masculino",
      })
    ).toBe(
      "Duplas Femininas exigem parceiro com o gênero feminino definido no perfil."
    );
  });

  // Categoria de gênero fixo gateia quem convida, não só o parceiro dele.
  it("o gênero de quem convida é exigido em categoria fixa (r27)", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: null,
        playerBGender: "Masculino",
      })
    ).toBe(CALLER_MASCULINO);
  });

  it("simples de gênero fixo também gateia quem se inscreve (r27)", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: null,
        playerBGender: null,
      })
    ).toBe(CALLER_MASCULINO);
  });
});

describe("validateEntryGenders — gênero do CALLER (r27)", () => {
  it("caller masculino é recusado em duplas femininas mesmo com parceira feminina", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Feminino",
      })
    ).toBe(CALLER_FEMININO);
  });

  it("caller feminino é recusado em duplas masculinas mesmo com parceiro masculino", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Masculino",
      })
    ).toBe(CALLER_MASCULINO);
  });

  it("simples feminino recusa caller masculino", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "singles",
        playerAGender: "Masculino",
        playerBGender: null,
      })
    ).toBe(CALLER_FEMININO);
  });

  it("simples masculino recusa caller feminino", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Feminino",
        playerBGender: null,
      })
    ).toBe(CALLER_MASCULINO);
  });

  it("perfil sem gênero é recusado em categoria fixa (simples e duplas)", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "singles",
        playerAGender: null,
        playerBGender: null,
      })
    ).toBe(CALLER_FEMININO);
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: null,
        playerBGender: "Feminino",
      })
    ).toBe(CALLER_FEMININO);
  });

  it("aceites legítimos continuam passando", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Masculino",
        playerBGender: null,
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "singles",
        playerAGender: "Feminino",
        playerBGender: null,
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Masculino",
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Feminino",
      })
    ).toBeNull();
  });

  it("mista segue sem gate de caller: qualquer gênero definido entra", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
        playerBGender: "Feminino",
      })
    ).toBeNull();
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Feminino",
        playerBGender: "Masculino",
      })
    ).toBeNull();
  });

  it("simples misto não gateia quem se inscreve", () => {
    expect(
      validateEntryGenders({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "singles",
        playerAGender: null,
        playerBGender: null,
      })
    ).toBeNull();
  });
});

describe("resolvePartnerSearchGender — gate da BUSCA (IBX-0074 r27 review MEDIUM)", () => {
  it("caller feminina em Duplas Masculinas: busca vazia", () => {
    expect(
      resolvePartnerSearchGender({
        categoryGender: "male",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toBeNull();
  });

  it("caller masculino em Duplas Femininas: busca vazia", () => {
    expect(
      resolvePartnerSearchGender({
        categoryGender: "female",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toBeNull();
  });

  it("caller feminina em Simples Masculino: busca vazia", () => {
    expect(
      resolvePartnerSearchGender({
        categoryGender: "male",
        categoryName: CATEGORY_NAME,
        modality: "singles",
        playerAGender: "Feminino",
      })
    ).toBeNull();
  });

  it("caller sem gênero em categoria fixa: busca vazia", () => {
    expect(
      resolvePartnerSearchGender({
        categoryGender: "female",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: null,
      })
    ).toBeNull();
  });

  it("mista com caller sem gênero: busca vazia (r25 mantido)", () => {
    expect(
      resolvePartnerSearchGender({
        categoryGender: "mixed",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: null,
      })
    ).toBeNull();
  });

  it("aceites legítimos seguem achando o gênero exigido", () => {
    // Camila (F) em Duplas Femininas e Simples Feminino.
    expect(
      resolvePartnerSearchGender({
        categoryGender: "female",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toBe("Feminino");
    expect(
      resolvePartnerSearchGender({
        categoryGender: "female",
        categoryName: CATEGORY_NAME,
        modality: "singles",
        playerAGender: "Feminino",
      })
    ).toBe("Feminino");
    // Bruno (M) em Duplas Masculinas / Simples Masculino.
    expect(
      resolvePartnerSearchGender({
        categoryGender: "male",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toBe("Masculino");
    expect(
      resolvePartnerSearchGender({
        categoryGender: "male",
        categoryName: CATEGORY_NAME,
        modality: "singles",
        playerAGender: "Masculino",
      })
    ).toBe("Masculino");
    // Mista: o parceiro é o OPOSTO de quem convida, nos dois sentidos.
    expect(
      resolvePartnerSearchGender({
        categoryGender: "mixed",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toBe("Feminino");
    expect(
      resolvePartnerSearchGender({
        categoryGender: "mixed",
        categoryName: CATEGORY_NAME,
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toBe("Masculino");
  });
});

describe("resolveCallerEligibility (IBX-0074 r27)", () => {
  it("a recusa cita o NOME livre da categoria, sem derivar tipo", () => {
    expect(
      resolveCallerEligibility({
        categoryName: "Amador B",
        gender: "male",
        modality: "singles",
        playerAGender: "Feminino",
      })
    ).toEqual({
      eligible: false,
      label: LABEL_HOMENS,
      reason:
        "Você não pode se inscrever em Amador B. A categoria aceita apenas o gênero masculino.",
    });
  });

  it("categoria feminina recusa caller masculino: rótulo curto + motivo exato", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toEqual({
      eligible: false,
      label: LABEL_MULHERES,
      reason: CALLER_FEMININO,
    });
  });

  it("categoria masculina recusa caller feminino: rótulo curto + motivo exato", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Feminino",
      })
    ).toEqual({
      eligible: false,
      label: LABEL_HOMENS,
      reason: CALLER_MASCULINO,
    });
  });

  it("perfil sem gênero em categoria fixa: recusa sem chip, só a frase", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: null,
      })
    ).toEqual({
      eligible: false,
      label: null,
      reason: CALLER_MASCULINO,
    });
  });

  it("caller que casa com a categoria é elegível sem motivo nem rótulo", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Masculino",
      })
    ).toEqual({ eligible: true, label: null, reason: null });
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toEqual({ eligible: true, label: null, reason: null });
  });

  it("mista aceita qualquer gênero definido e recusa perfil sem gênero", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toEqual({ eligible: true, label: null, reason: null });
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toEqual({ eligible: true, label: null, reason: null });
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: null,
      })
    ).toEqual({
      eligible: false,
      label: null,
      reason: CALLER_MISTA_SEM_GENERO,
    });
  });

  it("simples misto não gateia (não existe parceiro a resolver)", () => {
    expect(
      resolveCallerEligibility({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "singles",
        playerAGender: null,
      })
    ).toEqual({ eligible: true, label: null, reason: null });
  });
});

describe("rótulo de DISPLAY da inelegibilidade (chip do rodapé)", () => {
  // O chip exibe `viewerIneligibleReason` do discovery e não cabe uma frase:
  // no máximo 2 palavras, sem travessão. A frase longa fica SÓ no erro do
  // create (pins das suítes acima). Perfil SEM gênero não tem chip (legado).
  const labelOf = (input: Parameters<typeof resolveCallerEligibility>[0]) => {
    const result = resolveCallerEligibility(input);
    return result.eligible ? null : result.label;
  };

  it("usa as strings finais: Mulheres na feminina, Homens na masculina", () => {
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Masculino",
      })
    ).toBe(LABEL_MULHERES);
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "singles",
        playerAGender: "Masculino",
      })
    ).toBe(LABEL_MULHERES);
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toBe(LABEL_HOMENS);
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Feminino",
      })
    ).toBe(LABEL_HOMENS);
  });

  it("perfil sem gênero não tem chip (label null) em fixa nem em mista", () => {
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "singles",
        playerAGender: null,
      })
    ).toBeNull();
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: null,
      })
    ).toBeNull();
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "mixed",
        modality: "doubles",
        playerAGender: null,
      })
    ).toBeNull();
  });

  it("cabe num chip: no máximo 2 palavras e nenhum travessão", () => {
    const inputs: Parameters<typeof resolveCallerEligibility>[0][] = [
      {
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Masculino",
      },
      {
        categoryName: CATEGORY_NAME,
        gender: "male",
        modality: "singles",
        playerAGender: "Feminino",
      },
    ];

    for (const input of inputs) {
      const label = labelOf(input);
      expect(label).not.toBeNull();
      expect((label ?? "").split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(label ?? "").not.toContain(" - ");
    }
  });

  it("elegível não tem rótulo", () => {
    expect(
      labelOf({
        categoryName: CATEGORY_NAME,
        gender: "female",
        modality: "doubles",
        playerAGender: "Feminino",
      })
    ).toBeNull();
  });
});

describe("aviso de inscricao cancelada", () => {
  it("vai para os gestores, sem quem agiu e sem duplicar", () => {
    expect(
      resolveEntryCancelledRecipients(["gestor-1", "gestor-2"], "jogador-1")
    ).toEqual(["gestor-1", "gestor-2"]);
    // Organizador que cancelou por conta propria nao recebe o aviso do ato.
    expect(
      resolveEntryCancelledRecipients(["gestor-1", "gestor-2"], "gestor-1")
    ).toEqual(["gestor-2"]);
    // Duas contas de gestao no mesmo dono = um aviso so.
    expect(
      resolveEntryCancelledRecipients(["gestor-1", "gestor-1"], "jogador-1")
    ).toEqual(["gestor-1"]);
    expect(resolveEntryCancelledRecipients([], "jogador-1")).toEqual([]);
  });
});

describe("fase de entrada e cabeça de chave na LISTA de inscrições", () => {
  const entry = {
    categoryId: "cat-1",
    entryRound: 2,
    id: "entry-1",
    playerA: null,
    seedRank: 1,
    status: "active",
  };

  it("organizador recebe os dois campos", () => {
    expect(scopeEntryPlacement(entry, { includePlacement: true })).toEqual(
      entry
    );
  });

  it("público não recebe nem a chave nem o valor nulo", () => {
    const publicEntry = scopeEntryPlacement(entry, { includePlacement: false });
    expect(publicEntry).toEqual({
      categoryId: "cat-1",
      id: "entry-1",
      playerA: null,
      status: "active",
    });
    expect("entryRound" in publicEntry).toBe(false);
    expect("seedRank" in publicEntry).toBe(false);
  });
});

describe("chegada do segundo lado numa vaga", () => {
  it("resolve por W.O. quando a inscrição que guardava a vaga foi cancelada", () => {
    expect(
      shouldDecideArrivalWalkover({
        otherEntryId: "entry-cancelada",
        otherEntryStatus: "cancelled",
      })
    ).toBe(true);
  });

  it("não decide com adversário vivo nem com a vaga ainda esperando o outro lado", () => {
    expect(
      shouldDecideArrivalWalkover({
        otherEntryId: "entry-viva",
        otherEntryStatus: "active",
      })
    ).toBe(false);
    expect(
      shouldDecideArrivalWalkover({
        otherEntryId: null,
        otherEntryStatus: null,
      })
    ).toBe(false);
    // Linha do adversário ausente (não deveria acontecer): sem status, sem W.O.
    expect(
      shouldDecideArrivalWalkover({
        otherEntryId: "entry-sumida",
        otherEntryStatus: null,
      })
    ).toBe(false);
  });
});
