import { describe, expect, it, mock } from "bun:test";

// O módulo puxa o router e o RN só pelo hook; o que se prova aqui é puro.
mock.module("expo-router", () => ({ useFocusEffect: () => undefined }));
mock.module("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

const { resolveNextBrazilMidnightMs } = await import("./brazil-today");

describe("resolveNextBrazilMidnightMs", () => {
  it("aponta a próxima meia-noite do Brasil (03:00 UTC)", () => {
    // 29/09 02:41 -03 → a virada é 30/09 00:00 -03 = 30/09 03:00 UTC.
    expect(resolveNextBrazilMidnightMs(Date.UTC(2026, 8, 29, 5, 41))).toBe(
      Date.UTC(2026, 8, 30, 3, 0)
    );
    // 28/09 23:59 -03 (ainda dia 28) → 29/09 03:00 UTC.
    expect(resolveNextBrazilMidnightMs(Date.UTC(2026, 8, 29, 2, 59))).toBe(
      Date.UTC(2026, 8, 29, 3, 0)
    );
    // 29/09 00:00 -03 já virou: o próximo alvo é o dia seguinte.
    expect(resolveNextBrazilMidnightMs(Date.UTC(2026, 8, 29, 3, 0))).toBe(
      Date.UTC(2026, 8, 30, 3, 0)
    );
  });
});
