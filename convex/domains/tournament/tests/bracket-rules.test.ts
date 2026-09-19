import { describe, expect, it } from "bun:test";

import {
  applySlotSwap,
  buildBracket,
  buildSwapPersistPlan,
  canDrawTournament,
  deriveSwapMatchStatus,
  isBracketFinished,
  nextBracketSize,
  nextMatchCoordinates,
  seedOrder,
  slotOfSeed,
  validateBracketStartable,
  validateEntryRounds,
  validateSeedRanks,
  validateSlotSwap,
  validateSwapCategoryOwnership,
  validateSwapWindow,
  type BracketMatchSide,
  type BracketSeedEntry,
  type BracketSwapCoordinate,
  type BuiltBracketMatch,
  type SwapBoardMatch,
} from "../bracket-rules";

const entry = (
  id: string,
  seedRank: number | null = null,
  entryRound: number | null = null
): BracketSeedEntry => ({
  entryId: id,
  entryRound,
  seedRank,
});

const boardMatch = (input: {
  entryAId?: string | null;
  entryBId?: string | null;
  hasPublishedResult?: boolean;
  id?: string;
  round: number;
  slotInRound: number;
  status?: SwapBoardMatch["status"];
  walkover?: boolean;
  winnerEntryId?: string | null;
}): SwapBoardMatch => ({
  entryAId: input.entryAId ?? null,
  entryBId: input.entryBId ?? null,
  hasPublishedResult: input.hasPublishedResult ?? false,
  id: input.id ?? `m${input.round}-${input.slotInRound}`,
  round: input.round,
  slotInRound: input.slotInRound,
  status: input.status ?? "pending",
  walkover: input.walkover ?? false,
  winnerEntryId: input.winnerEntryId ?? null,
});

const coordinate = (
  round: number,
  slotInRound: number,
  side: BracketMatchSide
): BracketSwapCoordinate => ({ round, side, slotInRound });

/** Chave montada pelo sorteio → board das regras de move. */
const toBoardRow = (match: BuiltBracketMatch): SwapBoardMatch =>
  boardMatch({
    entryAId: match.entryAId,
    entryBId: match.entryBId,
    round: match.round,
    slotInRound: match.slotInRound,
    status: match.isVacant ? "vacant" : match.isBye ? "walkover" : "pending",
    walkover: match.isBye,
    winnerEntryId: match.winnerEntryId,
  });

/**
 * BUG-0034: chave sorteada com a 2ª rodada exibindo um lado DERIVADO do bye
 * da 1ª rodada (w venceu o bye do slot 0 e foi propagado para o lado A da
 * semi) ao lado de um confronto real (x vs y). É o card das quartas que o
 * organizador tenta mover.
 */
const byeDerivedBoard = (): SwapBoardMatch[] => [
  boardMatch({
    entryAId: "w",
    round: 1,
    slotInRound: 0,
    status: "walkover",
    walkover: true,
    winnerEntryId: "w",
  }),
  boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 1 }),
  boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
];

describe("nextBracketSize", () => {
  it("retorna no mínimo 2", () => {
    expect(nextBracketSize(0)).toBe(2);
    expect(nextBracketSize(1)).toBe(2);
    expect(nextBracketSize(2)).toBe(2);
  });

  it("arredonda para a próxima potência de 2", () => {
    expect(nextBracketSize(3)).toBe(4);
    expect(nextBracketSize(5)).toBe(8);
    expect(nextBracketSize(8)).toBe(8);
    expect(nextBracketSize(9)).toBe(16);
  });
});

