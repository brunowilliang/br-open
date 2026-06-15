import { describe, expect, it } from "bun:test";

import {
  formatLeagueAvailabilityBadge,
  formatLeaguePriceParts,
  formatLeagueMonthlyPrice,
  hasLeagueAvailableSpots,
} from "./presentation";

describe("league presentation", () => {
  it("hides the availability badge when the league is full", () => {
    const input = {
      activePlayerCount: 20,
      maxPlayers: 20,
    };

    expect(hasLeagueAvailableSpots(input)).toBe(false);
    expect(formatLeagueAvailabilityBadge(input)).toBeNull();
  });

  it("shows exact availability below ten open spots", () => {
    expect(
      formatLeagueAvailabilityBadge({
        activePlayerCount: 11,
        maxPlayers: 20,
      })
    ).toBe("9 vagas disponíveis");
    expect(
      formatLeagueAvailabilityBadge({
        activePlayerCount: 19,
        maxPlayers: 20,
      })
    ).toBe("1 vaga disponível");
  });

  it("uses the generic availability badge for ten or more open spots", () => {
    expect(
      formatLeagueAvailabilityBadge({
        activePlayerCount: 10,
        maxPlayers: 20,
      })
    ).toBe("Vagas Disponíveis");
    expect(
      formatLeagueAvailabilityBadge({
        activePlayerCount: 10,
        maxPlayers: null,
      })
    ).toBe("Vagas Disponíveis");
  });

  it("formats the monthly league price", () => {
    expect(formatLeagueMonthlyPrice(9000)).toBe("R$ 90,00/mês");
    expect(formatLeagueMonthlyPrice(0)).toBe("Grátis");
  });

  it("formats paid league price as amount and billing suffix parts", () => {
    expect(
      formatLeaguePriceParts({
        amountCents: 9000,
        billingInterval: "month",
      })
    ).toEqual({
      amount: "R$ 90,00",
      suffix: "/mês",
    });
    expect(
      formatLeaguePriceParts({
        amountCents: 2500,
        billingInterval: "week",
      })
    ).toEqual({
      amount: "R$ 25,00",
      suffix: "/semana",
    });
  });
});
