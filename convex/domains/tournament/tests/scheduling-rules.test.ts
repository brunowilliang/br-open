import { describe, expect, it } from "bun:test";

import type { MatchConfig } from "../../match/contract";
import { resolveMatchOccupiedEndMinute } from "../../match/scheduling";
import {
  findCourtSlotConflict,
  isScheduledTournamentMatch,
  resolveTournamentAutoAction,
  shouldAutoDrawTournament,
  shouldAutoStartTournament,
  type TournamentScheduledMatch,
} from "../scheduling-rules";

const matchConfig = { defaultDurationMinutes: 90 } as MatchConfig;

const scheduled: TournamentScheduledMatch[] = [
  {
    courtId: "court-1",
    id: "match-1",
    matchDate: "2026-09-20",
    startMinute: 540,
  },
  {
    courtId: "court-2",
    id: "match-2",
    matchDate: "2026-09-20",
    startMinute: 540,
  },
  {
    courtId: "court-1",
    id: "match-3",
    matchDate: "2026-09-21",
    startMinute: 540,
  },
  {
    courtId: "court-1",
    id: "match-4",
    matchDate: "2026-09-20",
    startMinute: null,
  },
];

describe("tournament scheduling rules", () => {
  it("derives the occupied end from the default duration", () => {
    expect(
      resolveMatchOccupiedEndMinute({ matchConfig, startMinute: 540 })
    ).toBe(630);
  });

  it("flags an overlapping booking on the same court and date", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 690,
      ignoredMatchId: "new-match",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 600,
    });
    expect(conflict?.id).toBe("match-1");
  });

  it("derives occupancy from the rule even when the stored end is understated", () => {
    // match-1 occupies [540, 630) by rule. A client sending [570, 590) would
    // not overlap a 20-minute window, but the rule-derived window does.
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 590,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 570,
    });
    expect(conflict?.id).toBe("match-1");
  });

  it("allows back-to-back bookings (half-open windows)", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 720,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 630,
    });
    expect(conflict).toBeNull();
  });

  it("ignores other courts, other dates and unscheduled matches", () => {
    const otherCourt = findCourtSlotConflict({
      courtId: "court-9",
      endMinute: 690,
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(otherCourt).toBeNull();

    const otherDay = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 690,
      matchConfig,
      matchDate: "2026-09-22",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(otherDay).toBeNull();

    const unscheduled = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 630,
      ignoredMatchId: "match-1",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(unscheduled).toBeNull();
  });

  it("skips the match being rescheduled", () => {
    const conflict = findCourtSlotConflict({
      courtId: "court-1",
      endMinute: 630,
      ignoredMatchId: "match-1",
      matchConfig,
      matchDate: "2026-09-20",
      scheduledMatches: scheduled,
      startMinute: 540,
    });
    expect(conflict).toBeNull();
  });
});

describe("shouldAutoStartTournament (IBX-0069)", () => {
  // 25/09/2026 00:00 BRT = 03:00 UTC (padrão do app para datas de início).
  const startDayMs = Date.UTC(2026, 8, 25, 3, 0, 0);
  const brt = (isoUtc: string) => Date.parse(isoUtc);

  it("inicia no dia D (madrugada BRT) e continua iniciando durante o dia", () => {
    // 00:05 BRT de D (03:05 UTC): a janela do cron de hora em hora pega aqui.
    expect(
      shouldAutoStartTournament({
        nowMs: brt("2026-09-25T03:05:00Z"),
        startDateMs: startDayMs,
        status: "drawn",
      })
    ).toBeTrue();
    // 23:00 BRT de D (02:00 UTC de D+1): o dia brasileiro ainda é D.
    expect(
      shouldAutoStartTournament({
        nowMs: brt("2026-09-26T02:00:00Z"),
        startDateMs: startDayMs,
        status: "drawn",
      })
    ).toBeTrue();
  });

  it("não inicia antes do dia D — nem na noite de D-1 (21:00+ BRT)", () => {
    expect(
      shouldAutoStartTournament({
        nowMs: brt("2026-09-25T02:59:00Z"),
        startDateMs: startDayMs,
        status: "drawn",
      })
    ).toBeFalse();
    // 01:00 BRT de D-1 (04:00 UTC) — UTC chamaria "hoje", o Brasil não.
    expect(
      shouldAutoStartTournament({
        nowMs: brt("2026-09-24T04:00:00Z"),
        startDateMs: startDayMs,
        status: "drawn",
      })
    ).toBeFalse();
  });

  it("drawn e published (round 2) auto-iniciam no dia; demais estados intocados", () => {
    for (const status of ["drawn", "published"]) {
      expect(
        shouldAutoStartTournament({
          nowMs: brt("2026-09-25T03:05:00Z"),
          startDateMs: startDayMs,
          status,
        })
      ).toBeTrue();
    }
    for (const status of ["ongoing", "finished", "cancelled"]) {
      expect(
        shouldAutoStartTournament({
          nowMs: brt("2026-09-25T03:05:00Z"),
          startDateMs: startDayMs,
          status,
        })
      ).toBeFalse();
    }
  });

  it("startDate nula não inicia (torneio legado sem data)", () => {
    expect(
      shouldAutoStartTournament({
        nowMs: brt("2026-09-25T03:05:00Z"),
        startDateMs: Number.NaN,
        status: "drawn",
      })
    ).toBeFalse();
  });
});