describe("seedOrder", () => {
  it("posições clássicas: 1 e 2 só se encontram na final", () => {
    // bracket de 8: slots adjacentes (i, i^1) jogam na 1ª rodada
    const order = seedOrder(8);
    expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("semente 1 e 2 em extremos opostos", () => {
    const order = seedOrder(8);
    expect(order.indexOf(1)).toBe(0);
    expect(order.indexOf(2)).toBe(4);
  });
});

describe("validateSeedRanks", () => {
  it("aceita sem seeds", () => {
    expect(validateSeedRanks([entry("a"), entry("b")])).toBeNull();
  });

  it("aceita 1..s contínuo", () => {
    expect(
      validateSeedRanks([entry("a", 2), entry("b", 1), entry("c", 3)])
    ).toBeNull();
  });

  it("rejeita buraco na sequência", () => {
    expect(validateSeedRanks([entry("a", 1), entry("b", 3)])).toBe(
      "Os cabeças de chave precisam ser 1, 2, 3… sem buracos."
    );
  });

  it("rejeita duplicado", () => {
    expect(validateSeedRanks([entry("a", 1), entry("b", 1)])).toContain(
      "cabeças de chave"
    );
  });
});

describe("buildBracket", () => {
  it("recusa menos de 2 inscrições", () => {
    const result = buildBracket([entry("a")]);
    expect(result.error).toBe("A chave precisa de pelo menos 2 inscrições.");
    expect(result.bracket).toBeNull();
  });

  it("2 inscrições = 1 rodada (final direta), sem bye", () => {
    const { bracket, error } = buildBracket([entry("a"), entry("b")]);
    expect(error).toBeNull();
    expect(bracket?.roundCount).toBe(1);
    expect(bracket?.totalSlots).toBe(2);
    expect(bracket?.matches).toHaveLength(1);
    expect(bracket?.matches[0]).toMatchObject({
      entryAId: "a",
      entryBId: "b",
      isBye: false,
      winnerEntryId: null,
    });
  });

  it("3 inscrições = chave de 4 com 1 bye", () => {
    const { bracket, error } = buildBracket([
      entry("a"),
      entry("b"),
      entry("c"),
    ]);
    expect(error).toBeNull();
    expect(bracket?.totalSlots).toBe(4);
    const byes = bracket?.matches.filter((m) => m.isBye) ?? [];
    expect(byes).toHaveLength(1);
    expect(byes[0].winnerEntryId).toBeTruthy();
  });

  it("bye priorizado para o seed 1 (sem seeds marcados, bye cai no par do slot 0)", () => {
    // sem seeds: reservedByeSlots = {} inicialmente; bye sobra determinístico
    const { bracket } = buildBracket([entry("a"), entry("b"), entry("c")]);
    const bye = bracket?.matches.find((m) => m.isBye);
    expect(bye).toBeDefined();
    // bye tem exatamente um lado
    expect((bye?.entryAId === null) !== (bye?.entryBId === null)).toBeTrue();
  });

  it("bye vai para o adversário do seed 1 quando há seeds", () => {
    // 6 inscrições, chave de 8, 2 byes; seeds 1 e 2 recebem os byes
    const { bracket, error } = buildBracket([
      entry("s1", 1),
      entry("s2", 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
    ]);
    expect(error).toBeNull();
    expect(bracket?.totalSlots).toBe(8);

    const byes = bracket?.matches.filter((m) => m.isBye) ?? [];
    expect(byes).toHaveLength(2);
    const byeWinners = byes
      .map((m) => m.winnerEntryId)
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(byeWinners).toEqual(["s1", "s2"]);

    // seed 1 no slot 0 → seu par (slot 1) é bye
    const slotOfS1 = slotOfSeed(8, 1);
    const matchOfS1 = byes.find((m) => m.winnerEntryId === "s1");
    expect(matchOfS1?.round).toBe(1);
    // a partida do seed 1 está no slotInRound = floor(slotOfS1/2)
    expect(matchOfS1?.slotInRound).toBe(Math.floor(slotOfS1 / 2));
  });

  it("propaga vencedores de bye para a rodada seguinte", () => {
    const { bracket } = buildBracket([
      entry("s1", 1),
      entry("s2", 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
    ]);
    const semifinal1 = bracket?.matches.find(
      (m) => m.round === 2 && m.slotInRound === 0
    );
    // semifinal 1 recebe vencedor do bye do seed 1... e vencedor de a vs b?
    // seed 1 em slot 0 (par 0), seu bye alimenta a final da rodada 2 slot 0
    expect(semifinal1).toBeDefined();
    const sides = [semifinal1?.entryAId, semifinal1?.entryBId];
    // um dos lados é s1 (bye resolvido)
    expect(sides).toContain("s1");
  });

  it("semente 1 e 2 só se encontram na final", () => {
    const { bracket } = buildBracket([
      entry("s1", 1),
      entry("s2", 2),
      entry("a"),
      entry("b"),
    ]);
    const r1 = bracket?.matches.filter((m) => m.round === 1) ?? [];
    const s1Match = r1.find((m) => m.entryAId === "s1" || m.entryBId === "s1");
    const s2Match = r1.find((m) => m.entryAId === "s2" || m.entryBId === "s2");
    expect(s1Match?.slotInRound).not.toBe(s2Match?.slotInRound);
  });

  it("chave não terminada sem vencedor na final", () => {
    const { bracket } = buildBracket([entry("a"), entry("b")]);
    expect(isBracketFinished(bracket!)).toBeFalse();
  });
});

describe("validateSlotSwap", () => {
  const board = (withResult: number[] = []): SwapBoardMatch[] =>
    [0, 1].map((slot) =>
      boardMatch({
        entryAId: `a${slot}`,
        entryBId: `b${slot}`,
        hasPublishedResult: withResult.includes(slot),
        round: 1,
        slotInRound: slot,
      })
    );

  it("rejeita coordenadas iguais", () => {
    expect(
      validateSlotSwap({
        board: board(),
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 0, "a"),
      })
    ).toContain("diferentes");
  });

  it("rejeita coordenada fora da chave", () => {
    expect(
      validateSlotSwap({
        board: board(),
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 5, "a"),
      })
    ).toContain("inválida");
    expect(
      validateSlotSwap({
        board: board(),
        from: coordinate(1, -1, "a"),
        status: "drawn",
        to: coordinate(1, 0, "a"),
      })
    ).toContain("inválida");
  });

  it("bloqueia o move quando há placar publicado", () => {
    expect(
      validateSlotSwap({
        board: board([0]),
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("resultado publicado");
    expect(
      validateSlotSwap({
        board: board([1]),
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("resultado publicado");
  });

  it("aceita move sem placar (bye re-derivável não bloqueia)", () => {
    expect(
      validateSlotSwap({
        board: board(),
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toBeNull();
  });

  it("mesma rodada em ongoing é EXTINTA — a janela congela antes de tudo (IBX-0068)", () => {
    expect(
      validateSlotSwap({
        board: board(),
        from: coordinate(1, 0, "a"),
        status: "ongoing",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("congelado");
  });

  it("rejeita lado vazio como origem — o move permuta exatamente o lado clicado", () => {
    const withEmptySide = [
      boardMatch({ entryAId: "a0", round: 1, slotInRound: 0 }),
      boardMatch({ entryAId: "a1", entryBId: "b1", round: 1, slotInRound: 1 }),
    ];
    expect(
      validateSlotSwap({
        board: withEmptySide,
        from: coordinate(1, 0, "b"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("posição preenchida");
  });

  it("drawn: vaga derivada do bye é móvel como origem e como destino (BUG-0034)", () => {
    for (const [from, to] of [
      [coordinate(2, 0, "a"), coordinate(1, 1, "a")],
      [coordinate(1, 1, "a"), coordinate(2, 0, "a")],
    ] as const) {
      expect(
        validateSlotSwap({
          board: byeDerivedBoard(),
          from,
          status: "drawn",
          to,
        })
      ).toBeNull();
    }
  });

  it("recusa vaga derivada de resultado PUBLICADO como origem e como destino", () => {
    // Duas quartas cujos lados vieram de partidas JOGADAS (publicadas): o
    // avanço não é re-derivável e o move segue recusado — a recusa de vaga
    // derivada fica SÓ para resultado publicado (BUG-0034).
    const played = [
      boardMatch({
        entryAId: "w",
        entryBId: "z",
        hasPublishedResult: true,
        round: 1,
        slotInRound: 0,
        status: "finished",
        winnerEntryId: "w",
      }),
      boardMatch({
        entryAId: "v",
        entryBId: "u",
        hasPublishedResult: true,
        round: 1,
        slotInRound: 2,
        status: "finished",
        winnerEntryId: "v",
      }),
      boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
      boardMatch({ entryAId: "v", round: 2, slotInRound: 1 }),
    ];

    for (const [from, to] of [
      [coordinate(2, 0, "a"), coordinate(2, 1, "a")],
      [coordinate(2, 1, "a"), coordinate(2, 0, "a")],
    ] as const) {
      expect(
        validateSlotSwap({
          board: played,
          from,
          status: "drawn",
          to,
        })
      ).toContain("confronto já decidido");
    }

    // IBX-0068: em ongoing a JANELA congela antes de qualquer coisa — o move
    // (mesma rodada ou cruzado) recebe a recusa de chaveamento congelado.
    for (const [from, to] of [
      [coordinate(2, 0, "a"), coordinate(2, 1, "a")],
      [coordinate(2, 0, "a"), coordinate(1, 1, "a")],
    ] as const) {
      expect(
        validateSlotSwap({
          board: played,
          from,
          status: "ongoing",
          to,
        })
      ).toContain("congelado");
    }
  });
});

describe("validateSwapWindow (IBX-0068: congelamento no início)", () => {
  it("drawn aceita (mesma rodada e cruzado); qualquer outro status recusa", () => {
    for (const status of ["published", "ongoing", "finished", "cancelled"]) {
      expect(validateSwapWindow({ status })).toContain("congelado");
    }
    expect(validateSwapWindow({ status: "drawn" })).toBeNull();
  });
});

describe("applySlotSwap", () => {
  it("permuta os dois lados e re-deriva o bye da 1ª rodada", () => {
    // 1ª rodada: bye de w no slot 0 (par vazio); x vs y no slot 1.
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 1 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "a"),
    });
    // w troca de lugar com x e o bye é re-derivado com o sobrevivente.
    expect(patched[0]).toMatchObject({
      entryAId: "x",
      entryBId: null,
      status: "walkover",
      walkover: true,
      winnerEntryId: "x",
    });
    expect(patched[1]).toMatchObject({
      entryAId: "w",
      entryBId: "y",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // original intocado (pureza)
    expect(board[0].entryAId).toBe("w");
  });

  it("drawn: mover o lado das quartas vindo do bye desce até a posição e re-deriva (BUG-0034)", () => {
    const patched = applySlotSwap({
      board: byeDerivedBoard(),
      from: coordinate(2, 0, "a"),
      to: coordinate(1, 1, "a"),
    });
    // O bye muda de dono: x herda o avanço automático do slot 0.
    expect(patched[0]).toMatchObject({
      entryAId: "x",
      entryBId: null,
      status: "walkover",
      walkover: true,
      winnerEntryId: "x",
    });
    // w cai no confronto real da 1ª rodada.
    expect(patched[1]).toMatchObject({
      entryAId: "w",
      entryBId: "y",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // O lado derivado da 2ª rodada acompanha o novo dono do bye — o avanço é
    // re-derivado junto, nada fica apontando pro jogador que saiu.
    expect(patched[2]).toMatchObject({
      entryAId: "x",
      entryBId: null,
      status: "pending",
      winnerEntryId: null,
    });
  });

  it("drawn: troca dois lados de rodada 2 alimentados por byes diferentes (BUG-0034)", () => {
    // Dois byes (w no par 0, v no par 2) alimentando dois lados de rodada 2.
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({
        entryAId: "v",
        round: 1,
        slotInRound: 2,
        status: "walkover",
        walkover: true,
        winnerEntryId: "v",
      }),
      boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
      boardMatch({ entryAId: "v", round: 2, slotInRound: 1 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(2, 0, "a"),
      to: coordinate(2, 1, "a"),
    });
    // Cada bye troca de dono e cada avanço segue o seu.
    expect(patched[0]).toMatchObject({ entryAId: "v", winnerEntryId: "v" });
    expect(patched[1]).toMatchObject({ entryAId: "w", winnerEntryId: "w" });
    expect(patched[2]).toMatchObject({ entryAId: "v" });
    expect(patched[3]).toMatchObject({ entryAId: "w" });
    // As inscrições são as mesmas: só trocaram de vaga.
    expect(
      new Set(
        patched
          .flatMap((row) => [row.entryAId, row.entryBId])
          .filter((entryId) => entryId !== null)
      )
    ).toEqual(new Set(["w", "v"]));
  });

  it("move entre dois confrontos cheios não cria bye", () => {
    const board = [
      boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 0 }),
      boardMatch({ entryAId: "w", entryBId: "z", round: 1, slotInRound: 1 }),
    ];
    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "a"),
    });
    expect(patched[0]).toMatchObject({
      entryAId: "w",
      entryBId: "y",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
  });

  it("troca exatamente o lado clicado (B<->B)", () => {
    const board = [
      boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 0 }),
      boardMatch({ entryAId: "w", entryBId: "z", round: 1, slotInRound: 1 }),
    ];
    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "b"),
      to: coordinate(1, 1, "b"),
    });
    // Apenas o lado B troca — os lados A ficam nos seus confrontos.
    expect(patched[0]).toMatchObject({ entryAId: "x", entryBId: "z" });
    expect(patched[1]).toMatchObject({ entryAId: "w", entryBId: "y" });
  });

  it("troca lado A do primeiro com lado B do segundo (cruzado)", () => {
    const board = [
      boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 0 }),
      boardMatch({ entryAId: "w", entryBId: "z", round: 1, slotInRound: 1 }),
    ];
    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "b"),
    });
    // x (lado A do slot 0) troca com z (lado B do slot 1).
    expect(patched[0]).toMatchObject({ entryAId: "z", entryBId: "y" });
    expect(patched[1]).toMatchObject({ entryAId: "w", entryBId: "x" });
  });

  it("cross-round com destino vazio: a origem esvazia e o propagado é retirado", () => {
    // 1ª rodada: bye de w no slot 0 e subárvore PODADA no slot 1 (feed morto,
    // único tipo de lado vazio que aceita uma inscrição fora da 1ª rodada).
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(2, 0, "b"),
    });
    // A origem fica sem lados → vacant; w deixa de ser o vencedor propagado e
    // passa a ser uma POSIÇÃO do lado B da semi.
    expect(patched[0]).toMatchObject({
      entryAId: null,
      entryBId: null,
      status: "vacant",
      walkover: false,
      winnerEntryId: null,
    });
    expect(patched[2]).toMatchObject({
      entryAId: null,
      entryBId: "w",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
  });

  it("cross-round com destino ocupado: transposição (nada sai da chave)", () => {
    // 1ª rodada: bye de w (alimenta o lado A da semi) e x vs z no slot 2; s1
    // entrou direto na semi (lado B, subárvore do slot 1 podada).
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({
        entryAId: "w",
        entryBId: "s1",
        round: 2,
        slotInRound: 0,
      }),
      boardMatch({ entryAId: "x", entryBId: "z", round: 1, slotInRound: 2 }),
      boardMatch({ round: 2, slotInRound: 1 }),
      boardMatch({ round: 3, slotInRound: 0 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(2, 0, "b"),
      to: coordinate(1, 2, "a"),
    });
    expect(patched[2]).toMatchObject({ entryAId: "w", entryBId: "x" });
    expect(patched[3]).toMatchObject({ entryAId: "s1", entryBId: "z" });
    // As duas entradas continuam na chave: só trocaram de vaga.
    expect(
      patched.flatMap((row) => [row.entryAId, row.entryBId]).filter(Boolean)
        .length
    ).toBe(
      board.flatMap((row) => [row.entryAId, row.entryBId]).filter(Boolean)
        .length
    );
  });

  it("cross-round para vaga podada: a linha volta a pending, nunca a bye", () => {
    // A semi (r2s0) é podada (subárvore morta) e vira destino legítimo; s1
    // entra direto na outra semi e é a origem do move.
    const board = [
      boardMatch({ round: 1, slotInRound: 0, status: "vacant" }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ round: 2, slotInRound: 0, status: "vacant" }),
      boardMatch({ entryAId: "s1", round: 2, slotInRound: 1 }),
      boardMatch({ round: 3, slotInRound: 0 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(2, 1, "a"),
      to: coordinate(3, 0, "a"),
    });
    // A vaga vazia de rodada 3 recebe a entrada e fica "A definir", não bye.
    expect(patched[4]).toMatchObject({
      entryAId: "s1",
      entryBId: null,
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    expect(patched[3]).toMatchObject({
      entryAId: null,
      entryBId: null,
      status: "vacant",
    });
  });

  it("encher o lado vazio de um bye devolve a partida a pending e retira o propagado", () => {
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ entryAId: "x", entryBId: "y", round: 1, slotInRound: 1 }),
      boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(1, 1, "a"),
      to: coordinate(1, 0, "b"),
    });
    // O bye passa a confronto definido: w perde o avanço automático.
    expect(patched[0]).toMatchObject({
      entryAId: "w",
      entryBId: "x",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // x deixou o par e y NÃO assume o bye: a linha fica "A definir" (o move
    // nunca entrega W.O.) e w sai da 2ª rodada.
    expect(patched[1]).toMatchObject({
      entryAId: null,
      entryBId: "y",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    expect(patched[2]).toMatchObject({
      entryAId: null,
      entryBId: null,
      winnerEntryId: null,
    });
  });

  it("tirar um jogador da 1ª rodada NÃO auto-avanca o adversário (IBX-0053)", () => {
    // m1-0 com A vs B; m1-1 é o bye do sorteio (C sozinho), que alimenta o
    // lado B da semi.
    const board = [
      boardMatch({ entryAId: "A", entryBId: "B", round: 1, slotInRound: 0 }),
      boardMatch({
        entryAId: "C",
        round: 1,
        slotInRound: 1,
        status: "walkover",
        walkover: true,
        winnerEntryId: "C",
      }),
      boardMatch({ entryBId: "C", round: 2, slotInRound: 0 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "b"),
    });

    // A origem fica "A definir": B NÃO ganha W.O. e não avança.
    expect(patched[0]).toMatchObject({
      entryAId: null,
      entryBId: "B",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // Encher o lado vazio do bye devolve a partida a pending e retira o
    // avanço automático de C.
    expect(patched[1]).toMatchObject({
      entryAId: "C",
      entryBId: "A",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    expect(patched[2]).toMatchObject({
      entryAId: null,
      entryBId: null,
      winnerEntryId: null,
    });
  });

  it("recusa destino vazio cujo confronto de baixo ainda vai decidir o vencedor", () => {
    // O lado B da semi espera o vencedor de m1-1 (vivo, sem vencedor): a
    // inscrição movida seria sobrescrita quando esse confronto publicasse.
    const board = [
      boardMatch({ entryAId: "p", entryBId: "q", round: 1, slotInRound: 1 }),
      boardMatch({ entryAId: "s1", round: 2, slotInRound: 0 }),
    ];
    expect(
      validateSlotSwap({
        board,
        from: coordinate(1, 1, "a"),
        status: "drawn",
        to: coordinate(2, 0, "b"),
      })
    ).toContain("vencedor do confronto de baixo");
  });

  it("recusa COMPLETAR uma linha podada quando o vencedor cairia na vaga da entrada direta", () => {
    // Chave 8 com seed1 direto na FINAL: a semi r2s0 está podada e o lado A da
    // final pertence a seed1. Preencher UM lado da linha podada é o contrato
    // (fica "A definir"); torná-la um confronto JOGÁVEL colidiria com a vaga
    // ocupada acima — publicar a semi sobrescreveria seed1 e ele sumiria.
    const board = [
      boardMatch({ round: 1, slotInRound: 0, status: "vacant" }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "p", entryBId: "p2", round: 1, slotInRound: 2 }),
      boardMatch({ entryAId: "q", entryBId: "q2", round: 1, slotInRound: 3 }),
      boardMatch({ round: 2, slotInRound: 0, status: "vacant" }),
      boardMatch({ entryAId: "seed1", round: 3, slotInRound: 0 }),
    ];

    const filled = applySlotSwap({
      board,
      from: coordinate(1, 2, "a"),
      to: coordinate(2, 0, "a"),
    });
    expect(filled[4]).toMatchObject({
      entryAId: "p",
      entryBId: null,
      status: "pending",
    });

    expect(
      validateSlotSwap({
        board: filled,
        from: coordinate(1, 3, "a"),
        status: "drawn",
        to: coordinate(2, 0, "b"),
      })
    ).toContain("vaga já ocupada");
  });

  it("recusa o move quando a rodada seguinte já tem resultado publicado", () => {
    // Sem L2: o bye de C ainda está propagado para o lado A da semi, que já
    // foi jogada — retirar o avanço reescreveria uma partida publicada.
    const board = [
      boardMatch({
        entryAId: "C",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "C",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({
        entryAId: "C",
        entryBId: "D",
        hasPublishedResult: true,
        round: 2,
        slotInRound: 0,
      }),
    ];

    expect(
      validateSlotSwap({
        board,
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("resultado publicado");
  });
});

describe("deriveSwapMatchStatus", () => {
  it("preserva o estado de partida com resultado publicado", () => {
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: "b",
        hasPublishedResult: true,
        originalStatus: "finished",
      })
    ).toBe("finished");
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: null,
        hasPublishedResult: true,
        originalStatus: "walkover",
      })
    ).toBe("walkover");
  });

  it("agenda morre com a dupla: partida agendada volta a pending", () => {
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: "b",
        hasPublishedResult: false,
        originalStatus: "scheduled",
      })
    ).toBe("pending");
  });

  it("1ª rodada: o bye do sorteio segue bye, a linha esvaziada pelo move não", () => {
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: null,
        hasPublishedResult: false,
        originalStatus: "walkover",
      })
    ).toBe("walkover");
    // Dois lados no bye = confronto definido (o avanço automático morre).
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: "b",
        hasPublishedResult: false,
        originalStatus: "walkover",
      })
    ).toBe("pending");
    // Linha que NÃO era bye e perdeu um lado: "A definir", sem W.O. para o
    // adversário.
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: null,
        hasPublishedResult: false,
        originalStatus: "pending",
      })
    ).toBe("pending");
    expect(
      deriveSwapMatchStatus({
        entryAId: null,
        entryBId: null,
        hasPublishedResult: false,
        originalStatus: "pending",
      })
    ).toBe("vacant");
  });

  it("rodada 2+ com um lado fica 'A definir' — nunca vira bye", () => {
    expect(
      deriveSwapMatchStatus({
        entryAId: "a",
        entryBId: null,
        hasPublishedResult: false,
        originalStatus: "pending",
      })
    ).toBe("pending");
  });
});

