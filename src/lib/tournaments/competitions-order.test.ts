import { describe, expect, test } from "bun:test";

import {
  compareCompetitionItems,
  type CompetitionPinnedItem,
  type CompetitionTournamentItem,
  orderCompetitionItems,
} from "@/lib/tournaments/competitions-order";

const CREATE: CompetitionPinnedItem = { kind: "create-tournament" };

const EARLY = Date.UTC(2026, 8, 20);
const LATER = Date.UTC(2026, 9, 1);

function tournament(
  status: string,
  startDate: number,
  id: string
): CompetitionTournamentItem & { id: string } {
  return { id, kind: "tournament", startDate, status };
}

describe("compareCompetitionItems", () => {
  test("o grupo de status decide antes da data", () => {
    const ongoing = tournament("ongoing", LATER, "ongoing");
    const draft = tournament("draft", EARLY, "draft");

    expect(compareCompetitionItems(ongoing, draft)).toBeLessThan(0);
    expect(compareCompetitionItems(draft, ongoing)).toBeGreaterThan(0);
  });

  test("no mesmo grupo a data de início mais próxima vem antes", () => {
    const sooner = tournament("published", EARLY, "sooner");
    const later = tournament("published", LATER, "later");

    expect(compareCompetitionItems(sooner, later)).toBeLessThan(0);
    expect(compareCompetitionItems(later, sooner)).toBeGreaterThan(0);
  });

  test("encerrado e cancelado invertem: o mais recente vem antes", () => {
    const olderFinished = tournament("finished", EARLY, "older-finished");
    const newerFinished = tournament("finished", LATER, "newer-finished");

    expect(compareCompetitionItems(newerFinished, olderFinished)).toBeLessThan(
      0
    );

    const olderCancelled = tournament("cancelled", EARLY, "older-cancelled");
    const newerCancelled = tournament("cancelled", LATER, "newer-cancelled");

    expect(
      compareCompetitionItems(newerCancelled, olderCancelled)
    ).toBeLessThan(0);
  });
});

describe("orderCompetitionItems", () => {
  test("agrupa na ordem: em andamento, inscrições abertas, sorteado, rascunho, encerrado, cancelado", () => {
    const ordered = orderCompetitionItems([
      tournament("cancelled", EARLY, "cancelled"),
      tournament("finished", EARLY, "finished"),
      tournament("draft", EARLY, "draft"),
      tournament("drawn", EARLY, "drawn"),
      tournament("published", EARLY, "published"),
      tournament("ongoing", EARLY, "ongoing"),
    ]);

    expect(ordered.map((item) => item.status)).toEqual([
      "ongoing",
      "published",
      "drawn",
      "draft",
      "finished",
      "cancelled",
    ]);
  });

  test("dentro do grupo a data mais próxima vem antes; encerrado e cancelado do mais recente", () => {
    const ordered = orderCompetitionItems([
      tournament("published", LATER, "published-depois"),
      tournament("published", EARLY, "published-antes"),
      tournament("finished", EARLY, "finished-antes"),
      tournament("finished", LATER, "finished-depois"),
      tournament("cancelled", EARLY, "cancelled-antes"),
      tournament("cancelled", LATER, "cancelled-depois"),
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "published-antes",
      "published-depois",
      "finished-depois",
      "finished-antes",
      "cancelled-depois",
      "cancelled-antes",
    ]);
  });

  test("o card de criar fica no índice 0 em qualquer posição da entrada", () => {
    const tournaments = [
      tournament("draft", EARLY, "draft"),
      tournament("ongoing", LATER, "ongoing"),
      tournament("finished", LATER, "finished"),
    ];

    for (let position = 0; position <= tournaments.length; position += 1) {
      const input = [
        ...tournaments.slice(0, position),
        CREATE,
        ...tournaments.slice(position),
      ];
      const ordered = orderCompetitionItems(input);

      expect(
        ordered.map((item) =>
          item.kind === "tournament" ? item.status : item.kind
        )
      ).toEqual(["create-tournament", "ongoing", "draft", "finished"]);
    }
  });

  test("só o card, só torneios ou nada: nenhum item inventado", () => {
    expect(orderCompetitionItems([CREATE])).toEqual([CREATE]);

    const only = tournament("draft", EARLY, "draft");
    expect(orderCompetitionItems([only])).toEqual([only]);
    expect(orderCompetitionItems([])).toEqual([]);
  });

  test("empate de data no mesmo grupo mantém a ordem de entrada", () => {
    const first = tournament("draft", EARLY, "first");
    const second = tournament("draft", EARLY, "second");

    expect(orderCompetitionItems([first, second])).toEqual([first, second]);
  });
});
