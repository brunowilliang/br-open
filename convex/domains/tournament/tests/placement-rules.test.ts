import { describe, expect, it } from "bun:test";

import {
  canPlaceEntries,
  findBoardEntryCoordinates,
  listOpenFirstRoundSides,
  listUsableFirstRoundSides,
  planBracketBirth,
  planBracketGrowth,
  planEntryFit,
  planEntryRemoval,
  toPlacementInserts,
  type PlacementBoardMatch,
} from "../placement-rules";
import {
  buildBracket,
  validateBracketStartable,
  type BracketSeedEntry,
} from "../bracket-rules";

const entry = (entryId: string): BracketSeedEntry => ({
  entryId,
  seedRank: null,
});

/** Shuffled draw (Fisher-Yates stubbed by explicit order) → board rows. */
function boardFromEntries(ids: string[]): PlacementBoardMatch[] {
  const { bracket, error } = buildBracket(ids.map(entry));
  if (!bracket) {
    throw new Error(error ?? "falhou");
  }
  return toPlacementInserts(bracket.matches).map((insert) => ({
    ...insert,
    hasPublishedResult: false,
    id: `m${insert.round}-${insert.slotInRound}`,
  }));
}

const row = (input: {
  entryAId?: string | null;
  entryBId?: string | null;
  id?: string;
  round: number;
  slotInRound: number;
  status?: PlacementBoardMatch["status"];
  walkover?: boolean;
  winnerEntryId?: string | null;
}): PlacementBoardMatch => ({
  entryAId: input.entryAId ?? null,
  entryBId: input.entryBId ?? null,
  hasPublishedResult: false,
  id: input.id ?? `m${input.round}-${input.slotInRound}`,
  round: input.round,
  slotInRound: input.slotInRound,
  status: input.status ?? "pending",
  walkover: input.walkover ?? false,
  winnerEntryId: input.winnerEntryId ?? null,
});

const firstSide = (
  sides: { round: number; side: "a" | "b"; slotInRound: number }[]
) => sides[0] as (typeof sides)[number];

const coordinatesOf = (board: PlacementBoardMatch[], entryId: string) =>
  findBoardEntryCoordinates(board, entryId)
    .map(({ round, side, slotInRound }) => `${round}:${slotInRound}:${side}`)
    .sort();

describe("canPlaceEntries", () => {
  it("roda só antes do início (published/drawn)", () => {
    expect(canPlaceEntries("published")).toBe(true);
    expect(canPlaceEntries("drawn")).toBe(true);
    expect(canPlaceEntries("draft")).toBe(false);
    expect(canPlaceEntries("ongoing")).toBe(false);
    expect(canPlaceEntries("finished")).toBe(false);
    expect(canPlaceEntries("cancelled")).toBe(false);
  });
});

describe("planBracketBirth", () => {
  it("2 entradas nascem confronto direto, sem bye", () => {
    const { error, inserts } = planBracketBirth([entry("a"), entry("b")]);
    expect(error).toBeNull();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      entryAId: "a",
      entryBId: "b",
      round: 1,
      slotInRound: 0,
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
  });

  it("número ímpar: bye nasce resolvido como walkover (semántica do sorteio)", () => {
    const { error, inserts } = planBracketBirth(["a", "b", "c"].map(entry));
    expect(error).toBeNull();
    // chave de 4: [a|bye] e [b|c], final aguardando
    expect(inserts).toHaveLength(3);
    expect(inserts[0]).toMatchObject({
      entryAId: "a",
      entryBId: null,
      status: "walkover",
      walkover: true,
      winnerEntryId: "a",
    });
    expect(inserts[1]).toMatchObject({
      entryAId: "b",
      entryBId: "c",
      status: "pending",
      walkover: false,
    });
    expect(inserts[2]).toMatchObject({
      entryAId: "a",
      entryBId: null,
      round: 2,
      status: "pending",
    });
  });
});

