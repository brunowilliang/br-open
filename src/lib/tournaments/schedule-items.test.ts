import { describe, expect, test } from "bun:test";

import type {
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";

import { buildScheduledMatchItems } from "./schedule-items";

function buildEntry(input: {
  id: string;
  players: { name: string; nickname?: string }[];
}): TournamentEntryWithPlayers {
  const cards = input.players.map((player) => ({
    avatarUrl: `${input.id}-${player.name}.png`,
    fullName: player.name,
    nickname: player.nickname ?? null,
    playerProfileId: `profile-${player.name}`,
    username: null,
  }));

  return {
    categoryId: "cat-1",
    id: input.id,
    playerA: cards[0] ?? null,
    playerB: cards[1] ?? null,
  } as TournamentEntryWithPlayers;
}

function buildMatch(input: {
  categoryId?: string;
  courtId?: null | string;
  entryAId?: null | string;
  entryBId?: null | string;
  id: string;
  matchDate?: null | string;
  round: number;
  score?: TournamentMatch["score"];
  startMinute?: null | number;
  status?: TournamentMatch["status"];
  walkover?: boolean;
  winnerEntryId?: null | string;
}): TournamentMatch {
  return {
    categoryId: input.categoryId ?? "cat-1",
    courtId: input.courtId === undefined ? "court-1" : input.courtId,
    entryAId: input.entryAId ?? null,
    entryBId: input.entryBId ?? null,
    id: input.id,
    matchDate: input.matchDate === undefined ? "2026-09-23" : input.matchDate,
    round: input.round,
    score: input.score ?? null,
    slotInRound: 0,
    startMinute: input.startMinute === undefined ? 840 : input.startMinute,
    status: input.status ?? "scheduled",
    walkover: input.walkover ?? false,
    winnerEntryId: input.winnerEntryId ?? null,
  } as TournamentMatch;
}

const COURTS = [{ id: "court-1", name: "Quadra 2" }];

describe("buildScheduledMatchItems", () => {
  test("dupla vira nome + parceiro, cada nome com o SEU avatar", () => {
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {
        "e-a": buildEntry({
          id: "e-a",
          players: [
            { name: "Beatriz Souza", nickname: "Bia" },
            { name: "Rafael Lima" },
          ],
        }),
        "e-b": buildEntry({ id: "e-b", players: [{ name: "Marina Costa" }] }),
      },
      matches: [
        buildMatch({ entryAId: "e-a", entryBId: "e-b", id: "m-1", round: 1 }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.sideAName).toBe("Bia");
    expect(items[0]?.sideAPartnerName).toBe("Rafael Lima");
    expect(items[0]?.sideAAvatarUrl).toBe("e-a-Beatriz Souza.png");
    expect(items[0]?.sideAPartnerAvatarUrl).toBe("e-a-Rafael Lima.png");
    expect(items[0]?.courtName).toBe("Quadra 2");
  });

  test("simples e vaga vazia: sem parceiro e sem avatar", () => {
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {
        "e-a": buildEntry({ id: "e-a", players: [{ name: "Marina Costa" }] }),
      },
      matches: [
        buildMatch({
          entryAId: "e-a",
          entryBId: null,
          id: "m-1",
          round: 1,
          status: "pending",
        }),
      ],
    });

    expect(items[0]?.sideAPartnerName).toBeNull();
    expect(items[0]?.sideAPartnerAvatarUrl).toBeNull();
    expect(items[0]?.sideBName).toBe("A definir");
    expect(items[0]?.sideBAvatarUrl).toBeNull();
  });

  test("sem dia, sem hora ou sem quadra a partida não entra na agenda", () => {
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {},
      matches: [
        buildMatch({ id: "sem-dia", matchDate: null, round: 1 }),
        buildMatch({ id: "sem-hora", round: 1, startMinute: null }),
        buildMatch({ courtId: null, id: "sem-quadra", round: 1 }),
        buildMatch({ courtId: "court-9", id: "completa", round: 1 }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(["completa"]);
    expect(items[0]?.courtName).toBe("");
  });

  test("estágio sai da última rodada de CADA categoria", () => {
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {},
      matches: [
        buildMatch({ id: "oitavas", round: 1 }),
        buildMatch({ id: "final", round: 3 }),
        buildMatch({ categoryId: "cat-2", id: "final-curta", round: 1 }),
      ],
    });

    expect(items.map((item) => [item.id, item.stageLabel])).toEqual([
      ["oitavas", "Quartas de final"],
      ["final", "Final"],
      ["final-curta", "Final"],
    ]);
  });

  test("status e placar do confronto viajam para o item", () => {
    const sets = [{ aGames: 6, bGames: 4, kind: "set" as const }];
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {},
      matches: [
        buildMatch({
          id: "encerrada",
          round: 1,
          score: { sets, winnerEntryId: null },
          status: "finished",
        }),
        buildMatch({ id: "agendada", round: 1 }),
      ],
    });

    expect(items[0]?.matchStatus).toBe("finished");
    expect(items[0]?.scoreSets).toEqual(sets);
    expect(items[1]?.matchStatus).toBe("scheduled");
    expect(items[1]?.scoreSets).toBeNull();
  });

  test("W.O. jogado diz o lado vencedor; o bye do sorteio não", () => {
    const items = buildScheduledMatchItems({
      courts: COURTS,
      entriesById: {},
      matches: [
        buildMatch({
          entryAId: "e-a",
          entryBId: "e-b",
          id: "wo",
          round: 1,
          score: { sets: [{ aGames: 0, bGames: 0, kind: "set" }] },
          status: "finished",
          walkover: true,
          winnerEntryId: "e-b",
        }),
        buildMatch({
          entryAId: "e-c",
          entryBId: null,
          id: "bye",
          round: 1,
          status: "walkover",
          walkover: true,
          winnerEntryId: "e-c",
        }),
      ],
    });

    expect(items.map((item) => [item.id, item.walkoverWinner])).toEqual([
      ["wo", "b"],
      ["bye", null],
    ]);
  });
});