describe("buildSwapPersistPlan", () => {
  // 1ª rodada: bye de w (m1-0) e x vs y (m1-1); a 2ª rodada recebe o bye.
  // m1-2 está agendada e o move não a toca.
  const board = [
    boardMatch({
      entryAId: "w",
      round: 1,
      slotInRound: 0,
      status: "walkover",
      walkover: true,
      winnerEntryId: "w",
    }),
    boardMatch({
      entryAId: "x",
      entryBId: "y",
      round: 1,
      slotInRound: 1,
      status: "scheduled",
    }),
    boardMatch({
      entryAId: "p",
      entryBId: "q",
      round: 1,
      slotInRound: 2,
      status: "scheduled",
    }),
    boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
  ];

  it("escreve as duas partidas reescritas e a vaga que recebe o vencedor", () => {
    const plan = buildSwapPersistPlan({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "a"),
    });

    // A partida intocada (m1-2, agendada) fica FORA do plano: a agenda só
    // morre com os pares que o move reescreveu (BUG-0028).
    expect(plan.updates.map((update) => update.id).sort()).toEqual([
      "m1-0",
      "m1-1",
      "m2-0",
    ]);
    expect(plan.updates.find((update) => update.id === "m1-1")).toMatchObject({
      bumpRowVersion: false,
      entryAId: "w",
      entryBId: "y",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    expect(plan.updates.find((update) => update.id === "m2-0")).toMatchObject({
      bumpRowVersion: true,
      entryAId: "x",
    });
  });

  it("notifica os dois lados clicados", () => {
    const plan = buildSwapPersistPlan({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(1, 1, "a"),
    });
    expect(plan.affectedEntryIds.sort()).toEqual(["w", "x", "y"]);
  });

  it("cross-round: vacância da origem e vaga decidida entram no plano", () => {
    // O destino (lado B da semi) só aceita a inscrição porque a subárvore que
    // o alimenta é podada (feed morto).
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "w", round: 2, slotInRound: 0 }),
    ];
    const plan = buildSwapPersistPlan({
      board,
      from: coordinate(1, 0, "a"),
      to: coordinate(2, 0, "b"),
    });

    expect(plan.updates.map((update) => update.id).sort()).toEqual([
      "m1-0",
      "m2-0",
    ]);
    expect(plan.updates.find((update) => update.id === "m1-0")).toMatchObject({
      entryAId: null,
      status: "vacant",
    });
    expect(plan.updates.find((update) => update.id === "m2-0")).toMatchObject({
      bumpRowVersion: false,
      entryAId: null,
      entryBId: "w",
      status: "pending",
    });
    // w trocou de vaga: os jogadores dele precisam saber.
    expect(plan.affectedEntryIds).toEqual(["w"]);
  });

  it("BUG-0034: move de vaga derivada persiste o bye e o avanço re-derivados", () => {
    const plan = buildSwapPersistPlan({
      board: byeDerivedBoard(),
      from: coordinate(2, 0, "a"),
      to: coordinate(1, 1, "a"),
    });

    // As três linhas que o move reescreveu: o bye (novo dono), o confronto
    // real e o lado da 2ª rodada que recebe o avanço re-derivado.
    expect(plan.updates.map((update) => update.id).sort()).toEqual([
      "m1-0",
      "m1-1",
      "m2-0",
    ]);
    expect(plan.updates.find((update) => update.id === "m1-0")).toMatchObject({
      bumpRowVersion: false,
      entryAId: "x",
      status: "walkover",
      winnerEntryId: "x",
    });
    expect(plan.updates.find((update) => update.id === "m2-0")).toMatchObject({
      bumpRowVersion: true,
      entryAId: "x",
    });
    // w e x trocaram de vaga; y segue no confronto real que agora tem w.
    expect(plan.affectedEntryIds.sort()).toEqual(["w", "x", "y"]);
  });
});

