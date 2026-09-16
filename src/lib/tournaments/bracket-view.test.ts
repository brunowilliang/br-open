import { describe, expect, test } from "bun:test";

import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";
import {
  canPickSwapSecond,
  canReceiveSwapSide,
  resolveSwapPickSides,
  resolveSwapSelection,
  type BracketSwapTarget,
  type TournamentMatchWithSides,
  buildMatchSides,
  canSwapMatch,
  hasScheduledMatch,
  isByeMatch,
  swapSideIsLocked,
} from "./bracket-view";

function buildEntryView(id: string, name: string): TournamentEntryWithPlayers {
  return {
    categoryId: "cat-1",
    createdAt: 0,
    createdByUserId: null,
    entryRound: null,
    id,
    partnerUserId: null,
    playerA: {
      avatarUrl: null,
      fullName: name,
      nickname: name,
      playerProfileId: `pp-${id}`,
      username: name.toLowerCase(),
    },
    playerAId: id,
    playerB: null,
    playerBId: null,
    seedRank: null,
    status: "active",
    updatedAt: 0,
  };
}

function buildMatch(input: {
  entryAId: null | string;
  entryBId: null | string;
  id: string;
  round: number;
  score?: null | {
    sets: Array<{
      aGames: number;
      bGames: number;
      kind: "set" | "super_tiebreak";
    }>;
    winnerEntryId: string;
  };
  slotInRound: number;
  status?: "finished" | "pending" | "scheduled" | "vacant" | "walkover";
  walkover?: boolean;
}) {
  return {
    categoryId: "cat-1",
    courtId: null,
    createdAt: 0,
    endMinute: null,
    entryAId: input.entryAId,
    entryBId: input.entryBId,
    id: input.id,
    matchDate: null,
    round: input.round,
    rowVersion: 0,
    scheduledById: null,
    score: input.score ?? null,
    slotInRound: input.slotInRound,
    startMinute: null,
    status: input.status ?? ("pending" as const),
    updatedAt: 0,
    walkover: input.walkover ?? false,
    winnerEntryId: null,
  };
}

describe("buildMatchSides", () => {
  test("joins sides by entryAId/entryBId against enriched entries", () => {
    const entriesById = {
      "e-1": buildEntryView("e-1", "Ana"),
      "e-2": buildEntryView("e-2", "Bruno"),
    };
    const matches = [
      buildMatch({
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      }),
    ];

    const withSides = buildMatchSides({ entriesById, matches });

    expect(withSides[0]?.entryA?.playerA?.fullName).toBe("Ana");
    expect(withSides[0]?.entryB?.playerA?.fullName).toBe("Bruno");
  });

  test("null side (bye/tbd) stays null even without a known entry", () => {
    const withSides = buildMatchSides({
      entriesById: {},
      matches: [
        buildMatch({
          entryAId: "e-x",
          entryBId: null,
          id: "m-1",
          round: 1,
          slotInRound: 0,
        }),
      ],
    });

    expect(withSides[0]?.entryA).toBeNull();
    expect(withSides[0]?.entryB).toBeNull();
  });
});

describe("hasScheduledMatch", () => {
  const slot = {
    courtId: "court-1",
    matchDate: "2026-09-12",
    startMinute: 840,
  };

  test("any match with date, minute and court counts", () => {
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: null, startMinute: null },
        slot,
      ])
    ).toBeTrue();
  });

  test("incomplete scheduling (any field missing) does not count", () => {
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: "2026-09-12", startMinute: 840 },
      ])
    ).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: "court-1", matchDate: null, startMinute: 840 },
      ])
    ).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: "court-1", matchDate: "2026-09-12", startMinute: null },
      ])
    ).toBeFalse();
  });

  test("empty bracket (or a fully unscheduled one) stays silent", () => {
    expect(hasScheduledMatch([])).toBeFalse();
    expect(
      hasScheduledMatch([
        { courtId: null, matchDate: null, startMinute: null },
        { courtId: null, matchDate: null, startMinute: null },
      ])
    ).toBeFalse();
  });
});

