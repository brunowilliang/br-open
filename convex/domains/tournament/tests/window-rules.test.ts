import { describe, expect, it } from "bun:test";

import {
  brazilDayKey,
  findScheduledMatchesBeyondWindowEnd,
  formatShortenWindowError,
  matchNeedsSchedule,
  resolveTournamentWindow,
  shouldNotifyWindowOverflow,
  validateMatchDayInWindow,
  type TournamentWindow,
} from "../window-rules";

/**
 * 10/10/2026 00:00 BRT = 03:00 UTC: o mesmo padrão de data do app. Os testes
 * ancoram em UTC de propósito — a regra compara o DIA brasileiro, nunca o
 * instante.
 */
const START_MS = Date.UTC(2026, 9, 10, 3, 0, 0);
const END_MS = Date.UTC(2026, 9, 20, 3, 0, 0);

const window: TournamentWindow = {
  endDayKey: "2026-10-20",
  startDayKey: "2026-10-10",
};
const legacyWindow: TournamentWindow = {
  endDayKey: null,
  startDayKey: "2026-10-10",
};

describe("brazilDayKey", () => {
  it("usa o dia brasileiro, não o instante UTC", () => {
    // 09/10 23:00 BRT ainda é dia 9 (02:00 UTC do dia 10).
    expect(brazilDayKey(Date.UTC(2026, 9, 10, 2, 0, 0))).toBe("2026-10-09");
    // 10/10 00:00 BRT já é dia 10 (03:00 UTC).
    expect(brazilDayKey(START_MS)).toBe("2026-10-10");
  });
});

describe("resolveTournamentWindow", () => {
  it("resolve a janela pelos dias dos dois extremos", () => {
    expect(
      resolveTournamentWindow({ endDateMs: END_MS, startDateMs: START_MS })
    ).toEqual({ endDayKey: "2026-10-20", startDayKey: "2026-10-10" });
  });

  it("sem fim informado fica sem teto", () => {
    expect(
      resolveTournamentWindow({ endDateMs: null, startDateMs: START_MS })
    ).toEqual({ endDayKey: null, startDayKey: "2026-10-10" });
    expect(
      resolveTournamentWindow({ startDateMs: START_MS }).endDayKey
    ).toBeNull();
  });
});

describe("validateMatchDayInWindow", () => {
  it("aceita os dois limites e os dias do meio", () => {
    expect(
      validateMatchDayInWindow({ dayKey: "2026-10-10", window })
    ).toBeNull();
    expect(
      validateMatchDayInWindow({ dayKey: "2026-10-15", window })
    ).toBeNull();
    expect(
      validateMatchDayInWindow({ dayKey: "2026-10-20", window })
    ).toBeNull();
  });

  it("recusa os dois lados de fora com a mensagem do Editar torneio", () => {
    const message =
      "O torneio vai de 10/10 a 20/10. Estenda a janela no Editar torneio para agendar fora dela.";

    expect(validateMatchDayInWindow({ dayKey: "2026-10-09", window })).toBe(
      message
    );
    expect(validateMatchDayInWindow({ dayKey: "2026-10-21", window })).toBe(
      message
    );
  });

  it("sem fim definido mantém o comportamento de sempre: sem teto", () => {
    expect(
      validateMatchDayInWindow({ dayKey: "2026-11-30", window: legacyWindow })
    ).toBeNull();
    expect(
      validateMatchDayInWindow({ dayKey: "2026-09-01", window: legacyWindow })
    ).toBeNull();
  });
});

