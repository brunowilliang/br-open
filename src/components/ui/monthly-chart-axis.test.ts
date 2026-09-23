import { describe, expect, it } from "bun:test";

import { buildMonthlyYAxis } from "./monthly-chart-axis";

const series = (...values: number[]) => values.map((value) => ({ value }));

describe("buildMonthlyYAxis", () => {
  it("anchors on 0 with a usable step when the series is empty", () => {
    expect(buildMonthlyYAxis([])).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });

  it("keeps the anchor and the step on a series of zeros", () => {
    // Sem dado o eixo saía -1 / -0,5 / 0 / 0,5 / 1 (bounds iguais abertos pelo
    // victory), com o zero no MEIO do gráfico.
    expect(buildMonthlyYAxis(series(0, 0, 0, 0, 0, 0))).toEqual({
      domain: [0, 1],
      ticks: [0, 1],
    });
  });

  it("closes the axis on the first tick above the period max", () => {
    // Maior mês com 5 partidas: passo 2 fecha o teto em 6, sem fração.
    expect(buildMonthlyYAxis(series(1, 3, 2, 4, 5, 2))).toEqual({
      domain: [0, 6],
      ticks: [0, 2, 4, 6],
    });
  });

  it("keeps the step integer on the cents scale", () => {
    expect(buildMonthlyYAxis(series(1_234_567, 90_000))).toEqual({
      domain: [0, 1_500_000],
      ticks: [0, 500_000, 1_000_000, 1_500_000],
    });
  });

  it("never returns a negative tick, whatever the series carries", () => {
    expect(buildMonthlyYAxis(series(-3, 2))).toEqual({
      domain: [0, 2],
      ticks: [0, 1, 2],
    });
  });

  it("holds 0 first, integer steps and at most 5 marks for any max", () => {
    for (const max of [1, 2, 3, 5, 7, 9, 12, 24, 47, 99, 500, 123_456]) {
      const { domain, ticks } = buildMonthlyYAxis([{ value: max }]);
      const lastTick = ticks.at(-1) ?? -1;

      expect(ticks[0]).toBe(0);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(lastTick).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect(domain).toEqual([0, lastTick]);
    }
  });
});