describe("isByeMatch (vaga derivada do sorteio)", () => {
  test("linha do bye do sorteio (status walkover) e bye", () => {
    expect(
      isByeMatch(
        buildMatch({
          entryAId: "e-1",
          entryBId: null,
          id: "m-1",
          round: 1,
          slotInRound: 0,
          status: "walkover",
          walkover: true,
        })
      )
    ).toBeTrue();
  });

  test("W.O. JOGADO (finished com walkover true) NAO e bye", () => {
    expect(
      isByeMatch(
        buildMatch({
          entryAId: "e-1",
          entryBId: "e-2",
          id: "m-2",
          round: 2,
          slotInRound: 0,
          status: "finished",
          walkover: true,
        })
      )
    ).toBeFalse();
  });

  test("lado sozinho em partida viva nao e bye (o card leva 'A definir')", () => {
    expect(
      isByeMatch(
        buildMatch({
          entryAId: "e-1",
          entryBId: null,
          id: "m-3",
          round: 2,
          slotInRound: 1,
          status: "pending",
        })
      )
    ).toBeFalse();
  });
});

describe("canSwapMatch", () => {
  test("any round without a score can swap (same-round slots)", () => {
    expect(canSwapMatch({ score: null, status: "pending" })).toBeTrue();
    expect(canSwapMatch({ score: null, status: "scheduled" })).toBeTrue();
    // Bye do sorteio: a linha está VIVA (a decisão é do draw, não resultado)
    // — quem trava é a vaga, por lado (`swapSideIsLocked`).
    expect(canSwapMatch({ score: null, status: "walkover" })).toBeTrue();
  });

  test("finished match with a score cannot swap", () => {
    expect(
      canSwapMatch({
        score: { sets: [], winnerEntryId: "e-1" },
        status: "finished",
      })
    ).toBeFalse();
  });

  test("vacant row (pruned subtree of a head of seed) never swaps", () => {
    expect(canSwapMatch({ score: null, status: "vacant" })).toBeFalse();
  });
});

describe("swapSideIsLocked (vaga com vitória propagada)", () => {
  test("filha com resultado PUBLICADO e vencedor dela no lado trava a vaga", () => {
    expect(
      swapSideIsLocked({
        feed: { status: "finished", winnerEntryId: "e-3" },
        sideEntryId: "e-3",
      })
    ).toBeTrue();
  });

  test("bye do sorteio (walkover) NÃO trava: o ajuste re-deriva o bye", () => {
    expect(
      swapSideIsLocked({
        feed: { status: "walkover", winnerEntryId: "e-3" },
        sideEntryId: "e-3",
      })
    ).toBeFalse();
  });

  test("filha decidida por OUTRA inscrição, lado vazio ou sem feed não travam", () => {
    expect(
      swapSideIsLocked({
        feed: { status: "finished", winnerEntryId: "e-9" },
        sideEntryId: "e-3",
      })
    ).toBeFalse();
    expect(
      swapSideIsLocked({
        feed: { status: "finished", winnerEntryId: "e-3" },
        sideEntryId: null,
      })
    ).toBeFalse();
    expect(swapSideIsLocked({ feed: null, sideEntryId: "e-3" })).toBeFalse();
  });
});

describe("canReceiveSwapSide (destino do ajuste)", () => {
  const liveMatch = { score: null, status: "pending" };

  test("lado vazio com feed MORTO aceita inscricao (1a rodada e filha podada)", () => {
    expect(
      canReceiveSwapSide({
        feed: null,
        match: liveMatch,
        sideEmpty: true,
      })
    ).toBeTrue();
    expect(
      canReceiveSwapSide({
        feed: { status: "vacant", winnerEntryId: null },
        match: liveMatch,
        sideEmpty: true,
      })
    ).toBeTrue();
  });

  test("lado vazio com feed VIVO nao aceita (o vencedor de baixo sobrescreveria)", () => {
    expect(
      canReceiveSwapSide({
        feed: { status: "pending", winnerEntryId: null },
        match: liveMatch,
        sideEmpty: true,
      })
    ).toBeFalse();
    expect(
      canReceiveSwapSide({
        feed: { status: "finished", winnerEntryId: "e-9" },
        match: liveMatch,
        sideEmpty: true,
      })
    ).toBeFalse();
  });

  test("lado OCUPADO e transposicao: nao depende de feed", () => {
    expect(
      canReceiveSwapSide({
        feed: { status: "pending", winnerEntryId: null },
        match: liveMatch,
        sideEmpty: false,
      })
    ).toBeTrue();
  });

  test("partida com placar ou encerrada nao recebe lado", () => {
    expect(
      canReceiveSwapSide({
        feed: null,
        match: {
          score: { sets: [], winnerEntryId: "e-1" },
          status: "finished",
        },
        sideEmpty: false,
      })
    ).toBeFalse();
    expect(
      canReceiveSwapSide({
        feed: null,
        match: { score: null, status: "finished" },
        sideEmpty: false,
      })
    ).toBeFalse();
  });

  test("linha de bye do sorteio recebe lado (a decisão é do draw, não resultado)", () => {
    expect(
      canReceiveSwapSide({
        feed: null,
        match: { score: null, status: "walkover" },
        sideEmpty: false,
      })
    ).toBeTrue();
  });
});

