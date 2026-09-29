import { describe, expect, it } from "bun:test";

import { brazilDayKey } from "@convex/domains/tournament/window-rules";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  buildScheduleWindowTabs,
  formatDateToUtcKey,
  formatScheduleMinute,
  resolveInitialScheduleDayKey,
  resolveScheduleDateBounds,
} from "./schedule-view";

describe("buildScheduleDateTabs", () => {
  it("starts at the Brazil today with friendly labels", () => {
    // 27/09/2026 é domingo; 29/09 é terça.
    const tabs = buildScheduleDateTabs({
      todayDayKey: "2026-09-27",
      windowDays: 7,
    });

    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toMatchObject({
      isToday: true,
      isTomorrow: false,
      isYesterday: false,
      label: "Hoje",
      matchDate: "2026-09-27",
    });
    expect(tabs[1]).toMatchObject({
      isToday: false,
      isTomorrow: true,
      label: "Amanhã",
    });
    expect(tabs[2]).toMatchObject({
      isToday: false,
      isTomorrow: false,
      label: "ter, 29",
    });
  });

  it("generates 15 tabs when window is 15", () => {
    const tabs = buildScheduleDateTabs({
      todayDayKey: "2026-09-27",
      windowDays: 15,
    });
    expect(tabs).toHaveLength(15);
  });
});

describe("agenda no calendário do Brasil (BUG-0094)", () => {
  // 29/09/2026 02:41 em America/Sao_Paulo = 05:41 UTC.
  const agoraMs = Date.UTC(2026, 8, 29, 5, 41);
  const hoje = brazilDayKey(agoraMs);

  it("o hoje às 02:41 (-03) é o dia 29 e o chip do hoje é o 29", () => {
    expect(hoje).toBe("2026-09-29");

    const tabs = buildScheduleWindowTabs({
      endDayKey: "2026-09-30",
      startDayKey: "2026-09-27",
      todayDayKey: hoje,
    });

    // O rótulo curto é do PRÓPRIO dia: ler em UTC e formatar no fuso local
    // devolvia um dia a menos ("sáb, 26" no lugar de "dom, 27").
    expect(tabs.map((tab) => `${tab.matchDate}=${tab.label}`)).toEqual([
      "2026-09-27=dom, 27",
      "2026-09-28=Ontem",
      "2026-09-29=Hoje",
      "2026-09-30=Amanhã",
    ]);
  });

  it("abre no hoje do Brasil e clampa nas duas pontas", () => {
    const dayKeys = ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"];

    expect(resolveInitialScheduleDayKey({ dayKeys, todayDayKey: hoje })).toBe(
      "2026-09-29"
    );
    // Janela no futuro: primeiro dia. Janela no passado: último dia.
    expect(
      resolveInitialScheduleDayKey({ dayKeys, todayDayKey: "2026-10-02" })
    ).toBe("2026-09-30");
    expect(
      resolveInitialScheduleDayKey({ dayKeys, todayDayKey: "2026-09-24" })
    ).toBe("2026-09-27");
  });

  it("hoje ENTRE dois dias da lista cai no PRÓXIMO dia da lista", () => {
    // Buraco real: dia extra de confronto antes do início e janela maior que o
    // teto de 180 dias deixam o hoje fora de `dayKeys` — o `Tabs` não pode
    // receber um value sem trigger (e o fallback não pode devolver o buraco).
    expect(
      resolveInitialScheduleDayKey({
        dayKeys: ["2026-09-28", "2026-10-05"],
        todayDayKey: "2026-09-29",
      })
    ).toBe("2026-10-05");
  });

  it("a virada é a meia-noite do Brasil, não a do relógio", () => {
    // 28/09 23:59 -03 ainda é 28; 29/09 00:00 -03 já é 29; 02:59 -03 segue 29.
    expect(brazilDayKey(Date.UTC(2026, 8, 29, 2, 59))).toBe("2026-09-28");
    expect(brazilDayKey(Date.UTC(2026, 8, 29, 3, 0))).toBe("2026-09-29");
    expect(brazilDayKey(Date.UTC(2026, 8, 29, 5, 59))).toBe("2026-09-29");
  });

  it("o chip de ontem (janela já começada) ganha o rótulo relativo", () => {
    const tabs = buildScheduleWindowTabs({
      endDayKey: "2026-09-30",
      startDayKey: "2026-09-28",
      todayDayKey: "2026-09-29",
    });

    expect(tabs[0]).toMatchObject({
      isYesterday: true,
      label: "Ontem",
      matchDate: "2026-09-28",
    });
  });

  it("o legacy usa o mesmo calendário do Brasil (não UTC)", () => {
    const tabs = buildScheduleDateTabs({
      todayDayKey: "2026-09-29",
      windowDays: 7,
    });

    expect(tabs[0]).toMatchObject({
      isToday: true,
      label: "Hoje",
      matchDate: "2026-09-29",
    });
    expect(tabs[1]).toMatchObject({
      isTomorrow: true,
      label: "Amanhã",
      matchDate: "2026-09-30",
    });
    expect(tabs[2].label).toBe("qui, 01");
  });
});

