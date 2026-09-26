import { describe, expect, it } from "bun:test";

import type { PaymentChargeStatus } from "@convex/domains/payment/contract";

import {
  formatPaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusMeta,
  PAYMENT_STATUS_META,
} from "./status";

describe("PAYMENT_STATUS_META", () => {
  it("apresenta só os estados que o app escreve", () => {
    expect(Object.keys(PAYMENT_STATUS_META).sort()).toEqual([
      "CANCELED",
      "EXPIRED",
      "FAILED",
      "PAID",
      "PENDING",
      "REFUNDED",
    ]);
  });

  it("o cancelamento tem rótulo e cor próprios", () => {
    expect(PAYMENT_STATUS_META.CANCELED).toEqual({
      color: "default",
      label: "Cancelado",
      severity: "default",
    });
  });

  it("cada estado tem rótulo, cor do chip e severidade do cartão", () => {
    expect(PAYMENT_STATUS_META.PENDING).toEqual({
      color: "warning",
      label: "Pendente",
      severity: "warning",
    });
    expect(PAYMENT_STATUS_META.PAID).toEqual({
      color: "success",
      label: "Pago",
      severity: "success",
    });
    expect(PAYMENT_STATUS_META.EXPIRED).toEqual({
      color: "danger",
      label: "Expirado",
      severity: "danger",
    });
    expect(PAYMENT_STATUS_META.REFUNDED).toEqual({
      color: "default",
      label: "Reembolsado",
      severity: "default",
    });
  });
});

describe("rótulo e cor do estado", () => {
  it("saem da tabela para os estados apresentáveis", () => {
    for (const [status, meta] of Object.entries(PAYMENT_STATUS_META)) {
      expect(formatPaymentStatus(status as PaymentChargeStatus)).toBe(
        meta.label
      );
      expect(getPaymentStatusColor(status as PaymentChargeStatus)).toBe(
        meta.color
      );
    }
  });

  it("não inventam rótulo para estado fora do enum", () => {
    // Valor de um bundle antigo ou de um servidor mais novo: o chip diz que não
    // identificou, nunca o valor cru.
    expect(getPaymentStatusMeta("WAT" as PaymentChargeStatus)).toBeNull();
    expect(formatPaymentStatus("WAT" as PaymentChargeStatus)).toBe(
      "Não identificado"
    );
    expect(getPaymentStatusColor("WAT" as PaymentChargeStatus)).toBe("default");
  });
});