describe("canPickSwapSecond (janela da segunda coordenada)", () => {
  const first = { categoryId: "cat-1", round: 2 };

  test("mesma rodada vale em drawn e em ongoing", () => {
    expect(
      canPickSwapSecond({
        current: first,
        next: { categoryId: "cat-1", round: 2 },
        tournamentStatus: "drawn",
      })
    ).toBeTrue();
    expect(
      canPickSwapSecond({
        current: first,
        next: { categoryId: "cat-1", round: 2 },
        tournamentStatus: "ongoing",
      })
    ).toBeTrue();
  });

  test("outra rodada só com a chave sorteada (drawn)", () => {
    expect(
      canPickSwapSecond({
        current: first,
        next: { categoryId: "cat-1", round: 4 },
        tournamentStatus: "drawn",
      })
    ).toBeTrue();
    expect(
      canPickSwapSecond({
        current: first,
        next: { categoryId: "cat-1", round: 4 },
        tournamentStatus: "ongoing",
      })
    ).toBeFalse();
  });

  test("cross-categoria nunca é alcançável", () => {
    expect(
      canPickSwapSecond({
        current: first,
        next: { categoryId: "cat-2", round: 2 },
        tournamentStatus: "drawn",
      })
    ).toBeFalse();
  });
});

function buildSwapTarget(
  input: Parameters<typeof buildMatch>[0],
  side: "a" | "b"
): BracketSwapTarget {
  const [match] = buildMatchSides({
    entriesById: {},
    matches: [buildMatch(input)],
  });
  return { match: match as TournamentMatchWithSides, side };
}

