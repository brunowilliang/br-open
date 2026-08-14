import { describe, expect, it } from "bun:test";

import { applyKey, centsToParts } from "./use-amount-input-controller";

const display = (cents: number) => {
  const { integer, decimal } = centsToParts(cents);
  return [
    ...integer.map((d) => d.value),
    ",",
    ...decimal.map((d) => d.value),
  ].join("");
};

describe("centsToParts (centavos acumulado, estilo Revolut)", () => {
  it("separa reais (com milhar) e centavos", () => {
    expect(display(0)).toBe("0,00");
    expect(display(2)).toBe("0,02");
    expect(display(5)).toBe("0,05");
    expect(display(25)).toBe("0,25");
    expect(display(250)).toBe("2,50");
    expect(display(2500)).toBe("25,00");
    expect(display(25_000)).toBe("250,00");
    expect(display(250_000)).toBe("2.500,00");
    expect(display(800)).toBe("8,00");
  });

  it("marca ponto de milhar como separator na parte inteira", () => {
    const seps = centsToParts(250_000)
      .integer.filter((d) => d.type === "separator")
      .map((d) => d.value);
    expect(seps).toEqual(["."]);
  });

  it("atribui ids estáveis por posição (integer r-*, decimal c-*)", () => {
    expect(centsToParts(2500).integer.map((d) => d.id)).toEqual(["r-0", "r-1"]);
    expect(centsToParts(2500).decimal.map((d) => d.id)).toEqual(["c-0", "c-1"]);
  });
});

describe("applyKey", () => {
  it("acumula dígitos como centavos (×10 + d)", () => {
    expect(applyKey(0, "2")).toBe(2);
    expect(applyKey(2, "5")).toBe(25);
    expect(applyKey(25, "0")).toBe(250);
    expect(applyKey(250, "0")).toBe(2500);
  });

  it("backspace remove o último dígito (floor / 10)", () => {
    expect(applyKey(250, "backspace")).toBe(25);
    expect(applyKey(25, "backspace")).toBe(2);
    expect(applyKey(2, "backspace")).toBe(0);
    expect(applyKey(0, "backspace")).toBe(0);
  });

  it("ignora teclas não-numéricas (sem vírgula no teclado)", () => {
    expect(applyKey(25, ",")).toBe(25);
    expect(applyKey(25, ".")).toBe(25);
    expect(applyKey(25, "x")).toBe(25);
  });

  it("respeita o teto máximo", () => {
    const max = 99_999_999_999;
    expect(applyKey(max, "9")).toBe(max);
  });
});
