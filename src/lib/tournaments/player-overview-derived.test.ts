import { describe, expect, it } from "bun:test";

import type { TournamentMatchWithSides } from "./bracket-view";
import { selectNextPlayerMatch } from "./player-overview-derived";

function buildMatch(
  overrides: Partial<TournamentMatchWithSides> = {}
): TournamentMatchWithSides {
  return {
    categoryId: "cat-1",
    courtId: null,
    entryA: null,
    entryAId: "entry-me",
    entryB: null,
    entryBId: "entry-them",
    id: "match-1",
    matchDate: null,
    round: 1,
    score: null,
    slotInRound: 0,
    startMinute: null,
    status: "pending",
    walkover: false,
    winnerEntryId: null,
    ...overrides,
  } as TournamentMatchWithSides;
}

const VIEWER = ["entry-me"];

describe("selectNextPlayerMatch", () => {
  it("sem data o confronto conta: a chave saiu e o jogo é dele", () => {
    const next = selectNextPlayerMatch({
      matches: [buildMatch()],
      viewerEntryIds: VIEWER,
    });

    expect(next?.id).toBe("match-1");
    expect(next?.matchDate).toBeNull();
    expect(next?.status).toBe("pending");
  });

  it("com data o confronto continua aparecendo", () => {
    const next = selectNextPlayerMatch({
      matches: [
        buildMatch({
          matchDate: "2026-10-04",
          startMinute: 540,
          status: "scheduled",
        }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(next?.matchDate).toBe("2026-10-04");
  });

  it("a rodada mais próxima manda, agendada ou não", () => {
    const next = selectNextPlayerMatch({
      matches: [
        buildMatch({
          id: "final",
          matchDate: "2026-10-04",
          round: 2,
          status: "scheduled",
        }),
        buildMatch({ id: "semifinal", round: 1 }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(next?.id).toBe("semifinal");
  });

  it("dentro da rodada, a sem data vem primeiro (é a que espera ação)", () => {
    const next = selectNextPlayerMatch({
      matches: [
        buildMatch({
          id: "agendado",
          matchDate: "2026-10-04",
          startMinute: 540,
          status: "scheduled",
        }),
        buildMatch({ id: "sem-horario" }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(next?.id).toBe("sem-horario");
  });

  it("fica fora o que não é jogo dele, o que tem lado indefinido e o decidido", () => {
    const next = selectNextPlayerMatch({
      matches: [
        buildMatch({ entryAId: "entry-x", entryBId: "entry-y", id: "alheio" }),
        buildMatch({ entryBId: null, id: "lado-aberto" }),
        buildMatch({ id: "encerrado", status: "finished" }),
        buildMatch({ id: "decidido", winnerEntryId: "entry-me" }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(next).toBeUndefined();
  });

  it("o viewer pode estar no lado B", () => {
    const next = selectNextPlayerMatch({
      matches: [
        buildMatch({
          entryAId: "entry-them",
          entryBId: "entry-me",
          id: "lado-b",
        }),
      ],
      viewerEntryIds: VIEWER,
    });

    expect(next?.id).toBe("lado-b");
  });
});
