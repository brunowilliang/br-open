import { describe, expect, test } from "bun:test";

import { BRAZILIAN_STATES } from "./states";

describe("BRAZILIAN_STATES", () => {
  test("são as 27 UFs, únicas e com 2 letras", () => {
    expect(BRAZILIAN_STATES).toHaveLength(27);
    expect(new Set(BRAZILIAN_STATES).size).toBe(27);
    for (const state of BRAZILIAN_STATES) {
      expect(state).toMatch(/^[A-Z]{2}$/);
    }
  });
});
