import { describe, expect, it } from "bun:test";

import { buildCrosshairLabels } from "./monthly-chart-labels";

const PILL_LABELS = ["set. · R$ 90,00", "out. · R$ 1.234,56", "nov. · R$ 7,00"];

describe("buildCrosshairLabels", () => {
  it("indexes the pressed point labels so the worklet reads one position", () => {
    const { byIndex } = buildCrosshairLabels(PILL_LABELS);

    // O card lê `byIndex[matchedIndex + 1]`: a posição 1 é o ponto 0 da série.
    expect(byIndex[1]).toBe("set. · R$ 90,00");
    expect(byIndex[3]).toBe("nov. · R$ 7,00");
  });

  it("picks the label by index even when the month label repeats", () => {
    // 24 meses: o rótulo do mês repete, o VALOR não — a escolha por texto
    // (o que o IBX-0078 fazia) pegaria sempre a primeira ocorrência.
    const { byIndex } = buildCrosshairLabels([
      "set. · R$ 7,00",
      "out. · R$ 12,00",
      "set. · R$ 1.234,56",
    ]);

    expect(byIndex[0 + 1]).toBe("set. · R$ 7,00");
    expect(byIndex[2 + 1]).toBe("set. · R$ 1.234,56");
  });

  it("falls back to the widest label out of the series and with no press", () => {
    const { byIndex, widest } = buildCrosshairLabels(PILL_LABELS);

    expect(widest).toBe("out. · R$ 1.234,56");
    expect(byIndex).toEqual([
      widest, // posição do `matchedIndex` = -1, sem toque
      ...PILL_LABELS,
      widest, // índice fora da série
    ]);
  });

  it("measures the widest by text length, first of the series on a tie", () => {
    expect(buildCrosshairLabels(["dez. · 400", "set. · 1.000"]).widest).toBe(
      "set. · 1.000"
    );

    // Mesmo comprimento: fica o primeiro da série (ordem dos meses).
    expect(buildCrosshairLabels(["set. · 4", "dez. · 5"]).widest).toBe(
      "set. · 4"
    );
  });

  it("hands the new widest over when the series grows in magnitude", () => {
    // Cenário da LOW 1: o refetch traz magnitude maior. O `widest` é o `key`
    // do campo e o valor com que a semente do mount nasce no remount.
    const before = buildCrosshairLabels([
      "set. · R$ 999,99",
      "out. · R$ 90,00",
    ]);
    const after = buildCrosshairLabels([
      "set. · R$ 90,00",
      "out. · R$ 1.234,56",
    ]);

    expect(before.widest).toBe("set. · R$ 999,99");
    expect(after.widest).toBe("out. · R$ 1.234,56");
  });

  it("keeps a filled table on an empty series", () => {
    expect(buildCrosshairLabels([])).toEqual({ byIndex: ["", ""], widest: "" });
  });
});