describe("planEntryFit", () => {
  it("idempotente: entry já na chave não reaplica", () => {
    const board = boardFromEntries(["a", "b", "c"]);
    expect(planEntryFit({ board, entryId: "a", pickSide: firstSide })).toEqual({
      error: null,
      updates: [],
    });
  });

  it("encaixa no lado vazio do bye e o transforma em confronto real", () => {
    const board = boardFromEntries(["a", "b", "c"]);
    const { error, updates } = planEntryFit({
      board,
      entryId: "n",
      pickSide: firstSide,
    });
    expect(error).toBeNull();
    // a primeira vaga é o lado B do bye (m1-0: [a|null])
    const byeRow = updates.find((update) => update.id === "m1-0");
    expect(byeRow).toMatchObject({
      entryAId: "a",
      entryBId: "n",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // o lado A da final perde o win propagado do bye: volta a aguardar
    const finalRow = updates.find((update) => update.id === "m2-0");
    expect(finalRow).toMatchObject({
      entryAId: null,
      entryBId: null,
      status: "pending",
    });
  });

  it("encaixa contra sobrevivente 'A definir' sem criar walkover", () => {
    const board = [
      row({ entryAId: "a", round: 1, slotInRound: 0, status: "pending" }),
      row({ entryAId: "b", entryBId: "c", round: 1, slotInRound: 1 }),
      row({ round: 2, slotInRound: 0, status: "pending" }),
    ];
    const { error, updates } = planEntryFit({
      board,
      entryId: "n",
      pickSide: (sides) => sides[0] as (typeof sides)[number],
    });
    expect(error).toBeNull();
    expect(updates.find((update) => update.id === "m1-0")).toMatchObject({
      entryAId: "a",
      entryBId: "n",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
  });

  it("vaga sob placement alheio é filtrada; sem vaga segura, recusa", () => {
    // final com o lado A ocupado por um placement de move que não veio
    // do bye abaixo — encaixe ali apagaria dado de terceiro.
    const board = [
      row({ entryAId: "a", round: 1, slotInRound: 0, status: "vacant" }),
      row({ entryAId: "b", entryBId: "c", round: 1, slotInRound: 1 }),
      row({ entryAId: "x", round: 2, slotInRound: 0, status: "pending" }),
    ];
    expect(listUsableFirstRoundSides(board)).toEqual([]);
    const { error, updates } = planEntryFit({
      board,
      entryId: "n",
      pickSide: firstSide,
    });
    expect(error).toContain("Sorteie a chave novamente");
    expect(updates).toEqual([]);
  });

  it("vaga sob placement alheio é filtrada; a segura recebe a entry", () => {
    const board = [
      row({ entryAId: "a", round: 1, slotInRound: 0, status: "vacant" }),
      row({ entryAId: "b", entryBId: "c", round: 1, slotInRound: 1 }),
      row({ entryAId: "x", round: 2, slotInRound: 0, status: "pending" }),
    ];
    // o lado A da row 0 alimenta o lado B da final (slot 0 → par 0 → lado A?
    // slot 0 é par → lado A da final, ocupado por x) — inseguro. O lado B
    // da row 0 alimenta o MESMO lado A (mesma row) — também inseguro. O
    // organizador moveu x pra cima da subtree inteira: nenhuma vaga ali.
    expect(listUsableFirstRoundSides(board)).toEqual([]);
  });

  it("chave cheia não encaixa", () => {
    const board = boardFromEntries(["a", "b"]);
    expect(listOpenFirstRoundSides(board)).toEqual([]);
    const { error } = planEntryFit({
      board,
      entryId: "n",
      pickSide: firstSide,
    });
    expect(error).toContain("cheia");
  });
});

describe("planBracketGrowth", () => {
  it("8 → 16: confrontos existentes sobem preservados, 8 byes nascem por baixo", () => {
    const board = boardFromEntries(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const roundOnePairs = board
      .filter((match) => match.round === 1)
      .map((match) => [match.entryAId, match.entryBId]);

    const { error, inserts, updates } = planBracketGrowth({ board });
    expect(error).toBeNull();

    // toda row existente sobe UMA rodada com o par intacto
    expect(updates).toHaveLength(board.length);
    for (const update of updates) {
      const before = board.find((match) => match.id === update.id) as
        | PlacementBoardMatch
        | undefined;
      expect(before).toBeDefined();
      expect(update.round).toBe((before as PlacementBoardMatch).round + 1);
      expect(update.entryAId).toBe((before as PlacementBoardMatch).entryAId);
      expect(update.entryBId).toBe((before as PlacementBoardMatch).entryBId);
    }
    // os 4 confrontos da 1ª rodada continuam existindo (agora na rodada 2)
    for (const [entryAId, entryBId] of roundOnePairs) {
      const moved = updates.find(
        (update) =>
          update.round === 2 &&
          update.entryAId === entryAId &&
          update.entryBId === entryBId
      );
      expect(moved).toBeDefined();
    }
    // 8 byes novos: um por entrante, walkover resolvido na hora
    expect(inserts).toHaveLength(8);
    expect(inserts.map((insert) => insert.entryAId).sort()).toEqual(
      ["a", "b", "c", "d", "e", "f", "g", "h"].sort()
    );
    for (const [index, insert] of inserts.entries()) {
      expect(insert.round).toBe(1);
      expect(insert.slotInRound).toBe(index);
      expect(insert.status).toBe("walkover");
      expect(insert.winnerEntryId).toBe(insert.entryAId);
      expect(insert.entryBId).toBeNull();
    }
  });

  it("16 → 32 preserva os 8 pares da 1ª rodada", () => {
    const ids = Array.from({ length: 16 }, (_, index) => `p${index}`);
    const board = boardFromEntries(ids);
    const firstRoundPairs = board
      .filter((match) => match.round === 1)
      .map((match) => [match.entryAId, match.entryBId]);

    const { error, inserts, updates } = planBracketGrowth({ board });
    expect(error).toBeNull();
    // chave de 16: 8+4+2+1 = 15 rows, todas sobem
    expect(updates).toHaveLength(15);
    expect(inserts).toHaveLength(16);
    for (const [entryAId, entryBId] of firstRoundPairs) {
      const moved = updates.find(
        (update) =>
          update.round === 2 &&
          update.entryAId === entryAId &&
          update.entryBId === entryBId
      );
      expect(moved).toBeDefined();
    }
  });

  it("recusa crescer com vaga em aberto", () => {
    const board = boardFromEntries(["a", "b", "c"]);
    const { error } = planBracketGrowth({ board });
    expect(error).toContain("vagas em aberto");
  });

  it("chave crescida continua iniciável (walkovers resolved)", () => {
    const board = boardFromEntries(["a", "b", "c", "d"]);
    const { error, inserts, updates } = planBracketGrowth({ board });
    expect(error).toBeNull();
    const grown: PlacementBoardMatch[] = [
      ...updates.map((update) => ({
        entryAId: update.entryAId,
        entryBId: update.entryBId,
        hasPublishedResult: false,
        id: update.id,
        round: update.round,
        slotInRound: update.slotInRound,
        status: update.status,
        walkover: update.walkover,
        winnerEntryId: update.winnerEntryId,
      })),
      ...inserts.map((insert, index) => ({
        ...insert,
        hasPublishedResult: false,
        id: `new-${index}`,
      })),
    ];
    expect(validateBracketStartable(grown)).toBeNull();
  });
});

describe("planEntryRemoval", () => {
  it("cancelado de confronto real deixa 'A definir' (sem re-derivar bye)", () => {
    const board = boardFromEntries(["a", "b"]);
    const { updates } = planEntryRemoval({ board, entryId: "b" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      entryAId: "a",
      entryBId: null,
      id: "m1-0",
      status: "pending",
      walkover: false,
      winnerEntryId: null,
    });
    // coerência com o início: vaga "A definir" na 1ª rodada recusa iniciar
    const afterRemoval: PlacementBoardMatch[] = board.map((match) => {
      const update = updates.find((candidate) => candidate.id === match.id);
      return update ? { ...match, ...update } : match;
    });
    expect(validateBracketStartable(afterRemoval)).toContain("vaga em aberto");
  });

  it("cancelado de bye mata o walkover e puxa o win propagado da rodada de cima", () => {
    const board = boardFromEntries(["a", "b", "c"]);
    expect(coordinatesOf(board, "a")).toEqual(["1:0:a", "2:0:a"]);
    const { updates } = planEntryRemoval({ board, entryId: "a" });
    const byeRow = updates.find((update) => update.id === "m1-0");
    expect(byeRow).toMatchObject({
      entryAId: null,
      entryBId: null,
      status: "vacant",
      walkover: false,
      winnerEntryId: null,
    });
    const finalRow = updates.find((update) => update.id === "m2-0");
    expect(finalRow).toMatchObject({
      entryAId: null,
      entryBId: null,
      status: "pending",
    });
    // com a subtree morta embaixo, o lado da final vira buraco: iniciar recusa
    const afterRemoval: PlacementBoardMatch[] = board.map((match) => {
      const update = updates.find((candidate) => candidate.id === match.id);
      return update ? { ...match, ...update } : match;
    });
    expect(validateBracketStartable(afterRemoval)).toContain("vaga em aberto");
  });

  it("cancelado de chave crescida: bye novo some, confronto preservado perde o lado", () => {
    const board = boardFromEntries(["a", "b", "c", "d"]);
    const { error, inserts, updates } = planBracketGrowth({ board });
    expect(error).toBeNull();
    expect(inserts).toHaveLength(4);
    expect(updates).toHaveLength(3);
    const grown: PlacementBoardMatch[] = [
      ...updates.map((update) => ({
        entryAId: update.entryAId,
        entryBId: update.entryBId,
        hasPublishedResult: false,
        id: update.id,
        round: update.round,
        slotInRound: update.slotInRound,
        status: update.status,
        walkover: update.walkover,
        winnerEntryId: update.winnerEntryId,
      })),
      ...inserts.map((insert, index) => ({
        ...insert,
        hasPublishedResult: false,
        id: `new-${index}`,
      })),
    ];
    // "a" está no bye new-0 (rodada 1) e no confronto preservado (rodada 2)
    expect(coordinatesOf(grown, "a")).toEqual(["1:0:a", "2:0:a"]);
    const { updates: removalUpdates } = planEntryRemoval({
      board: grown,
      entryId: "a",
    });
    const byeRow = removalUpdates.find((update) => update.id === "new-0");
    expect(byeRow).toMatchObject({ status: "vacant", winnerEntryId: null });
    const preserved = removalUpdates.find((update) => update.id === "m1-0");
    expect(preserved).toMatchObject({
      entryAId: null,
      entryBId: "b",
      status: "pending",
    });
  });

  it("idempotente: entry fora da chave é no-op", () => {
    const board = boardFromEntries(["a", "b"]);
    expect(planEntryRemoval({ board, entryId: "z" })).toEqual({ updates: [] });
  });
});