describe("findScheduledMatchesBeyondWindowEnd", () => {
  it("conta só quem tem dia marcado depois do novo fim e ainda dá pra remarcar", () => {
    expect(
      findScheduledMatchesBeyondWindowEnd({
        endDayKey: "2026-10-20",
        matches: [
          { id: "match-1", matchDate: "2026-10-20", publishedAt: null },
          { id: "match-2", matchDate: "2026-10-21", publishedAt: null },
          { id: "match-3", matchDate: null, publishedAt: null },
          { id: "match-4", matchDate: "2026-10-22", publishedAt: null },
        ],
      })
    ).toEqual({ count: 2 });

    expect(
      findScheduledMatchesBeyondWindowEnd({
        endDayKey: "2026-10-20",
        matches: [
          { id: "match-1", matchDate: "2026-10-19", publishedAt: null },
          { id: "match-2", matchDate: null, publishedAt: null },
        ],
      })
    ).toBeNull();
  });

  it("resultado publicado depois do fim não bloqueia: ele não volta pra agenda", () => {
    // Torneio legado SEM fim com jogo ja jogado depois da data escolhida: o
    // confronto publicado fica como esta (nem reagenda nem cancela em lote),
    // entao so o agendado e nao publicado segura o encurtamento.
    expect(
      findScheduledMatchesBeyondWindowEnd({
        endDayKey: "2026-10-20",
        matches: [
          {
            id: "match-1",
            matchDate: "2026-10-25",
            publishedAt: new Date("2026-10-25T12:00:00Z"),
          },
          { id: "match-2", matchDate: "2026-10-22", publishedAt: null },
        ],
      })
    ).toEqual({ count: 1 });

    expect(
      findScheduledMatchesBeyondWindowEnd({
        endDayKey: "2026-10-20",
        matches: [
          {
            id: "match-1",
            matchDate: "2026-10-25",
            publishedAt: new Date("2026-10-25T12:00:00Z"),
          },
        ],
      })
    ).toBeNull();
  });

  it("a copy do encurtamento concorda em número e nomeia o caso que resta", () => {
    expect(
      formatShortenWindowError({ count: 1, endDayKey: "2026-10-20" })
    ).toBe(
      "Há 1 confronto agendado depois de 20/10 e ainda sem resultado. Remarque esses jogos antes de encurtar o fim do torneio."
    );
    expect(
      formatShortenWindowError({ count: 3, endDayKey: "2026-10-20" })
    ).toBe(
      "Há 3 confrontos agendados depois de 20/10 e ainda sem resultado. Remarque esses jogos antes de encurtar o fim do torneio."
    );
  });
});

describe("matchNeedsSchedule", () => {
  const base = { matchDate: null, publishedAt: null, status: "pending" };

  it("pede horário quem ainda não aconteceu e não está marcado", () => {
    expect(matchNeedsSchedule(base)).toBeTrue();
    expect(
      matchNeedsSchedule({ ...base, matchDate: "2026-10-15" })
    ).toBeFalse();
  });

  it("bye, vaga morta e resultado publicado ficam de fora", () => {
    expect(matchNeedsSchedule({ ...base, status: "walkover" })).toBeFalse();
    expect(matchNeedsSchedule({ ...base, status: "vacant" })).toBeFalse();
    expect(
      matchNeedsSchedule({ ...base, publishedAt: new Date() })
    ).toBeFalse();
  });
});

describe("shouldNotifyWindowOverflow", () => {
  const base = {
    lastNotifiedDayKey: null,
    // 20/10/2026 10:00 BRT = 13:00 UTC: o dia do fim.
    nowMs: Date.UTC(2026, 9, 20, 13, 0, 0),
    status: "ongoing",
    unscheduledMatchCount: 2,
    window,
  };

  it("avisa no dia do fim com confronto sem horário", () => {
    expect(shouldNotifyWindowOverflow(base)).toBeTrue();
  });

  it("avisa de novo no dia seguinte enquanto persistir", () => {
    expect(
      shouldNotifyWindowOverflow({
        ...base,
        lastNotifiedDayKey: "2026-10-20",
        nowMs: Date.UTC(2026, 9, 21, 13, 0, 0),
      })
    ).toBeTrue();
  });

  it("não repete no mesmo dia nem avisa antes do fim", () => {
    expect(
      shouldNotifyWindowOverflow({ ...base, lastNotifiedDayKey: "2026-10-20" })
    ).toBeFalse();
    expect(
      shouldNotifyWindowOverflow({
        ...base,
        nowMs: Date.UTC(2026, 9, 19, 13, 0, 0),
      })
    ).toBeFalse();
  });

  it("sem jogo sem horário, sem janela ou fora de andamento fica quieto", () => {
    expect(
      shouldNotifyWindowOverflow({ ...base, unscheduledMatchCount: 0 })
    ).toBeFalse();
    expect(
      shouldNotifyWindowOverflow({ ...base, window: legacyWindow })
    ).toBeFalse();
    expect(shouldNotifyWindowOverflow({ ...base, status: "drawn" })).toBeTrue();
    expect(
      shouldNotifyWindowOverflow({ ...base, status: "finished" })
    ).toBeFalse();
    expect(
      shouldNotifyWindowOverflow({ ...base, status: "published" })
    ).toBeFalse();
  });
});
