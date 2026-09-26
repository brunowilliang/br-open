import { describe, expect, it } from "bun:test";

import {
  computeAvailableForWithdrawCents,
  computeLiquidAmountCents,
  computeWithdrawFeeCents,
  validateWithdrawAmountCents,
} from "./calculations";

// Faixas do cenário do Bruno: 1000/2000/3000 + grátis a partir de 5000.
const TIERS = [
  { feeCents: 100, upToCents: 1000 },
  { feeCents: 200, upToCents: 2000 },
  { feeCents: 300, upToCents: 3000 },
];
const FREE_FROM_CENTS = 5000;

describe("withdraw calculations", () => {
  describe("computeWithdrawFeeCents", () => {
    it("applies the first tier that fits the amount", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 500,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(100);
    });

    it("includes the tier boundary (amount <= upToCents)", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 1000,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(100);
    });

    it("moves to the next tier above the boundary", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 1001,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(200);
      expect(
        computeWithdrawFeeCents({
          amountCents: 2500,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(300);
    });

    it("caps at the last tier above all boundaries", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 4000,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(300);
    });

    it("is free at and above freeFromCents", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 5000,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(0);
      expect(
        computeWithdrawFeeCents({
          amountCents: 7500,
          feeTiers: TIERS,
          freeFromCents: FREE_FROM_CENTS,
        })
      ).toBe(0);
    });

    it("returns zero when there are no tiers", () => {
      expect(
        computeWithdrawFeeCents({
          amountCents: 1000,
          feeTiers: [],
          freeFromCents: 5000,
        })
      ).toBe(0);
    });
  });

  describe("computeLiquidAmountCents", () => {
    it("subtracts the fee from the amount", () => {
      expect(computeLiquidAmountCents(10_000, 150)).toBe(9850);
      expect(computeLiquidAmountCents(10_000, 0)).toBe(10_000);
    });
  });

  describe("validateWithdrawAmountCents", () => {
    it("rejects amounts below the backend minimum", () => {
      const result = validateWithdrawAmountCents(1500, {
        balanceCents: 50_000,
        minWithdrawCents: 2000,
        reservedCents: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("mínimo");
      }
    });

    it("accepts exactly the minimum", () => {
      expect(
        validateWithdrawAmountCents(2000, {
          balanceCents: 50_000,
          minWithdrawCents: 2000,
          reservedCents: 0,
        })
      ).toEqual({ ok: true });
    });

    it("rejects amounts above the balance", () => {
      const result = validateWithdrawAmountCents(50_001, {
        balanceCents: 50_000,
        minWithdrawCents: 2000,
        reservedCents: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("saldo");
      }
    });

    it("accepts the full balance", () => {
      expect(
        validateWithdrawAmountCents(50_000, {
          balanceCents: 50_000,
          minWithdrawCents: 2000,
          reservedCents: 0,
        })
      ).toEqual({ ok: true });
    });

    it("accepts a valid amount in the middle", () => {
      expect(
        validateWithdrawAmountCents(4500, {
          balanceCents: 50_000,
          minWithdrawCents: 2000,
          reservedCents: 0,
        })
      ).toEqual({ ok: true });
    });

    it("o teto é o DISPONÍVEL: a reserva de estorno sai do que pode ser sacado", () => {
      // R$ 500,00 de saldo com R$ 120,00 reservado: R$ 380,00 é o teto.
      expect(
        validateWithdrawAmountCents(38_000, {
          balanceCents: 50_000,
          minWithdrawCents: 2000,
          reservedCents: 12_000,
        })
      ).toEqual({ ok: true });
      // O que sobra continua sacável; acima do disponível recusa.
      const result = validateWithdrawAmountCents(40_000, {
        balanceCents: 50_000,
        minWithdrawCents: 2000,
        reservedCents: 15_000,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("disponível");
        expect(result.message).toContain("R$ 150,00");
        expect(result.message).toContain(
          "reservado para estornos em andamento"
        );
      }
    });

    it("reserva que come tudo bloqueia o saque inteiro", () => {
      const result = validateWithdrawAmountCents(2000, {
        balanceCents: 50_000,
        minWithdrawCents: 2000,
        reservedCents: 50_000,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("R$ 500,00");
        expect(result.message).toContain(
          "reservado para estornos em andamento"
        );
      }
    });

    it("sem reserva a copy não fala de estorno", () => {
      const result = validateWithdrawAmountCents(50_001, {
        balanceCents: 50_000,
        minWithdrawCents: 2000,
        reservedCents: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).not.toContain("reservado");
      }
    });
  });

  describe("computeAvailableForWithdrawCents", () => {
    it("desconta a reserva e nunca fica negativo", () => {
      expect(
        computeAvailableForWithdrawCents({
          balanceCents: 50_000,
          reservedCents: 12_000,
        })
      ).toBe(38_000);
      expect(
        computeAvailableForWithdrawCents({
          balanceCents: 50_000,
          reservedCents: 0,
        })
      ).toBe(50_000);
      expect(
        computeAvailableForWithdrawCents({
          balanceCents: 30_000,
          reservedCents: 95_000,
        })
      ).toBe(0);
    });
  });
});
