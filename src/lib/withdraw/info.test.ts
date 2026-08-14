import { describe, expect, it } from "bun:test";

import { buildWithdrawFeeLines, buildWithdrawInfoContent } from "./info";

// Mesmas faixas do cenário do Bruno (DECISAO-003).
const BALANCE = {
  accountName: "Liga do Bruno",
  balanceCents: 500_000,
  feeTiers: [
    { feeCents: 500, upToCents: 100_000 },
    { feeCents: 300, upToCents: 200_000 },
    { feeCents: 200, upToCents: 300_000 },
  ],
  freeFromCents: 300_000,
  minWithdrawCents: 2000,
  pixKey: "or********om",
};

describe("buildWithdrawInfoContent", () => {
  it("explica a origem do saldo", () => {
    const content = buildWithdrawInfoContent(BALANCE);

    expect(content.title).toBe("Saldo disponível");
    expect(content.description).toContain("subconta Woovi");
  });

  it("usa o mínimo de saque vindo do backend", () => {
    const content = buildWithdrawInfoContent(BALANCE);

    expect(content.description).toContain("Mínimo de saque: R$ 20,00.");
  });

  it("lista cada faixa de taxa do backend", () => {
    const content = buildWithdrawInfoContent(BALANCE);

    expect(content.description).toContain("· até R$ 1.000,00 → R$ 5,00");
    expect(content.description).toContain("· até R$ 2.000,00 → R$ 3,00");
    expect(content.description).toContain("· até R$ 3.000,00 → R$ 2,00");
  });

  it("mostra a gratuidade a partir do piso do backend", () => {
    const content = buildWithdrawInfoContent(BALANCE);

    expect(content.description).toContain("· a partir de R$ 3.000,00 → Grátis");
  });

  it("reflete faixas e mínimos customizados (sem hardcode)", () => {
    const content = buildWithdrawInfoContent({
      ...BALANCE,
      feeTiers: [{ feeCents: 100, upToCents: 50_000 }],
      freeFromCents: 100_000,
      minWithdrawCents: 1000,
    });

    expect(content.description).toContain("Mínimo de saque: R$ 10,00.");
    expect(content.description).toContain("· até R$ 500,00 → R$ 1,00");
    expect(content.description).toContain("· a partir de R$ 1.000,00 → Grátis");
  });

  describe("buildWithdrawFeeLines", () => {
    it("deriva uma linha por faixa + a linha de gratuidade", () => {
      const lines = buildWithdrawFeeLines(BALANCE);

      expect(lines).toEqual([
        { label: "até R$ 1.000,00", value: "R$ 5,00" },
        { label: "até R$ 2.000,00", value: "R$ 3,00" },
        { label: "até R$ 3.000,00", value: "R$ 2,00" },
        { label: "a partir de R$ 3.000,00", value: "Grátis" },
      ]);
    });

    it("reflete faixas e piso customizados (sem hardcode)", () => {
      const lines = buildWithdrawFeeLines({
        ...BALANCE,
        feeTiers: [{ feeCents: 100, upToCents: 50_000 }],
        freeFromCents: 100_000,
      });

      expect(lines).toEqual([
        { label: "até R$ 500,00", value: "R$ 1,00" },
        { label: "a partir de R$ 1.000,00", value: "Grátis" },
      ]);
    });
  });
});
