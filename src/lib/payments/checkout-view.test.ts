import { describe, expect, it } from "bun:test";

import {
  buildCheckoutChargeView,
  resolveCheckoutDisplay,
  resolveCountdownRevalidation,
} from "./checkout-view";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 15, 12);

describe("buildCheckoutChargeView", () => {
  it("keeps the PIX layout while the charge is pending", () => {
    expect(buildCheckoutChargeView({ chargeStatus: "PENDING" })).toBeNull();
  });

  it("asks for a new PIX instead of claiming a payment", () => {
    const view = buildCheckoutChargeView({ chargeStatus: "EXPIRED" });

    expect(view?.actionLabel).toBeNull();
    expect(view?.title).toBe("PIX expirado");
    expect(view?.severity).toBe("warning");
  });

  it("confirms the payment of the entry", () => {
    const view = buildCheckoutChargeView({ chargeStatus: "PAID" });

    expect(view?.actionLabel).toBeNull();
    expect(view?.title).toBe("Pagamento confirmado!");
    expect(view?.severity).toBe("success");
  });

  it("names the failed and refunded charges without promising action", () => {
    const failed = buildCheckoutChargeView({ chargeStatus: "FAILED" });
    const refunded = buildCheckoutChargeView({ chargeStatus: "REFUNDED" });

    expect(failed?.title).toBe("Pagamento não concluído");
    expect(failed?.severity).toBe("warning");
    expect(refunded?.title).toBe("Pagamento reembolsado");
    expect(refunded?.actionLabel).toBeNull();
    expect(refunded?.severity).toBe("warning");
  });
});

describe("resolveCheckoutDisplay", () => {
  const linkCharge = {
    amountCents: 5000,
    brCode: "000201-link",
    chargeId: "charge_from_link",
    expiresAt: new Date(now + DAY).toISOString(),
    qrCodeUrl: "https://qr.example/link.png",
    status: "PENDING",
  } as const;
  const livePendingCharge = {
    ...linkCharge,
    brCode: "000201-pending",
    chargeId: "charge_pending",
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    qrCodeUrl: "https://qr.example/pending.png",
  } as const;

  it("shows the live PIX of the source when the link charge is already terminal", () => {
    const display = resolveCheckoutDisplay({
      context: {
        ...linkCharge,
        chargeId: "charge_paid",
        pendingCharge: livePendingCharge,
        status: "PAID",
      },
      now,
    });

    expect(display.card).toBeNull();
    expect(display.charge.chargeId).toBe("charge_pending");
    expect(display.charge.brCode).toBe("000201-pending");
    expect(display.charge.qrCodeUrl).toBe("https://qr.example/pending.png");
    // O countdown da tela conta o prazo DESTA cobrança.
    expect(display.charge.expiresAt).toBe(livePendingCharge.expiresAt);
  });

  it("confirms the payment when the source has no live charge", () => {
    for (const pendingCharge of [null, undefined]) {
      const display = resolveCheckoutDisplay({
        context: {
          ...linkCharge,
          pendingCharge,
          status: "PAID",
        },
        now,
      });

      expect(display.card?.actionLabel).toBeNull();
      expect(display.card?.title).toBe("Pagamento confirmado!");
    }
  });

  it("keeps the normal PIX flow while the link charge is pending", () => {
    // No fluxo normal o servidor devolve a MESMA cobrança que o link carrega.
    const withPending = resolveCheckoutDisplay({
      context: {
        ...linkCharge,
        pendingCharge: linkCharge,
      },
      now,
    });
    // E uma resposta em cache anterior ao campo aditivo segue funcionando.
    const withoutPending = resolveCheckoutDisplay({
      context: { ...linkCharge },
      now,
    });

    expect(withPending.card).toBeNull();
    expect(withPending.charge.chargeId).toBe("charge_from_link");
    expect(withoutPending.card).toBeNull();
    expect(withoutPending.charge.chargeId).toBe("charge_from_link");
  });

  it("keeps the PIX the server validated even when the device clock runs past it", () => {
    // Aparelho ADIANTADO: o servidor acabou de afirmar que este PIX é
    // utilizável, então esconder a charge dele é o defeito que este teste tranca.
    const display = resolveCheckoutDisplay({
      context: {
        ...linkCharge,
        pendingCharge: {
          ...livePendingCharge,
          expiresAt: new Date(now - 60_000).toISOString(),
        },
        status: "PAID",
      },
      now,
    });

    expect(display.card).toBeNull();
    expect(display.charge.chargeId).toBe("charge_pending");
    expect(display.charge.brCode).toBe("000201-pending");
  });

  it("demotes the link charge by the device clock when nothing pends on the source", () => {
    const expiredLink = resolveCheckoutDisplay({
      context: {
        ...linkCharge,
        expiresAt: new Date(now - 1000).toISOString(),
      },
      now,
    });
    const failed = resolveCheckoutDisplay({
      context: {
        ...linkCharge,
        expiresAt: new Date(now - 1000).toISOString(),
        status: "FAILED",
      },
      now,
    });

    expect(expiredLink.card?.title).toBe("PIX expirado");
    expect(expiredLink.charge.chargeId).toBe("charge_from_link");
    expect(failed.card?.title).toBe("Pagamento não concluído");
  });
});

describe("resolveCountdownRevalidation", () => {
  it("asks exactly one refetch per displayed charge when the countdown runs out", () => {
    const first = resolveCountdownRevalidation({
      displayedChargeId: "charge_pending",
      remainingMs: 0,
      revalidatedChargeId: null,
    });

    expect(first).toEqual({
      chargeId: "charge_pending",
      shouldRefetch: true,
    });

    const second = resolveCountdownRevalidation({
      displayedChargeId: "charge_pending",
      remainingMs: 0,
      revalidatedChargeId: first.chargeId,
    });

    expect(second.shouldRefetch).toBe(false);
  });

  it("stays quiet while the PIX on screen still has time", () => {
    expect(
      resolveCountdownRevalidation({
        displayedChargeId: "charge_pending",
        remainingMs: 1000,
        revalidatedChargeId: null,
      }).shouldRefetch
    ).toBe(false);
  });

  it("stays quiet when the screen shows a card instead of the PIX", () => {
    expect(
      resolveCountdownRevalidation({
        displayedChargeId: null,
        remainingMs: 0,
        revalidatedChargeId: null,
      }).shouldRefetch
    ).toBe(false);
  });
});