describe("validateBracketStartable (gate do IBX-0053)", () => {
  it("chave recém-sorteada pode iniciar: bye, linha podada e lado esperando o vencedor", () => {
    const plain = buildBracket([
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(
      validateBracketStartable(plain.bracket!.matches.map(toBoardRow))
    ).toBeNull();

    // Entrada direta na 2ª rodada: a semi tem um cabeça assentado e o lado
    // que espera o vencedor de baixo — estado normal, não vaga em aberto.
    const direct = buildBracket([
      entry("s1", 1, 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(
      validateBracketStartable(direct.bracket!.matches.map(toBoardRow))
    ).toBeNull();
  });

  it("recusa vaga 'A definir' na 1ª rodada (linha esvaziada pelo move)", () => {
    // Único defeito da chave: B sozinho na 1ª rodada — a partida nunca mais
    // terá dois lados, então o publishResult nunca aceitaria a rodada dela.
    const board = [
      boardMatch({ entryBId: "B", round: 1, slotInRound: 0 }),
      boardMatch({ entryAId: "C", entryBId: "D", round: 1, slotInRound: 1 }),
      boardMatch({ round: 2, slotInRound: 0 }),
    ];
    expect(validateBracketStartable(board)).toContain("vaga em aberto");
  });

  it("recusa vaga 'A definir' que nenhuma partida pode alimentar", () => {
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "w", entryBId: "s1", round: 2, slotInRound: 0 }),
      boardMatch({ round: 2, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "s2", round: 3, slotInRound: 0 }),
    ];
    expect(validateBracketStartable(board)).toContain("vaga em aberto");
  });
});

describe("invariantes do move (IBX-0053)", () => {
  it("nenhum move descarta nem duplica inscrição (varredura das coordenadas)", () => {
    // Chave real: 6 inscrições com o cabeça 1 entrando direto na 2ª rodada
    // (linhas podadas + bye) — o cenário mais torto que o sorteio produz.
    const { bracket, error } = buildBracket([
      entry("s1", 1, 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(error).toBeNull();
    const board = bracket!.matches.map(toBoardRow);
    const boardEntryIds = new Set(
      board
        .flatMap((row) => [row.entryAId, row.entryBId])
        .filter((entryId) => entryId !== null)
    );
    const coordinates = board.flatMap((row) =>
      (["a", "b"] as const).map((side) =>
        coordinate(row.round, row.slotInRound, side)
      )
    );
    let applied = 0;

    for (const from of coordinates) {
      for (const to of coordinates) {
        if (validateSlotSwap({ board, from, status: "drawn", to })) {
          continue;
        }
        applied += 1;
        const patched = applySlotSwap({ board, from, to });
        // As inscrições são as MESMAS: o move troca de vaga, nunca descarta
        // nem duplica (regra do contrato).
        expect(
          new Set(
            patched
              .flatMap((row) => [row.entryAId, row.entryBId])
              .filter((entryId) => entryId !== null)
          )
        ).toEqual(boardEntryIds);
        for (const row of patched) {
          if (row.walkover) {
            expect(row.round).toBe(1);
            expect([row.entryAId, row.entryBId].filter(Boolean)).toHaveLength(
              1
            );
          }
        }
      }
    }

    expect(applied).toBeGreaterThan(0);
  });
});

describe("nextMatchCoordinates", () => {
  it("deriva a partida seguinte", () => {
    expect(nextMatchCoordinates(1, 0)).toEqual({ round: 2, slotInRound: 0 });
    expect(nextMatchCoordinates(1, 1)).toEqual({ round: 2, slotInRound: 0 });
    expect(nextMatchCoordinates(1, 2)).toEqual({ round: 2, slotInRound: 1 });
    expect(nextMatchCoordinates(2, 1)).toEqual({ round: 3, slotInRound: 0 });
  });
});

// ---------------------------------------------------------------------------
// H1 regression: bye distribution must put ONE bye per 1st-round pair and
// the bracket must always be completable (finished with a champion), for
// every entry count and with/without seeds.
// ---------------------------------------------------------------------------

/** Plays out every non-bye match deterministically (first side wins). */
function playOutToFinish(
  bracket: NonNullable<ReturnType<typeof buildBracket>["bracket"]>
) {
  const winners = new Map<string, string>();
  const byRound = new Map<number, BuiltBracketMatch[]>();
  for (const match of bracket.matches) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  for (let round = 1; round <= bracket.roundCount; round += 1) {
    for (const match of byRound.get(round) ?? []) {
      let winner: string | null = match.winnerEntryId;
      if (!winner) {
        const a =
          match.entryAId ??
          winners.get(`${round - 1}:${match.slotInRound * 2}`) ??
          null;
        const b =
          match.entryBId ??
          winners.get(`${round - 1}:${match.slotInRound * 2 + 1}`) ??
          null;
        winner = a ?? b;
      }
      if (winner) {
        winners.set(`${round}:${match.slotInRound}`, winner);
      }
    }
  }
  return winners.get(`${bracket.roundCount}:0`) ?? null;
}

describe("buildBracket H1 — one bye per pair, always finishable", () => {
  const COUNTS = [5, 6, 7, 9, 12] as const;

  for (const count of COUNTS) {
    it(`${count} entries SEM seeds: no máx. 1 bye por par e campeão definido`, () => {
      const entries = Array.from({ length: count }, (_, i) => entry(`p${i}`));
      const { bracket, error } = buildBracket(entries);
      expect(error).toBeNull();
      const firstRound = bracket!.matches.filter((m) => m.round === 1);
      for (const [pairIndex, match] of firstRound.entries()) {
        const sides = [match.entryAId, match.entryBId];
        const byesInMatch = sides.filter((side) => side === null).length;
        expect(byesInMatch).toBeLessThanOrEqual(1);
        expect(pairIndex).toBe(match.slotInRound);
      }
      const champion = playOutToFinish(bracket!);
      expect(champion).not.toBeNull();
      expect(isBracketFinished(bracket!)).toBeFalse(); // final still open pre-play
    });

    it(`${count} entries COM seeds (1 e 2): byes opostos aos seeds e campeão definido`, () => {
      const entries = Array.from({ length: count }, (_, i) =>
        entry(`p${i}`, i === 0 ? 1 : i === 1 ? 2 : null)
      );
      const { bracket, error } = buildBracket(entries);
      expect(error).toBeNull();
      const firstRound = bracket!.matches.filter((m) => m.round === 1);
      for (const match of firstRound) {
        const sides = [match.entryAId, match.entryBId];
        expect(
          sides.filter((side) => side === null).length
        ).toBeLessThanOrEqual(1);
      }
      // Seeds 1 e 2 nunca se enfrentam na 1ª rodada.
      const s1 = firstRound.find(
        (m) => m.entryAId === "p0" || m.entryBId === "p0"
      );
      const s2 = firstRound.find(
        (m) => m.entryAId === "p1" || m.entryBId === "p1"
      );
      expect(s1?.slotInRound).not.toBe(s2?.slotInRound);
      expect(playOutToFinish(bracket!)).not.toBeNull();
    });
  }

  it("12 entries SEM seeds: exatamente 4 byes (16-12), um por par", () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry(`p${i}`));
    const { bracket } = buildBracket(entries);
    const byes = bracket!.matches.filter((m) => m.round === 1 && m.isBye);
    expect(byes).toHaveLength(4);
    expect(new Set(byes.map((m) => m.slotInRound)).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// IBX-0035 (PLN-0004): direct phase entry — a head of seed enters the
// bracket at its entry round; the feeding subtree becomes VACANT rows and
// each skipped round consumes one forced bye.
// ---------------------------------------------------------------------------

describe("validateEntryRounds", () => {
  it("aceita chaves sem entrada direta", () => {
    expect(validateEntryRounds([entry("a"), entry("b", 1)])).toBeNull();
  });

  it("aceita salto dentro do orçamento de byes", () => {
    // 5 entries → chave de 8 → 3 byes; 3 cabeças pulando 1 rodada custam 3
    const entries = [
      entry("a", 1, 2),
      entry("b", 2, 2),
      entry("c", 3, 2),
      entry("d"),
      entry("e"),
    ];
    expect(validateEntryRounds(entries)).toBeNull();
  });

  it("exige seed para avançar de fase", () => {
    expect(
      validateEntryRounds([entry("a"), entry("b"), entry("c", null, 2)])
    ).toBe("Avanço de fase é exclusivo de cabeças de chave.");
  });

  it("rejeita fase que não existe na chave", () => {
    // 4 entries → chave de 4 → 2 rodadas; fase 3 não existe
    expect(
      validateEntryRounds([
        entry("a", 1, 3),
        entry("b", 2),
        entry("c"),
        entry("d"),
      ])
    ).toBe("A fase de entrada escolhida não existe nessa chave.");
  });

  it("rejeita saltos que excedem os byes forçados", () => {
    // 5 entries → chave de 8 → 3 byes; 4 cabeças pulando 1 rodada custam 4
    const entries = [
      entry("a", 1, 2),
      entry("b", 2, 2),
      entry("c", 3, 2),
      entry("d", 4, 2),
      entry("e"),
    ];
    expect(validateEntryRounds(entries)).toBe(
      "Os avanços de fase excedem as vagas livres da chave."
    );
  });

  it("rejeita bloco contido na região de outra entrada direta (review C1/H1)", () => {
    // 9 entries → chave de 16; seed 3 entra na R3 (bloco [12..15]) e seed 6
    // na R2 (bloco [14..15], DENTRO do outro) — o confronto ficaria com um
    // lado morto e a chave nunca terminaria
    const entries: BracketSeedEntry[] = [
      entry("s1", 1),
      entry("s2", 2),
      entry("s3", 3, 3),
      entry("s4", 4),
      entry("s5", 5),
      entry("s6", 6, 2),
      entry("p0"),
      entry("p1"),
      entry("p2"),
    ];
    expect(validateEntryRounds(entries)).toBe(
      "Uma entrada direta está dentro da região de outra na chave. Ajuste as fases delas."
    );
  });

  it("aceita blocos disjuntos de rodadas diferentes", () => {
    // seed 1 na R2 (bloco [0..1]) + seed 2 na R3 (bloco [4..7]): disjuntos
    const entries: BracketSeedEntry[] = [
      entry("s1", 1, 2),
      entry("s2", 2, 3),
      entry("p0"),
      entry("p1"),
      entry("p2"),
      entry("p3"),
      entry("p4"),
      entry("p5"),
      entry("p6"),
    ];
    expect(validateEntryRounds(entries)).toBeNull();
    const { bracket, error } = buildBracket(entries);
    expect(error).toBeNull();
    expect(playOutToFinish(bracket!)).not.toBeNull();
  });
});

describe("validateSwapCategoryOwnership (review C1)", () => {
  it("aceita categoria do próprio torneio", () => {
    expect(
      validateSwapCategoryOwnership({
        categoryTournamentId: "t1",
        tournamentId: "t1",
      })
    ).toBeNull();
  });

  it("rejeita categoria de outro torneio (IDOR cross-tenant)", () => {
    expect(
      validateSwapCategoryOwnership({
        categoryTournamentId: "t2",
        tournamentId: "t1",
      })
    ).toBe("Categoria não encontrada nesse torneio.");
  });
});

describe("buildBracket IBX-0035 — entrada direta de fase", () => {
  it("cabeças 1 e 2 direto na 2ª rodada: região abaixo vira vaga vazia", () => {
    // 6 entries → chave de 8; custo 2 consome os 2 byes forçados
    const { bracket, error } = buildBracket([
      entry("s1", 1, 2),
      entry("s2", 2, 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
    ]);
    expect(error).toBeNull();
    expect(bracket?.totalSlots).toBe(8);

    const match = (round: number, slotInRound: number) =>
      bracket?.matches.find(
        (m) => m.round === round && m.slotInRound === slotInRound
      );

    // Confrontos que alimentariam os cabeças ficam VACANT (sem lados)
    expect(match(1, 0)).toMatchObject({
      entryAId: null,
      entryBId: null,
      isVacant: true,
      winnerEntryId: null,
    });
    expect(match(1, 2)).toMatchObject({ isVacant: true });

    // Demais confrontos da 1ª rodada seguem normais (4 jogadores)
    expect(match(1, 1)).toMatchObject({ isVacant: false });
    expect(match(1, 1)?.entryAId).not.toBeNull();
    expect(match(1, 1)?.entryBId).not.toBeNull();
    expect(match(1, 3)).toMatchObject({ isVacant: false });

    // Cabeças ocupam seus slots na 2ª rodada, esperando adversário —
    // não é bye (tem jogo vindo por baixo)
    expect(match(2, 0)).toMatchObject({
      entryAId: "s1",
      entryBId: null,
      isBye: false,
      isVacant: false,
    });
    expect(match(2, 1)).toMatchObject({
      entryAId: "s2",
      entryBId: null,
      isBye: false,
      isVacant: false,
    });

    // Os 2 byes forçados foram consumidos pelos saltos
    expect(bracket?.matches.filter((m) => m.isBye)).toHaveLength(0);

    // Invariante: vaga vazia nunca tem lado nem vencedor
    for (const m of bracket?.matches ?? []) {
      if (m.isVacant) {
        expect(m.entryAId).toBeNull();
        expect(m.entryBId).toBeNull();
        expect(m.winnerEntryId).toBeNull();
      }
    }
  });

  it("entrada direta consome bye: sobra exatamente 1 bye pros demais", () => {
    // 6 entries → chave de 8 → 2 byes forçados; 1 salto consome 1
    const { bracket, error } = buildBracket([
      entry("s1", 1, 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(error).toBeNull();
    const byes = bracket?.matches.filter((m) => m.isBye) ?? [];
    expect(byes).toHaveLength(1);
    expect(byes[0].round).toBe(1);
    // Campeão ainda definível com a chave inteira
    expect(playOutToFinish(bracket!)).not.toBeNull();
  });

  it("cabeças na mesma linha se enfrentam na fase de entrada", () => {
    // 20 entries → chave de 32; seeds 1 e 8 entram nas quartas (rodada 3)
    // e se encontram lá — posições padrão os colocam no mesmo confronto
    const entries: BracketSeedEntry[] = [
      entry("s1", 1, 3),
      entry("s2", 2),
      entry("s3", 3),
      entry("s4", 4),
      entry("s5", 5),
      entry("s6", 6),
      entry("s7", 7),
      entry("s8", 8, 3),
    ];
    for (let i = 0; i < 12; i += 1) {
      entries.push(entry(`p${i}`));
    }
    const { bracket, error } = buildBracket(entries);
    expect(error).toBeNull();

    const quarter = bracket?.matches.find(
      (m) => m.round === 3 && m.slotInRound === 0
    );
    expect(quarter).toMatchObject({ entryAId: "s1", entryBId: "s8" });

    // Subárvores podadas: 3 confrontos vacant por cabeça (2 na R1 + 1 na R2)
    expect(bracket?.matches.filter((m) => m.isVacant)).toHaveLength(6);
    expect(playOutToFinish(bracket!)).not.toBeNull();
  });

  it("rejeita dois cabeças disputando a mesma vaga na fase de entrada", () => {
    // 12 entries → chave de 16; seeds 8 e 9 se enfrentariam na 1ª rodada
    // (slots 2 e 3) — ambos pulando para a 2ª disputam o mesmo side-slot
    const entries: BracketSeedEntry[] = [
      entry("s1", 1),
      entry("s2", 2),
      entry("s3", 3),
      entry("s4", 4),
      entry("s5", 5),
      entry("s6", 6),
      entry("s7", 7),
      entry("s8", 8, 2),
      entry("s9", 9, 2),
    ];
    for (let i = 0; i < 3; i += 1) {
      entries.push(entry(`p${i}`));
    }
    const { bracket, error } = buildBracket(entries);
    expect(error).toContain("mesma vaga");
    expect(bracket).toBeNull();
  });

  it("rejeita seed da 1ª rodada com posição absorvida por entrada direta", () => {
    // 9 entries → chave de 16; seed 1 pula pra rodada 3 e poda os slots
    // 0..3 — o seed 8 (slot 2) fica sem posição na 1ª rodada
    const entries: BracketSeedEntry[] = [
      entry("s1", 1, 3),
      entry("s2", 2),
      entry("s3", 3),
      entry("s4", 4),
      entry("s5", 5),
      entry("s6", 6),
      entry("s7", 7),
      entry("s8", 8),
      entry("p0"),
    ];
    const { bracket, error } = buildBracket(entries);
    expect(error).toContain("ficou sem posição");
    expect(bracket).toBeNull();
  });
});

describe("applySlotSwap IBX-0035 — mesma rodada", () => {
  it("troca entradas diretas na rodada 2 sem derivar bye", () => {
    // s1/s2 entraram direto na 2ª rodada (a subárvore abaixo é podada): são
    // POSIÇÕES do sorteio, não vitórias propagadas — podem trocar de lado.
    const board = [
      boardMatch({
        entryAId: "w",
        round: 1,
        slotInRound: 0,
        status: "walkover",
        walkover: true,
        winnerEntryId: "w",
      }),
      boardMatch({ round: 1, slotInRound: 1, status: "vacant" }),
      boardMatch({ entryAId: "s1", round: 2, slotInRound: 0 }),
      boardMatch({ entryAId: "s2", round: 2, slotInRound: 1 }),
    ];

    const patched = applySlotSwap({
      board,
      from: coordinate(2, 0, "a"),
      to: coordinate(2, 1, "a"),
    });
    // lado preenchido + lado esperando adversário NÃO é bye na rodada 2+
    expect(patched[2]).toMatchObject({
      entryAId: "s2",
      entryBId: null,
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    expect(patched[3]).toMatchObject({
      entryAId: "s1",
      entryBId: null,
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
  });

  it("vaga vazia nunca é selecionável (lado vazio é recusado)", () => {
    const board = [
      boardMatch({ round: 1, slotInRound: 0, status: "vacant" }),
      boardMatch({ entryAId: "a", entryBId: "b", round: 1, slotInRound: 1 }),
    ];
    expect(
      validateSlotSwap({
        board,
        from: coordinate(1, 0, "a"),
        status: "drawn",
        to: coordinate(1, 1, "a"),
      })
    ).toContain("posição preenchida");
  });
});

describe("re-sorteio em drawn (IBX-0037)", () => {
  it("canDrawTournament aceita published e drawn, recusa os demais", () => {
    expect(canDrawTournament("published")).toBeTrue();
    expect(canDrawTournament("drawn")).toBeTrue();
    expect(canDrawTournament("draft")).toBeFalse();
    expect(canDrawTournament("ongoing")).toBeFalse();
    expect(canDrawTournament("finished")).toBeFalse();
    expect(canDrawTournament("cancelled")).toBeFalse();
  });

  it("re-draw com fases ajustadas monta chave nova e completa", () => {
    // 1º sorteio: seed 1 entra direto na 2ª rodada
    const firstDraw = buildBracket([
      entry("s1", 1, 2),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(firstDraw.error).toBeNull();
    expect(
      firstDraw.bracket?.matches.find(
        (m) => m.round === 2 && m.slotInRound === 0
      )?.entryAId
    ).toBe("s1");

    // Organizador remove a fase (volta pra 1ª rodada) e RE-SORTEIA:
    // mesma regra pura, estado novo — chave remontada do zero
    const secondDraw = buildBracket([
      entry("s1", 1),
      entry("a"),
      entry("b"),
      entry("c"),
      entry("d"),
      entry("e"),
    ]);
    expect(secondDraw.error).toBeNull();
    expect(secondDraw.bracket?.matches.filter((m) => m.isVacant)).toHaveLength(
      0
    );
    // seed 1 volta pra 1ª rodada no slot padrão (com bye do par)
    const s1Match = secondDraw.bracket?.matches.find(
      (m) => m.round === 1 && (m.entryAId === "s1" || m.entryBId === "s1")
    );
    expect(s1Match?.slotInRound).toBe(Math.floor(slotOfSeed(8, 1) / 2));
    expect(secondDraw.bracket?.matches.filter((m) => m.isBye)).toHaveLength(2);
    expect(playOutToFinish(secondDraw.bracket!)).not.toBeNull();
  });
});

describe("buildBracket H1 com entrada direta", () => {
  for (const count of [6, 7, 12] as const) {
    it(`${count} entries com seed 1 direto na 2ª rodada: 1 bye por par vivo e campeão definido`, () => {
      const entries = Array.from({ length: count }, (_, i) =>
        entry(`p${i}`, i === 0 ? 1 : null, i === 0 ? 2 : null)
      );
      const { bracket, error } = buildBracket(entries);
      expect(error).toBeNull();
      for (const match of bracket!.matches.filter((m) => m.round === 1)) {
        if (match.isVacant) {
          continue;
        }
        const sides = [match.entryAId, match.entryBId];
        expect(
          sides.filter((side) => side === null).length
        ).toBeLessThanOrEqual(1);
      }
      expect(playOutToFinish(bracket!)).not.toBeNull();
    });
  }
});
