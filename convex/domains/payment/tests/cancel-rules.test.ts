import { describe, expect, it } from "bun:test";

import {
  PROVIDER_PROBE_UNREACHABLE,
  resolveChargeCancellationOutcome,
  toProviderCancelProbe,
  type ProviderCancelProbe,
} from "../cancel-rules";

describe("charge cancellation rules", () => {
  describe("resolveChargeCancellationOutcome", () => {
    it("confirms the cancellation when the provider deleted the charge", () => {
      expect(resolveChargeCancellationOutcome({ kind: "deleted" })).toBe(
        "canceled"
      );
    });

    it("confirms the cancellation for a charge the provider does not know", () => {
      // O 400 de "Cobrança não encontrada" e a prova de que o PIX nao existe
      // mais la: o pedido fecha sem ficar tentando para sempre.
      expect(resolveChargeCancellationOutcome({ kind: "missing" })).toBe(
        "canceled"
      );
    });

    it("sends a payment that arrived on the cancelled charge to refund", () => {
      // DELETE recusado porque a cobranca ja estava PAGA: o dinheiro entrou e
      // nao pode ficar parado.
      expect(resolveChargeCancellationOutcome({ kind: "paid" })).toBe(
        "late_payment"
      );
    });

    it("keeps the request unconfirmed when the charge is still alive there", () => {
      expect(resolveChargeCancellationOutcome({ kind: "unconfirmed" })).toBe(
        "failed"
      );
    });
  });

  describe("toProviderCancelProbe", () => {
    it("treats an accepted DELETE as deleted", () => {
      expect(
        toProviderCancelProbe({ deleted: true, providerStatus: "not_found" })
      ).toEqual({ kind: "deleted" });
    });

    it("maps a provider that no longer knows the charge to missing", () => {
      expect(
        toProviderCancelProbe({ deleted: false, providerStatus: "not_found" })
      ).toEqual({ kind: "missing" });
    });

    it("maps a PAID charge to paid", () => {
      expect(
        toProviderCancelProbe({ deleted: false, providerStatus: "PAID" })
      ).toEqual({ kind: "paid" });
    });

    it("keeps PENDING and EXPIRED unconfirmed: the PIX is not proven dead", () => {
      const statuses = ["PENDING", "EXPIRED"] as const;
      for (const providerStatus of statuses) {
        expect(
          toProviderCancelProbe({ deleted: false, providerStatus })
        ).toEqual({ kind: "unconfirmed" });
      }
    });

    it("nao inventa desfecho quando o probe nem respondeu", () => {
      // Provedor mudo: `unreachable` NAO pode virar `missing` (que confirmaria
      // o cancelamento sem prova).
      expect(
        toProviderCancelProbe({
          deleted: false,
          providerStatus: PROVIDER_PROBE_UNREACHABLE,
        })
      ).toEqual({ kind: "unconfirmed" });
    });
  });

  describe("cancelamento de inscricao cancelada (fluxo)", () => {
    it("nunca confirma o cancelamento com o provedor mudo", () => {
      // DELETE recusado e sem resposta de status: o pedido fica `failed` (o
      // sweep retenta) — jamais se passa por PIX morto.
      const probe: ProviderCancelProbe = { kind: "unconfirmed" };
      expect(resolveChargeCancellationOutcome(probe)).not.toBe("canceled");
    });

    it("fecha o pedido em uma unica resposta do provedor", () => {
      // Segunda chamada do cancelamento: com a cobranca ja delecionada la, o
      // desfecho volta a ser `canceled` (idempotente pelo lado do provedor).
      const first = resolveChargeCancellationOutcome({ kind: "deleted" });
      const second = resolveChargeCancellationOutcome(
        toProviderCancelProbe({ deleted: false, providerStatus: "not_found" })
      );
      expect(first).toBe("canceled");
      expect(second).toBe("canceled");
    });
  });
});
