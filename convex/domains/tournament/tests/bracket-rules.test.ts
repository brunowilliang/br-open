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
  validateEntryRounds,
  validateSeedRanks,
  validateSlotSwap,
  validateSwapCategoryOwnership,
  type BracketSeedEntry,
  type BuiltBracketMatch,
  type SwapCheckMatch,
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
  const matches = (withResult: number[] = []): SwapCheckMatch[] =>
    [0, 1].map((slot) => ({
      entryAId: `a${slot}`,
      entryBId: `b${slot}`,
      hasPublishedResult: withResult.includes(slot),
      matchDate: null,
      round: 1,
      slotInRound: slot,
      status: "pending",
      winnerEntryId: null,
    }));

  it("rejeita slots iguais", () => {
    expect(validateSlotSwap(matches(), 0, "a", 0, "a")).toContain("diferentes");
  });

  it("rejeita slot fora da rodada 1", () => {
    expect(validateSlotSwap(matches(), 0, "a", 5, "a")).toContain("inválida");
    expect(validateSlotSwap(matches(), -1, "a", 0, "a")).toContain("inválida");
  });

  it("bloqueia swap quando há placar publicado", () => {
    expect(validateSlotSwap(matches([0]), 0, "a", 1, "a")).toContain(
      "resultado publicado"
    );
    expect(validateSlotSwap(matches([1]), 0, "a", 1, "a")).toContain(
      "resultado publicado"
    );
  });

  it("aceita swap sem placar (bye re-derivável não bloqueia)", () => {
    expect(validateSlotSwap(matches(), 0, "a", 1, "a")).toBeNull();
  });

  it("rejeita lado vazio — o swap move exatamente o jogador clicado", () => {
    const withEmptySide: SwapCheckMatch[] = [
      {
        entryAId: "a0",
        entryBId: null,
        hasPublishedResult: false,
        matchDate: null,
        round: 1,
        slotInRound: 0,
        status: "pending",
        winnerEntryId: null,
      },
      {
        entryAId: "a1",
        entryBId: "b1",
        hasPublishedResult: false,
        matchDate: null,
        round: 1,
        slotInRound: 1,
        status: "pending",
        winnerEntryId: null,
      },
    ];
    expect(validateSlotSwap(withEmptySide, 0, "b", 1, "a")).toContain(
      "posição preenchida"
    );
  });
});

describe("applySlotSwap", () => {
  it("troca as entradas dos dois slots e re-deriva byes", () => {
    const firstRound = [
      {
        entryAId: "s1",
        entryBId: null,
        isBye: true,
        isVacant: false,
        round: 1,
        slotInRound: 0,
        winnerEntryId: "s1",
      },
      {
        entryAId: "a",
        entryBId: "b",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 1,
        winnerEntryId: null,
      },
    ];

    const patched = applySlotSwap(firstRound, 0, "a", 1, "a");
    // s1 troca de lugar com a
    expect(patched[0]).toMatchObject({
      entryAId: "a",
      entryBId: null,
      isBye: true,
      winnerEntryId: "a",
    });
    expect(patched[1]).toMatchObject({
      entryAId: "s1",
      entryBId: "b",
      isBye: false,
      winnerEntryId: null,
    });
    // original intocado (pureza)
    expect(firstRound[0].entryAId).toBe("s1");
  });

  it("swap entre dois confrontos cheios remove byes inexistentes", () => {
    const firstRound = [
      {
        entryAId: "x",
        entryBId: "y",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 0,
        winnerEntryId: null,
      },
      {
        entryAId: "w",
        entryBId: "z",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 1,
        winnerEntryId: null,
      },
    ];
    const patched = applySlotSwap(firstRound, 0, "a", 1, "a");
    expect(patched[0]).toMatchObject({
      entryAId: "w",
      entryBId: "y",
      isBye: false,
      winnerEntryId: null,
    });
  });

  it("troca exatamente o jogador clicado no lado B (B<->B)", () => {
    const firstRound = [
      {
        entryAId: "x",
        entryBId: "y",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 0,
        winnerEntryId: null,
      },
      {
        entryAId: "w",
        entryBId: "z",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 1,
        winnerEntryId: null,
      },
    ];
    const patched = applySlotSwap(firstRound, 0, "b", 1, "b");
    // Apenas o lado B troca — os lados A ficam nos seus confrontos.
    expect(patched[0]).toMatchObject({ entryAId: "x", entryBId: "z" });
    expect(patched[1]).toMatchObject({ entryAId: "w", entryBId: "y" });
  });

  it("troca lado A do primeiro com lado B do segundo (cruzado)", () => {
    const firstRound = [
      {
        entryAId: "x",
        entryBId: "y",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 0,
        winnerEntryId: null,
      },
      {
        entryAId: "w",
        entryBId: "z",
        isBye: false,
        isVacant: false,
        round: 1,
        slotInRound: 1,
        winnerEntryId: null,
      },
    ];
    const patched = applySlotSwap(firstRound, 0, "a", 1, "b");
    // x (lado A do slot 0) troca com z (lado B do slot 1).
    expect(patched[0]).toMatchObject({ entryAId: "z", entryBId: "y" });
    expect(patched[1]).toMatchObject({ entryAId: "w", entryBId: "x" });
  });
});