describe("buildScheduleWindowTabs", () => {
  it("covers every day of the window, labelling ontem/hoje/amanhã", () => {
    // 2026-10-11 é domingo.
    const tabs = buildScheduleWindowTabs({
      endDayKey: "2026-10-13",
      startDayKey: "2026-10-11",
      todayDayKey: "2026-10-12",
    });

    expect(tabs.map((tab) => tab.matchDate)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(tabs[0]).toMatchObject({ isYesterday: true, label: "Ontem" });
    expect(tabs[1]).toMatchObject({ isToday: true, label: "Hoje" });
    expect(tabs[2]).toMatchObject({ isTomorrow: true, label: "Amanhã" });
  });

  it("keeps days with a game outside the window, in order and deduplicated", () => {
    const tabs = buildScheduleWindowTabs({
      endDayKey: "2026-10-12",
      extraDayKeys: ["2026-10-05", "2026-10-12"],
      startDayKey: "2026-10-11",
      todayDayKey: "2026-10-11",
    });

    expect(tabs.map((tab) => tab.matchDate)).toEqual([
      "2026-10-05",
      "2026-10-11",
      "2026-10-12",
    ]);
  });
});

describe("resolveScheduleDateBounds", () => {
  it("never leaves today behind and clamps the max to the window end", () => {
    expect(
      resolveScheduleDateBounds({
        endDayKey: "2026-10-20",
        startDayKey: "2026-10-10",
        todayDayKey: "2026-10-15",
      })
    ).toEqual({ maxDayKey: "2026-10-20", minDayKey: "2026-10-15" });
    expect(
      resolveScheduleDateBounds({
        endDayKey: "2026-10-20",
        startDayKey: "2026-10-18",
        todayDayKey: "2026-10-15",
      })
    ).toEqual({ maxDayKey: "2026-10-20", minDayKey: "2026-10-18" });
  });

  it("drops a window already ended and keeps today without a window", () => {
    expect(
      resolveScheduleDateBounds({
        endDayKey: "2026-10-12",
        startDayKey: "2026-10-10",
        todayDayKey: "2026-10-15",
      })
    ).toEqual({ maxDayKey: null, minDayKey: "2026-10-15" });
    // Sem fim o início não virou limite: o torneio legado agenda como sempre.
    expect(
      resolveScheduleDateBounds({
        endDayKey: null,
        startDayKey: "2026-10-20",
        todayDayKey: "2026-10-15",
      })
    ).toEqual({ maxDayKey: null, minDayKey: "2026-10-15" });
    expect(
      resolveScheduleDateBounds({
        endDayKey: null,
        startDayKey: null,
        todayDayKey: "2026-10-15",
      })
    ).toEqual({ maxDayKey: null, minDayKey: "2026-10-15" });
  });
});

describe("buildScheduleDayView", () => {
  const matchDate = "2026-06-26";

  it("groups items into morning/afternoon/evening by startMinute", () => {
    const view = buildScheduleDayView({
      challenges: [
        { id: "1", matchDate, startMinute: 540 }, // 09:00 manhã
        { id: "2", matchDate, startMinute: 840 }, // 14:00 tarde
        { id: "3", matchDate, startMinute: 1140 }, // 19:00 noite
        { id: "4", matchDate, startMinute: 360 }, // 06:00 manhã
      ],
      matchDate,
    });

    expect(view.morning.map((item) => item.id)).toEqual(["4", "1"]);
    expect(view.afternoon.map((item) => item.id)).toEqual(["2"]);
    expect(view.evening.map((item) => item.id)).toEqual(["3"]);
  });

  it("sorts each period by startMinute ascending", () => {
    const view = buildScheduleDayView({
      challenges: [
        { id: "a", matchDate, startMinute: 600 },
        { id: "b", matchDate, startMinute: 480 },
      ],
      matchDate,
    });

    expect(view.morning.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("excludes items from other days", () => {
    const view = buildScheduleDayView({
      challenges: [{ id: "1", matchDate: "2026-06-27", startMinute: 540 }],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(0);
  });

  it("treats 12:00 (720) as afternoon start", () => {
    const view = buildScheduleDayView({
      challenges: [{ id: "1", matchDate, startMinute: 720 }],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(1);
  });

  it("treats 18:00 (1080) as evening start", () => {
    const view = buildScheduleDayView({
      challenges: [{ id: "1", matchDate, startMinute: 1080 }],
      matchDate,
    });

    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(1);
  });
});

describe("formatScheduleMinute", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(formatScheduleMinute(540)).toBe("09:00");
    expect(formatScheduleMinute(0)).toBe("00:00");
    expect(formatScheduleMinute(1140)).toBe("19:00");
  });
});

describe("formatDateToUtcKey", () => {
  it("formats a Date as YYYY-MM-DD using UTC", () => {
    expect(formatDateToUtcKey(new Date(Date.UTC(2026, 5, 26)))).toBe(
      "2026-06-26"
    );
  });
});
