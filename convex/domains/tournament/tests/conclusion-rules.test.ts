import { describe, expect, it } from "bun:test";

import type { TournamentStatus } from "../contract";
import {
  canConcludeTournament,
  resolveCategoryChampion,
  resolveTournamentConclusionError,
  type TournamentConclusionCategory,
  type TournamentConclusionMatch,
} from "../conclusion-rules";

/** Chave de exemplo: semifinais decididas e final conforme o caso pedido. */
function bracket(input: {
  champion: null | string;
  semiWinner?: null | string;
}): TournamentConclusionCategory {
  const matches: TournamentConclusionMatch[] = [
    { round: 1, slotInRound: 0, winnerEntryId: input.semiWinner ?? "entry-1" },
    { round: 1, slotInRound: 1, winnerEntryId: "entry-3" },
    { round: 2, slotInRound: 0, winnerEntryId: input.champion },
  ];

  return { matches };
}

describe("resolveCategoryChampion", () => {
  it("le a final como a maior rodada no slot 0", () => {
    expect(
      resolveCategoryChampion(bracket({ champion: "entry-1" }).matches)
    ).toBe("entry-1");
  });

  it("rodada maior sem vencedor NAO deixa o vencedor da semi passar por campeao", () => {
    expect(
      resolveCategoryChampion(bracket({ champion: null }).matches)
    ).toBeNull();
  });

  it("chave vazia nao tem campeao", () => {
    expect(resolveCategoryChampion([])).toBeNull();
  });

  it("chave corrida de 3 rodadas: o campeao e o da ULTIMA, nao o do fim da lista", () => {
    expect(
      resolveCategoryChampion([
        { round: 3, slotInRound: 0, winnerEntryId: "entry-final" },
        { round: 1, slotInRound: 0, winnerEntryId: "entry-1" },
        { round: 2, slotInRound: 0, winnerEntryId: "entry-1" },
      ])
    ).toBe("entry-final");
  });
});

describe("canConcludeTournament", () => {
  const ongoing = "ongoing" as TournamentStatus;

  it("em andamento com campeao em TODA categoria conclui", () => {
    expect(
      canConcludeTournament({
        categories: [
          bracket({ champion: "entry-1" }),
          bracket({ champion: "entry-5" }),
        ],
        status: ongoing,
      })
    ).toBe(true);
  });

  it("categoria sem chave (fora do sorteio) nao bloqueia", () => {
    expect(
      canConcludeTournament({
        categories: [bracket({ champion: "entry-1" }), { matches: [] }],
        status: ongoing,
      })
    ).toBe(true);
  });

  it("final sem vencedor em UMA categoria segura o encerramento", () => {
    expect(
      canConcludeTournament({
        categories: [
          bracket({ champion: "entry-1" }),
          bracket({ champion: null }),
        ],
        status: ongoing,
      })
    ).toBe(false);
  });

  it("torneio sem categoria nenhuma nao conclui", () => {
    expect(canConcludeTournament({ categories: [], status: ongoing })).toBe(
      false
    );
  });

  it("fora do andamento nao conclui, mesmo com todos os campeoes definidos", () => {
    for (const status of [
      "draft",
      "published",
      "drawn",
      "finished",
      "cancelled",
    ] as TournamentStatus[]) {
      expect(
        canConcludeTournament({
          categories: [bracket({ champion: "entry-1" })],
          status,
        })
      ).toBe(false);
    }
  });
});

describe("resolveTournamentConclusionError", () => {
  it("sem erro quando pode concluir", () => {
    expect(
      resolveTournamentConclusionError({
        categories: [bracket({ champion: "entry-1" })],
        status: "ongoing",
      })
    ).toBeNull();
  });

  it("recusa por campeao faltando com a mensagem do produto", () => {
    expect(
      resolveTournamentConclusionError({
        categories: [bracket({ champion: null })],
        status: "ongoing",
      })
    ).toBe(
      "Todas as categorias precisam ter campeão antes de concluir o torneio."
    );
  });

  it("recusa por status com mensagem propria (nunca a de campeao)", () => {
    expect(
      resolveTournamentConclusionError({
        categories: [bracket({ champion: "entry-1" })],
        status: "cancelled",
      })
    ).toBe("Só um torneio em andamento pode ser concluído.");
  });
});