describe("deriveSwapMatchStatus", () => {
  it("preserva estado explícito de partida com resultado publicado", () => {
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: false,
        hasPublishedResult: true,
        isBye: false,
        originalStatus: "finished",
      })
    ).toBe("finished");
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: false,
        hasPublishedResult: true,
        isBye: false,
        originalStatus: "walkover",
      })
    ).toBe("walkover");
  });

  it("nunca deriva pending sobre partida agendada", () => {
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: true,
        hasPublishedResult: false,
        isBye: false,
        originalStatus: "pending",
      })
    ).toBe("scheduled");
  });

  it("deriva bye como walkover e o restante pending", () => {
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: false,
        hasPublishedResult: false,
        isBye: true,
        originalStatus: "pending",
      })
    ).toBe("walkover");
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: false,
        hasPublishedResult: false,
        isBye: false,
        originalStatus: "pending",
      })
    ).toBe("pending");
  });
});

describe("buildSwapPersistPlan", () => {
  const threeMatches: SwapCheckMatch[] = [
    {
      entryAId: "a0",
      entryBId: null,
      hasPublishedResult: false,
      matchDate: null,
      round: 1,
      slotInRound: 0,
      status: "pending",
      winnerEntryId: null,
    },
    {
      entryAId: "a1",
      entryBId: "b1",
      hasPublishedResult: false,
      matchDate: "2026-09-01",
      round: 1,
      slotInRound: 1,
      status: "scheduled",
      winnerEntryId: null,
    },
    {
      entryAId: "a2",
      entryBId: "b2",
      hasPublishedResult: true,
      matchDate: null,
      round: 1,
      slotInRound: 2,
      status: "finished",
      winnerEntryId: "a2",
    },
  ];

  it("escreve apenas os dois slots afetados, com status derivado", () => {
    const plan = buildSwapPersistPlan({
      isByeA: true,
      isByeB: false,
      roundMatches: threeMatches,
      slotA: 0,
      slotB: 1,
    });

    // Só os afetados entram no plano; o match publicado fica intocado.
    expect(plan.map(({ index }) => index)).toEqual([0, 1]);
    expect(plan).toEqual([
      { index: 0, status: "walkover", walkover: true },
      { index: 1, status: "scheduled", walkover: false },
    ]);
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
    const roundTwo = [
      {
        entryAId: "s1",
        entryBId: null,
        isBye: false,
        isVacant: false,
        round: 2,
        slotInRound: 0,
        winnerEntryId: null,
      },
      {
        entryAId: "s2",
        entryBId: null,
        isBye: false,
        isVacant: false,
        round: 2,
        slotInRound: 1,
        winnerEntryId: null,
      },
    ];
    const patched = applySlotSwap(roundTwo, 0, "a", 1, "a");
    // lado preenchido + lado esperando adversário NÃO é bye na rodada 2+
    expect(patched[0]).toMatchObject({
      entryAId: "s2",
      entryBId: null,
      isBye: false,
      winnerEntryId: null,
    });
    expect(patched[1]).toMatchObject({
      entryAId: "s1",
      entryBId: null,
      isBye: false,
      winnerEntryId: null,
    });
  });

  it("vaga vazia nunca é selecionável (lado vazio é recusado)", () => {
    const roundOne: SwapCheckMatch[] = [
      {
        entryAId: null,
        entryBId: null,
        hasPublishedResult: false,
        matchDate: null,
        round: 1,
        slotInRound: 0,
        status: "vacant",
        winnerEntryId: null,
      },
      {
        entryAId: "a",
        entryBId: "b",
        hasPublishedResult: false,
        matchDate: null,
        round: 1,
        slotInRound: 1,
        status: "pending",
        winnerEntryId: null,
      },
    ];
    expect(validateSlotSwap(roundOne, 0, "a", 1, "a")).toContain(
      "posição preenchida"
    );
  });

  it("status vacant é preservado na derivação (defensivo)", () => {
    expect(
      deriveSwapMatchStatus({
        hasMatchDate: false,
        hasPublishedResult: false,
        isBye: false,
        originalStatus: "vacant",
      })
    ).toBe("vacant");
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
