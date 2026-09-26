import { describe, expect, test } from "bun:test";

import { getMatchStatusChip } from "./match-display";

describe("getMatchStatusChip", () => {
  test("vaga podada não desenha chip; final decidida vira Campeão", () => {
    expect(getMatchStatusChip("vacant")).toBeNull();
    expect(getMatchStatusChip("champion")).toEqual({
      color: "accent",
      label: "Campeão",
    });
  });

  test("status fora do vocabulário cai no rótulo cru", () => {
    expect(getMatchStatusChip("mystery")).toEqual({
      color: "default",
      label: "mystery",
    });
  });
});
