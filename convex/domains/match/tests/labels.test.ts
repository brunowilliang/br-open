import { describe, expect, it } from "bun:test";

import {
  formatMatchMinute,
  formatMatchMonthDay,
  formatMatchScoreLabel,
  formatMatchSlotLabel,
} from "../labels";

describe("rotulos de confronto (copy do servidor)", () => {
  it("monta a etiqueta de dia e hora do confronto", () => {
    expect(
      formatMatchSlotLabel({ matchDate: "2026-09-28", startMinute: 480 })
    ).toBe("28/09 às 08:00");
    expect(
      formatMatchSlotLabel({ matchDate: "2026-10-09", startMinute: 690 })
    ).toBe("09/10 às 11:30");
    expect(formatMatchMinute(0)).toBe("00:00");
    expect(formatMatchMinute(1319)).toBe("21:59");
  });

  it("devolve a data crua quando ela nao esta no formato do torneio", () => {
    expect(formatMatchMonthDay("28/09")).toBe("28/09");
    expect(formatMatchMonthDay("")).toBe("");
  });

  it("monta o placar set a set", () => {
    expect(
      formatMatchScoreLabel([
        { aGames: 6, bGames: 3 },
        { aGames: 7, bGames: 6 },
      ])
    ).toBe("6-3, 7-6");
    expect(formatMatchScoreLabel([])).toBe("");
  });
});
