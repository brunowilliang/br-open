import { describe, expect, it } from "bun:test";

import { formatCompetitionMeta, formatPriceParts } from "./competition";

describe("formatPriceParts", () => {
  it("keeps the free label without a billing suffix", () => {
    expect(
      formatPriceParts({ amountCents: 0, billingInterval: "month" })
    ).toEqual({ amount: "Grátis", suffix: null });
  });

  it("formats the amount and the billing interval", () => {
    expect(
      formatPriceParts({ amountCents: 9000, billingInterval: "month" })
    ).toEqual({ amount: "R$ 90,00", suffix: "/mês" });
    expect(
      formatPriceParts({ amountCents: 2500, billingInterval: "once" })
    ).toEqual({ amount: "R$ 25,00", suffix: " (único)" });
  });
});

describe("formatCompetitionMeta", () => {
  it("joins city and state, and falls back to whichever exists", () => {
    expect(formatCompetitionMeta("Dracena", "SP")).toBe("Dracena · SP");
    expect(formatCompetitionMeta("Dracena", null)).toBe("Dracena");
    expect(formatCompetitionMeta(null, "SP")).toBe("SP");
    expect(formatCompetitionMeta(null, null)).toBe("Sem local definido");
  });
});
