import { describe, expect, it } from "bun:test";

import {
  RECONCILE_PENDING_AFTER_MS,
  RECONCILE_TERMINAL_WINDOW_MS,
  shouldReconcileCharge,
} from "../reconcile-rules";

const NOW = 1_800_000_000_000;

function decide(
  status: Parameters<typeof shouldReconcileCharge>[0]["status"],
  args: { ageMs?: number; cancelStatus?: null | string } = {}
) {
  return shouldReconcileCharge({
    cancelStatus: args.cancelStatus ?? null,
    createdAtMs: NOW - (args.ageMs ?? 0),
    nowMs: NOW,
    status,
  });
}

describe("shouldReconcileCharge", () => {
  it("reconfere a PENDING que passou da janela do webhook", () => {
    expect(decide("PENDING", { ageMs: RECONCILE_PENDING_AFTER_MS + 1 })).toBe(
      true
    );
    expect(decide("PENDING", { ageMs: RECONCILE_PENDING_AFTER_MS - 1 })).toBe(
      false
    );
  });

  it("reconfere a EXPIRED recente (pagamento tardio sem webhook)", () => {
    // O caso do achado A1: o PIX venceu aqui, o webhook de PAID se perdeu e o
    // dinheiro so apareceria na cobranca se alguem perguntasse ao provedor.
    expect(decide("EXPIRED", { ageMs: 60_000 })).toBe(true);
  });

  it("reconfere a CANCELED cujo DELETE nunca foi confirmado", () => {
    expect(decide("CANCELED", { cancelStatus: "pending" })).toBe(true);
    expect(decide("CANCELED", { cancelStatus: "failed" })).toBe(true);
    expect(decide("CANCELED")).toBe(true);
  });

  it("para de reconferir a cobranca terminal fora da janela", () => {
    const ageMs = RECONCILE_TERMINAL_WINDOW_MS + 1;

    expect(decide("EXPIRED", { ageMs })).toBe(false);
    expect(decide("CANCELED", { ageMs, cancelStatus: "failed" })).toBe(false);
  });

  it("nao reconfere cancelamento ja confirmado pelo provedor", () => {
    // DELETE aceito = PIX inexistente la: nao ha dinheiro a descobrir.
    expect(decide("CANCELED", { cancelStatus: "canceled" })).toBe(false);
  });

  it("nao reconfere cobranca com desfecho financeiro", () => {
    expect(decide("PAID")).toBe(false);
    expect(decide("REFUNDED")).toBe(false);
  });

  it("reconfere a FAILED recente, que so o estorno resolve", () => {
    expect(decide("FAILED")).toBe(true);
  });
});
