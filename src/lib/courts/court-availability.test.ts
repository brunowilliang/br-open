import { describe, expect, it } from "bun:test";

import type { Court, CourtDay } from "@convex/domains/match/contract";

import { formatMinuteToHHMM } from "../format/time";
import {
  applyCourtRange,
  buildCourtTimeOptions,
  COURT_DAYS,
  hasRangeOverlap,
  type CourtTimeRange,
} from "./court-availability";

function buildAvailability(
  partial: Partial<Record<CourtDay, CourtTimeRange[]>>
): Court["availability"] {
  return {
    fri: partial.fri ?? [],
    mon: partial.mon ?? [],
    sat: partial.sat ?? [],
    sun: partial.sun ?? [],
    thu: partial.thu ?? [],
    tue: partial.tue ?? [],
    wed: partial.wed ?? [],
  };
}

function buildCourt(availability: Court["availability"]): Court {
  return { availability, id: "court-1", name: "Quadra 1" };
}

describe("applyCourtRange (BUG-0032 reprodução)", () => {
  it("BUG 1: editar uma faixa existente substitui em place, sem duplicar", () => {
    const court = buildCourt(
      buildAvailability({ thu: [{ endMinute: 1080, startMinute: 480 }] })
    );

    const result = applyCourtRange({
      court,
      days: ["thu"],
      endMinute: 1380,
      replacing: {
        day: "thu",
        range: { endMinute: 1080, startMinute: 480 },
      },
      startMinute: 1200,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }

    expect(result.court.availability.thu).toEqual([
      { endMinute: 1380, startMinute: 1200 },
    ]);
  });

  it("BUG 2: o estado gravado após editar nunca tem faixas sobrepostas", () => {
    const court = buildCourt(
      buildAvailability({ thu: [{ endMinute: 1080, startMinute: 480 }] })
    );

    const result = applyCourtRange({
      court,
      days: ["thu"],
      endMinute: 660,
      replacing: {
        day: "thu",
        range: { endMinute: 1080, startMinute: 480 },
      },
      startMinute: 480,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }

    expect(result.court.availability.thu).toEqual([
      { endMinute: 660, startMinute: 480 },
    ]);
    expect(hasRangeOverlap(result.court.availability.thu)).toBe(false);
  });

  it("adicionar com overlap num dia selecionado é rejeitado listando o dia", () => {
    const result = applyCourtRange({
      court: buildCourt(
        buildAvailability({ thu: [{ endMinute: 1080, startMinute: 480 }] })
      ),
      days: ["mon", "thu"],
      endMinute: 1200,
      startMinute: 600,
    });

    expect(result).toEqual({
      conflictDays: ["thu"],
      status: "conflict",
    });
  });

  it("adicionar em multiplos dias cria a faixa em todos os dias", () => {
    const result = applyCourtRange({
      court: buildCourt(buildAvailability({})),
      days: ["mon", "thu"],
      endMinute: 1200,
      startMinute: 480,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }

    const expected = [{ endMinute: 1200, startMinute: 480 }];
    expect(result.court.availability.mon).toEqual(expected);
    expect(result.court.availability.thu).toEqual(expected);
    expect(result.court.availability.fri).toEqual([]);
  });
});

describe("buildCourtTimeOptions (BUG-0032 deslocamento de 12h)", () => {
  const options = buildCourtTimeOptions();

  it("gera 49 opções de 30 em 30 minutos de 00:00 a 24:00", () => {
    expect(options).toHaveLength(49);
    expect(options[0]).toEqual({ label: "00:00", value: "0" });
    expect(options[48]).toEqual({ label: "24:00", value: "1440" });
  });

  it("cada rótulo é exatamente o valor em minutos no formato 24h (sem shift)", () => {
    for (const option of options) {
      expect(formatMinuteToHHMM(Number(option.value))).toBe(option.label);
    }
  });

  it("os horários relatados no QA mapeiam 1:1 entre o que se vê e o que se grava", () => {
    const byLabel = new Map(options.map((option) => [option.label, option]));

    expect(Number(byLabel.get("20:00")?.value)).toBe(1200);
    expect(Number(byLabel.get("23:00")?.value)).toBe(1380);
    expect(Number(byLabel.get("08:00")?.value)).toBe(480);
    expect(Number(byLabel.get("11:00")?.value)).toBe(660);
  });
});

describe("COURT_DAYS", () => {
  it("ordem canônica seg..dom", () => {
    expect(COURT_DAYS).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]);
  });
});