describe("resolveSwapSelection (toque a toque)", () => {
  const roundOne = buildSwapTarget(
    { entryAId: "e-1", entryBId: "e-2", id: "m-1", round: 1, slotInRound: 0 },
    "a"
  );
  const roundTwoOtherSlot = buildSwapTarget(
    { entryAId: "e-3", entryBId: null, id: "m-2", round: 2, slotInRound: 0 },
    "b"
  );

  test("sem seleção, arma a origem", () => {
    expect(
      resolveSwapSelection({
        current: null,
        next: roundOne,
        tournamentStatus: "drawn",
      })
    ).toEqual({ kind: "arm", target: roundOne });
  });

  test("tocar a mesma coordenada limpa a seleção", () => {
    expect(
      resolveSwapSelection({
        current: roundOne,
        next: buildSwapTarget(
          {
            entryAId: "e-1",
            entryBId: "e-2",
            id: "m-1",
            round: 1,
            slotInRound: 0,
          },
          "a"
        ),
        tournamentStatus: "drawn",
      })
    ).toEqual({ kind: "clear" });
  });

  test("segunda coordenada em OUTRA rodada com a chave drawn executa o move", () => {
    expect(
      resolveSwapSelection({
        current: roundOne,
        next: roundTwoOtherSlot,
        tournamentStatus: "drawn",
      })
    ).toEqual({ from: roundOne, kind: "swap", to: roundTwoOtherSlot });
  });

  test("segunda coordenada em outra rodada com o torneio em andamento reinicia", () => {
    expect(
      resolveSwapSelection({
        current: roundOne,
        next: roundTwoOtherSlot,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ kind: "restart", target: roundTwoOtherSlot });
  });

  test("mesma rodada em andamento executa o ajuste", () => {
    const otherSlot = buildSwapTarget(
      {
        entryAId: "e-3",
        entryBId: "e-4",
        id: "m-3",
        round: 1,
        slotInRound: 1,
      },
      "a"
    );
    expect(
      resolveSwapSelection({
        current: roundOne,
        next: otherSlot,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ from: roundOne, kind: "swap", to: otherSlot });
  });
});

describe("resolveSwapPickSides (gating por lado)", () => {
  const filledBoth = buildSwapTarget(
    { entryAId: "e-1", entryBId: "e-2", id: "m-1", round: 1, slotInRound: 0 },
    "a"
  ).match;
  const filledOne = buildSwapTarget(
    { entryAId: "e-3", entryBId: null, id: "m-2", round: 2, slotInRound: 0 },
    "a"
  ).match;
  const emptyBoth = buildSwapTarget(
    { entryAId: null, entryBId: null, id: "m-3", round: 3, slotInRound: 0 },
    "a"
  ).match;

  test("sem seleção, só lado PREENCHIDO arma a origem", () => {
    expect(
      resolveSwapPickSides({
        current: null,
        feedA: null,
        feedB: null,
        match: filledBoth,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: true, b: true });
    expect(
      resolveSwapPickSides({
        current: null,
        feedA: null,
        feedB: null,
        match: filledOne,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: true, b: false });
    expect(
      resolveSwapPickSides({
        current: null,
        feedA: null,
        feedB: null,
        match: emptyBoth,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: false, b: false });
  });

  test("vaga com vitória propagada de resultado PUBLICADO não é oferecida", () => {
    const roundTwo = buildSwapTarget(
      { entryAId: "e-3", entryBId: "e-4", id: "m-4", round: 2, slotInRound: 0 },
      "a"
    ).match;
    const publishedFeed = { status: "finished", winnerEntryId: "e-3" };

    // Origem: o lado A é a vitória propagada de um resultado publicado.
    expect(
      resolveSwapPickSides({
        current: null,
        feedA: publishedFeed,
        feedB: null,
        match: roundTwo,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: false, b: true });
    // Destino: o mesmo lado travado não recebe a seleção.
    expect(
      resolveSwapPickSides({
        current: buildSwapTarget(
          {
            entryAId: "e-1",
            entryBId: "e-2",
            id: "m-1",
            round: 1,
            slotInRound: 0,
          },
          "a"
        ),
        feedA: publishedFeed,
        feedB: null,
        match: roundTwo,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: false, b: true });
  });

  test("vaga com vitória propagada de BYE (walkover, sem resultado) segue movível", () => {
    const roundTwo = buildSwapTarget(
      { entryAId: "e-3", entryBId: "e-4", id: "m-4", round: 2, slotInRound: 0 },
      "a"
    ).match;
    const byeFeed = { status: "walkover", winnerEntryId: "e-3" };

    expect(
      resolveSwapPickSides({
        current: null,
        feedA: byeFeed,
        feedB: null,
        match: roundTwo,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: true });
    expect(
      resolveSwapPickSides({
        current: buildSwapTarget(
          {
            entryAId: "e-1",
            entryBId: "e-2",
            id: "m-1",
            round: 1,
            slotInRound: 0,
          },
          "a"
        ),
        feedA: byeFeed,
        feedB: null,
        match: roundTwo,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: true });
  });

  test("com seleção armada, o destino expõe os DOIS lados (inclusive vazio)", () => {
    const armed = buildSwapTarget(
      {
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      },
      "a"
    );
    const roundOneEmptySide = buildSwapTarget(
      {
        entryAId: "e-7",
        entryBId: null,
        id: "m-10",
        round: 1,
        slotInRound: 1,
      },
      "a"
    ).match;

    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: null,
        match: roundOneEmptySide,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: true, b: true });
    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: null,
        match: emptyBoth,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: true });
  });

  test("destino em outra rodada: bloqueado em ongoing, liberado em drawn", () => {
    const armed = buildSwapTarget(
      {
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      },
      "a"
    );
    const laterRound = buildSwapTarget(
      {
        entryAId: "e-5",
        entryBId: "e-6",
        id: "m-9",
        round: 4,
        slotInRound: 0,
      },
      "a"
    ).match;

    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: null,
        match: laterRound,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: false, b: false });
    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: null,
        match: laterRound,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: true });
  });

  test("destino com lado vazio e feed VIVO fica bloqueado", () => {
    const armed = buildSwapTarget(
      {
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      },
      "a"
    );
    const waitingChild = buildSwapTarget(
      {
        entryAId: "e-7",
        entryBId: null,
        id: "m-10",
        round: 2,
        slotInRound: 0,
      },
      "a"
    ).match;

    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: { status: "pending", winnerEntryId: null },
        match: waitingChild,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: false });
    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: { status: "vacant", winnerEntryId: null },
        match: waitingChild,
        tournamentStatus: "drawn",
      })
    ).toEqual({ a: true, b: true });
  });

  test("o card da própria origem segue tocável (limpar a seleção)", () => {
    const armed = buildSwapTarget(
      {
        entryAId: "e-1",
        entryBId: "e-2",
        id: "m-1",
        round: 1,
        slotInRound: 0,
      },
      "a"
    );

    expect(
      resolveSwapPickSides({
        current: armed,
        feedA: null,
        feedB: null,
        match: armed.match,
        tournamentStatus: "ongoing",
      })
    ).toEqual({ a: true, b: true });
  });
});