describe("shouldAutoDrawTournament (IBX-0098)", () => {
  // Prazo 20/09/2026 22:00 BRT (21/09 01:00 UTC) e início 25/09 00:00 BRT.
  const deadlineMs = Date.UTC(2026, 8, 21, 1, 0, 0);
  const startDayMs = Date.UTC(2026, 8, 25, 3, 0, 0);
  const brt = (isoUtc: string) => Date.parse(isoUtc);

  it("sorteia quando o prazo fecha e NÃO inicia o torneio", () => {
    const base = {
      registrationDeadlineMs: deadlineMs,
      startDateMs: startDayMs,
    };
    // Mesmo limite do isRegistrationOpen: aberto até o instante, fechado nele.
    expect(
      shouldAutoDrawTournament({
        ...base,
        nowMs: deadlineMs - 1,
        status: "published",
      })
    ).toBeFalse();
    expect(
      shouldAutoDrawTournament({
        ...base,
        nowMs: deadlineMs,
        status: "published",
      })
    ).toBeTrue();
    expect(
      resolveTournamentAutoAction({
        ...base,
        nowMs: brt("2026-09-22T12:00:00Z"),
        status: "published",
      })
    ).toBe("draw");
  });

  it("no dia do início o start ganha: um published sorteia e inicia no mesmo tick", () => {
    expect(
      resolveTournamentAutoAction({
        nowMs: brt("2026-09-25T03:05:00Z"),
        registrationDeadlineMs: deadlineMs,
        startDateMs: startDayMs,
        status: "published",
      })
    ).toBe("start");
  });

  it("drawn já tem chave: não re-sorteia sozinho e não produz ação", () => {
    const base = {
      registrationDeadlineMs: deadlineMs,
      startDateMs: startDayMs,
    };
    expect(
      shouldAutoDrawTournament({
        ...base,
        nowMs: brt("2026-09-22T12:00:00Z"),
        status: "drawn",
      })
    ).toBeFalse();
    expect(
      resolveTournamentAutoAction({
        ...base,
        nowMs: brt("2026-09-22T12:00:00Z"),
        status: "drawn",
      })
    ).toBeNull();
  });

  it("prazo depois do dia do início mantém o comportamento antigo", () => {
    // Prazo 28/09 22:00 BRT, início 25/09: o prazo não antecipa nada.
    const lateDeadlineMs = Date.UTC(2026, 8, 29, 1, 0, 0);
    expect(
      shouldAutoDrawTournament({
        nowMs: brt("2026-09-27T12:00:00Z"),
        registrationDeadlineMs: lateDeadlineMs,
        startDateMs: startDayMs,
        status: "published",
      })
    ).toBeFalse();
    expect(
      resolveTournamentAutoAction({
        nowMs: brt("2026-09-25T03:05:00Z"),
        registrationDeadlineMs: lateDeadlineMs,
        startDateMs: startDayMs,
        status: "published",
      })
    ).toBe("start");
  });

  it("prazo no MESMO dia do início: vale o instante do prazo, não o dia", () => {
    // 25/09 11:00 BRT, mesma janela do início: antes do instante nada acontece,
    // depois dele o sorteio já pode rodar (o start só entra no dia seguinte... o
    // start tenta de novo no mesmo tick, mas é o start que decide).
    const sameDayDeadlineMs = Date.UTC(2026, 8, 25, 14, 0, 0);
    const base = {
      registrationDeadlineMs: sameDayDeadlineMs,
      startDateMs: startDayMs,
      status: "published",
    };
    expect(
      shouldAutoDrawTournament({ ...base, nowMs: brt("2026-09-25T13:00:00Z") })
    ).toBeFalse();
    expect(
      shouldAutoDrawTournament({ ...base, nowMs: brt("2026-09-25T15:00:00Z") })
    ).toBeTrue();
  });
});

describe("absent scheduling keys (BUG-0030)", () => {
  it("treats matches with absent keys as unscheduled", () => {
    expect(
      isScheduledTournamentMatch({
        courtId: undefined,
        id: "match-x",
        matchDate: undefined,
        startMinute: undefined,
      })
    ).toBe(false);
    expect(
      isScheduledTournamentMatch({
        courtId: "court-1",
        id: "match-y",
        matchDate: "2026-09-20",
        startMinute: 540,
      })
    ).toBe(true);
  });
});
