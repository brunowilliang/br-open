import { describe, expect, it } from "bun:test";

import { formatRateAsPercent } from "./percent";

describe("formatRateAsPercent", () => {
  it("renders the borders of the 0..1 range", () => {
    expect(formatRateAsPercent(0)).toBe("0%");
    expect(formatRateAsPercent(1)).toBe("100%");
  });

  it("rounds the rate to the nearest integer percent", () => {
    expect(formatRateAsPercent(1 / 3)).toBe("33%");
    expect(formatRateAsPercent(2 / 3)).toBe("67%");
    expect(formatRateAsPercent(0.5)).toBe("50%");
  });

  it("rounds rates that reach the top and the bottom of the range", () => {
    expect(formatRateAsPercent(0.999)).toBe("100%");
    expect(formatRateAsPercent(0.004)).toBe("0%");
  });
});
