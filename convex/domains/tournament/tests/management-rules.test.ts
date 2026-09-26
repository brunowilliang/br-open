import { describe, expect, it } from "bun:test";

import type { TournamentStatus } from "../contract";
import {
  findRemovedScheduledCourt,
  isTournamentClosed,
  validateTournamentEditStatus,
} from "../management-rules";
import type { TournamentScheduledMatch } from "../scheduling-rules";

describe("validateTournamentEditStatus", () => {
  it("permite draft, published, drawn e ONGOING (ajuste em curso)", () => {
    for (const status of [
      "draft",
      "ongoing",
      "published",
      "drawn",
    ] as TournamentStatus[]) {
      expect(validateTournamentEditStatus(status)).toBeNull();
    }
  });

  it("rejeita apenas finished com a mensagem do produto", () => {
    expect(validateTournamentEditStatus("finished")).toBe(
      "Torneios encerrados não podem ser editados."
    );
  });
});

describe("isTournamentClosed", () => {
  it("congela finished E cancelled (a chave fica só de leitura)", () => {
    expect(isTournamentClosed("finished")).toBe(true);
    expect(isTournamentClosed("cancelled")).toBe(true);
  });

  it("não congela as fases de ajuste (draft, published, drawn, ongoing)", () => {
    for (const status of [
      "draft",
      "ongoing",
      "published",
      "drawn",
    ] as TournamentStatus[]) {
      expect(isTournamentClosed(status)).toBe(false);
    }
  });
});

describe("findRemovedScheduledCourt", () => {
  const removedCourtIds = new Set(["court-removida"]);

  it("rejeita quadra removida com partida agendada", () => {
    const matches: TournamentScheduledMatch[] = [
      {
        courtId: "court-removida",
        id: "match-1",
        matchDate: "2026-09-20",
        startMinute: 540,
      },
    ];
    expect(
      findRemovedScheduledCourt({ removedCourtIds, scheduledMatches: matches })
    ).toBe("court-removida");
  });

  it("quadra só referenciada por partida NÃO agendada pode mudar", () => {
    const unscheduled: TournamentScheduledMatch[] = [
      {
        // Chaves ausentes (o Convex omite o que não foi gravado) E null
        // explícito: nenhum dos dois segura reserva.
        courtId: undefined,
        id: "match-2",
        matchDate: undefined,
        startMinute: undefined,
      },
      {
        courtId: null,
        id: "match-3",
        matchDate: null,
        startMinute: null,
      },
      {
        courtId: "court-removida",
        id: "match-4",
        matchDate: "2026-09-20",
        startMinute: null,
      },
    ];
    expect(
      findRemovedScheduledCourt({
        removedCourtIds,
        scheduledMatches: unscheduled,
      })
    ).toBeNull();
  });

  it("partida agendada em quadra mantida nao bloqueia", () => {
    const kept: TournamentScheduledMatch[] = [
      {
        courtId: "court-mantida",
        id: "match-5",
        matchDate: "2026-09-20",
        startMinute: 540,
      },
    ];
    expect(
      findRemovedScheduledCourt({ removedCourtIds, scheduledMatches: kept })
    ).toBeNull();
  });
});
