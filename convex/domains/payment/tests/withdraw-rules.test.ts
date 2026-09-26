import { describe, expect, it } from "bun:test";

import {
  FREE_WITHDRAW_FROM_CENTS,
  MIN_WITHDRAW_CENTS,
  WITHDRAW_FEE_TIERS,
  canCompleteWithdrawal,
  canFailWithdrawal,
  computeAvailableCents,
  computeLiquidAmountCents,
  computeReservedCents,
  computeWithdrawFee,
  feeStatusAfterFailure,
  generateWithdrawIdempotencyKey,
  initialFeeStatus,
  isFeeCollectionDue,
  isPendingInFlight,
  resolveWithdrawalReservation,
  type RefundableCharge,
  type WithdrawalReservationRow,
} from "../withdraw-rules";

function row(
  overrides: Partial<WithdrawalReservationRow>
): WithdrawalReservationRow {
  return {
    failureReason: null,
    feeCents: 500,
    liquidAmountCents: 1500,
    status: "pending",
    ...overrides,
  };
}

describe("withdraw rules (DECISAO-003)", () => {
  describe("constants", () => {
    it("exposes the configured minimum and free threshold", () => {
      expect(MIN_WITHDRAW_CENTS).toBe(2000); // R$ 20,00
      expect(FREE_WITHDRAW_FROM_CENTS).toBe(300_000); // R$ 3.000,00
    });

    it("orders tiers by upToCents ascending with the last tier at freeFromCents", () => {
      expect(WITHDRAW_FEE_TIERS).toEqual([
        { feeCents: 500, upToCents: 100_000 },
        { feeCents: 300, upToCents: 200_000 },
        { feeCents: 200, upToCents: 300_000 },
      ]);
    });
  });

  describe("computeWithdrawFee", () => {
    it("applies the first tier whose upToCents >= amount (inclusive bound)", () => {
      // Faixa 1 (até R$ 1.000,00 → R$ 5,00)
      expect(computeWithdrawFee(500)).toBe(500); // abaixo do mínimo — função pura
      expect(computeWithdrawFee(2000)).toBe(500); // R$ 20,00
      expect(computeWithdrawFee(99_999)).toBe(500);
      expect(computeWithdrawFee(100_000)).toBe(500); // borda inclusiva
      // Faixa 2 (até R$ 2.000,00 → R$ 3,00)
      expect(computeWithdrawFee(100_001)).toBe(300);
      expect(computeWithdrawFee(199_999)).toBe(300);
      expect(computeWithdrawFee(200_000)).toBe(300); // borda inclusiva
      // Faixa 3 (até R$ 3.000,00 → R$ 2,00)
      expect(computeWithdrawFee(200_001)).toBe(200);
      expect(computeWithdrawFee(299_999)).toBe(200);
    });

    it("is free at/above freeFromCents", () => {
      expect(computeWithdrawFee(300_000)).toBe(0);
      expect(computeWithdrawFee(500_000)).toBe(0);
      expect(computeWithdrawFee(1_000_000)).toBe(0);
    });

    it("keeps the fee within [0, first tier fee] for any amount", () => {
      for (let amount = 1; amount <= 1_000_000; amount += 997) {
        const fee = computeWithdrawFee(amount);
        expect(fee).toBeGreaterThanOrEqual(0);
        expect(fee).toBeLessThanOrEqual(500);
      }
    });
  });

  describe("computeLiquidAmountCents", () => {
    it("subtracts the fee from the requested amount", () => {
      expect(computeLiquidAmountCents(2000, 500)).toBe(1500);
      expect(computeLiquidAmountCents(300_000, 0)).toBe(300_000);
    });
  });

  describe("generateWithdrawIdempotencyKey", () => {
    it("is namespaced per organization and unique across calls", () => {
      const key = generateWithdrawIdempotencyKey("org-1");
      expect(key.startsWith("bropen:withdraw:org-1:")).toBe(true);
      expect(generateWithdrawIdempotencyKey("org-1")).not.toBe(key);
      expect(
        generateWithdrawIdempotencyKey("org-2").startsWith(
          "bropen:withdraw:org-2:"
        )
      ).toBe(true);
    });
  });

  describe("isPendingInFlight", () => {
    it("is true only for pending rows without a provider id", () => {
      expect(isPendingInFlight(null)).toBe(false);
      expect(isPendingInFlight(row({}))).toBe(true);
      expect(isPendingInFlight(row({ wooviWithdrawId: "tx-1" }))).toBe(false);
      expect(
        isPendingInFlight(row({ status: "completed", wooviWithdrawId: "tx-1" }))
      ).toBe(false);
      expect(isPendingInFlight(row({ status: "failed" }))).toBe(false);
    });
  });

  describe("resolveWithdrawalReservation", () => {
    it("replays the row when the same idempotency key was already reserved", () => {
      const byKey = row({ status: "pending", wooviWithdrawId: "tx-1" });
      expect(resolveWithdrawalReservation({ byKey, pendingForOrg: null })).toBe(
        byKey
      );
    });

    it("replays a different pending row still in flight for the org", () => {
      const pendingForOrg = row({});
      expect(resolveWithdrawalReservation({ byKey: null, pendingForOrg })).toBe(
        pendingForOrg
      );
    });

    it("does NOT replay a pending row that already has a provider id (BUG-0001)", () => {
      const executed = row({ status: "pending", wooviWithdrawId: "tx-1" });
      expect(
        resolveWithdrawalReservation({ byKey: null, pendingForOrg: executed })
      ).toBeNull();
    });

    it("does NOT replay completed/failed rows for the org", () => {
      expect(
        resolveWithdrawalReservation({
          byKey: null,
          pendingForOrg: row({ status: "completed", wooviWithdrawId: "tx-1" }),
        })
      ).toBeNull();
      expect(
        resolveWithdrawalReservation({
          byKey: null,
          pendingForOrg: row({ status: "failed" }),
        })
      ).toBeNull();
    });

    it("creates when nothing is in flight", () => {
      expect(
        resolveWithdrawalReservation({ byKey: null, pendingForOrg: null })
      ).toBeNull();
    });
  });

  describe("withdrawal status transitions", () => {
    it("completes only from pending", () => {
      expect(canCompleteWithdrawal("pending")).toBe(true);
      expect(canCompleteWithdrawal("completed")).toBe(false);
      expect(canCompleteWithdrawal("failed")).toBe(false);
    });

    it("fails from pending or completed, never from failed", () => {
      expect(canFailWithdrawal("pending")).toBe(true);
      expect(canFailWithdrawal("completed")).toBe(true);
      expect(canFailWithdrawal("failed")).toBe(false);
    });
  });

  describe("fee collection lifecycle (BUG-0006)", () => {
    it("a tiered fee starts pending, a free withdrawal owes nothing", () => {
      expect(initialFeeStatus(500)).toBe("pending");
      expect(initialFeeStatus(0)).toBe("not_owed");
    });

    it("the sweep retries only completed rows with a pending fee", () => {
      expect(
        isFeeCollectionDue({ feeStatus: "pending", status: "completed" })
      ).toBe(true);
      expect(
        isFeeCollectionDue({ feeStatus: "pending", status: "pending" })
      ).toBe(false);
      expect(
        isFeeCollectionDue({ feeStatus: "pending", status: "failed" })
      ).toBe(false);
      expect(
        isFeeCollectionDue({ feeStatus: "collected", status: "completed" })
      ).toBe(false);
      expect(
        isFeeCollectionDue({ feeStatus: "not_owed", status: "completed" })
      ).toBe(false);
    });

    // Both race guards delegate to this rule — isWithdrawFeeStillDue
    // (pre-debit skip) and markWithdrawFeeCollected (pre-flip re-check, keeps
    // the webhook's failureReason).
    it("a MOVEMENT_FAILED after the sweep snapshot makes the item stale", () => {
      // Snapshot said completed + pending fee...
      expect(
        isFeeCollectionDue({ feeStatus: "pending", status: "completed" })
      ).toBe(true);
      // ...but the webhook flipped the row to failed before the debit /
      // flip — both guards must reject it (no debit, no wiped reason).
      expect(
        isFeeCollectionDue({ feeStatus: "not_owed", status: "failed" })
      ).toBe(false);
      expect(
        isFeeCollectionDue({ feeStatus: "pending", status: "failed" })
      ).toBe(false);
    });

    it("a failed movement cancels a pending fee but keeps a collected one", () => {
      expect(feeStatusAfterFailure("pending")).toBe("not_owed");
      expect(feeStatusAfterFailure("collected")).toBeNull();
      expect(feeStatusAfterFailure("not_owed")).toBeNull();
      expect(feeStatusAfterFailure(null)).toBeNull();
    });
  });

  describe("reserva de estorno (BUG-0079)", () => {
    const charge = (overrides: Partial<RefundableCharge>) => ({
      amountCents: 10_000,
      refundStatus: null,
      splitConfig: { organizerCents: 9000 },
      status: "PAID",
      ...overrides,
    });

    describe("computeReservedCents", () => {
      it("soma só o que está com estorno EM ABERTO", () => {
        expect(
          computeReservedCents([
            charge({ refundStatus: "pending" }),
            charge({ refundStatus: "failed" }),
            charge({ refundStatus: null }),
            charge({ refundStatus: "refunded" }),
          ])
        ).toBe(18_000);
      });

      // Legado: `status: REFUNDED` com o refundStatus preso em pending|failed e
      // dinheiro que JA voltou — nao pode seguir descontando o organizador.
      it("uma cobrança REFUNDED com refundStatus preso NÃO conta", () => {
        expect(
          computeReservedCents([
            charge({ refundStatus: "pending", status: "REFUNDED" }),
            charge({ refundStatus: "failed", status: "REFUNDED" }),
          ])
        ).toBe(0);
        // O irmão PAID da mesma leva continua contando.
        expect(
          computeReservedCents([
            charge({ refundStatus: "pending", status: "REFUNDED" }),
            charge({ refundStatus: "pending", status: "PAID" }),
          ])
        ).toBe(9000);
      });

      it("sem estorno aberto a reserva é zero (lista vazia inclusive)", () => {
        expect(computeReservedCents([])).toBe(0);
        expect(
          computeReservedCents([
            charge({ refundStatus: null }),
            charge({ refundStatus: "refunded" }),
          ])
        ).toBe(0);
      });

      it("usa a PARTE do organizador quando existe split (mesma conta da receita)", () => {
        expect(
          computeReservedCents([
            charge({ amountCents: 10_000, refundStatus: "pending" }),
          ])
        ).toBe(9000);
      });

      it("sem split a linha antiga reserva o valor cheio", () => {
        expect(
          computeReservedCents([
            charge({
              amountCents: 7500,
              refundStatus: "pending",
              splitConfig: null,
            }),
          ])
        ).toBe(7500);
      });
    });

    describe("computeAvailableCents", () => {
      it("desconta a reserva do saldo (o que sobra continua sacável)", () => {
        expect(
          computeAvailableCents({ balanceCents: 50_000, reservedCents: 12_000 })
        ).toBe(38_000);
      });

      it("sem reserva o disponível é o saldo inteiro", () => {
        expect(
          computeAvailableCents({ balanceCents: 50_000, reservedCents: 0 })
        ).toBe(50_000);
      });

      it("reserva que come tudo zera o disponível, nunca negativo", () => {
        expect(
          computeAvailableCents({ balanceCents: 30_000, reservedCents: 30_000 })
        ).toBe(0);
        expect(
          computeAvailableCents({ balanceCents: 30_000, reservedCents: 95_000 })
        ).toBe(0);
      });
    });
  });
});
