import { describe, expect, it } from "bun:test";

import {
  buildCheckoutChargeView,
  resolveCheckoutDisplay,
  resolveCheckoutRenewSignals,
  resolveCountdownRevalidation,
} from "./checkout-view";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 15, 12);

describe("buildCheckoutChargeView", () => {
  it("keeps the PIX layout while the charge is pending", () => {
    expect(
      buildCheckoutChargeView({ canRenew: false, chargeStatus: "PENDING", now })
    ).toBeNull();
    expect(
      buildCheckoutChargeView({ canRenew: true, chargeStatus: "PENDING", now })
    ).toBeNull();
  });

  it("asks for a new PIX instead of claiming a payment", () => {
    const view = buildCheckoutChargeView({
      canRenew: true,
      chargePaidAt: "2026-08-09T12:00:00.000Z",
      chargeStatus: "PAID",
      now,
    });

    expect(view?.actionLabel).toBe("Gerar novo Pix");
    expect(view?.title).toBe("Renove a sua mensalidade");
    expect(view?.description).toContain("Último pagamento em");
    expect(view?.severity).toBe("warning");
    expect(view?.title).not.toContain("Pagamento confirmado");
    expect(view?.description).not.toContain("acessar a liga");
  });

  it("names the membership state in the header when the contract provides it", () => {
    expect(
      buildCheckoutChargeView({
        canRenew: true,
        chargeStatus: "PAID",
        membershipStatus: "payment_due",
        now,
      })?.title
    ).toBe("Mensalidade em atraso");

    const suspended = buildCheckoutChargeView({
      canRenew: true,
      chargeStatus: "PAID",
      membershipStatus: "suspended",
      now,
    });

    expect(suspended?.title).toBe("Inscrição suspensa");
    expect(suspended?.severity).toBe("danger");

    expect(
      buildCheckoutChargeView({
        canRenew: true,
        chargeStatus: "PAID",
        membershipDueAt: now + 2 * DAY,
        membershipStatus: "active",
        now,
      })?.title
    ).toBe("Sua mensalidade vence em 2 dias");
  });

  it("counts the due days on the Brazil calendar", () => {
    // 17/09 01:00Z com now 16/09 23:00Z = a mesma noite no calendário do
    // Brasil (22:00 e 20:00 BRT): vence hoje, igual à notificação.
    expect(
      buildCheckoutChargeView({
        canRenew: true,
        chargeStatus: "PAID",
        membershipDueAt: Date.UTC(2026, 8, 17, 1),
        membershipStatus: "active",
        now: Date.UTC(2026, 8, 16, 23),
      })?.title
    ).toBe("Sua mensalidade vence hoje");
  });

  it("covers every charge state that can still be renewed", () => {
    for (const chargeStatus of ["EXPIRED", "FAILED", "REFUNDED"] as const) {
      const view = buildCheckoutChargeView({
        canRenew: true,
        chargeStatus,
        now,
      });

      expect(view?.actionLabel).toBe("Gerar novo Pix");
      expect(view?.title).toBe("Renove a sua mensalidade");
    }
  });

  it("keeps the success card once the payment settles and renewal stops", () => {
    expect(
      buildCheckoutChargeView({
        canRenew: false,
        chargePaidAt: "2026-09-15T12:00:00.000Z",
        chargeStatus: "PAID",
        now,
      })
    ).toEqual({
      actionLabel: null,
      description:
        "Confirmamos o seu pagamento. Você já pode acessar a liga e começar a jogar!",
      severity: "success",
      title: "Pagamento confirmado!",
    });
  });

  it("states the paid-up membership instead of a dead PIX card", () => {
    const view = buildCheckoutChargeView({
      canRenew: false,
      chargeStatus: "EXPIRED",
      membershipDueAt: now + 27 * DAY,
      membershipStatus: "active",
      now,
    });

    expect(view?.title).toBe("Sua mensalidade vence em 27 dias");
    expect(view?.description).toBe(
      "Você não tem nenhuma cobrança pendente nessa liga."
    );
    expect(view?.actionLabel).toBeNull();
    expect(view?.severity).toBe("success");
  });

  it("keeps the paid-up card without a date when the cycle has none", () => {
    const view = buildCheckoutChargeView({
      canRenew: false,
      chargeStatus: "REFUNDED",
      membershipDueAt: null,
      membershipStatus: "active",
      now,
    });

    expect(view?.title).toBe("Sua mensalidade está em dia");
    expect(view?.actionLabel).toBeNull();
  });

  it("never promises an action on a terminal card without a button", () => {
    for (const chargeStatus of ["EXPIRED", "FAILED", "REFUNDED"] as const) {
      for (const membershipStatus of [null, "active", "left"] as const) {
        const view = buildCheckoutChargeView({
          canRenew: false,
          chargeStatus,
          membershipDueAt: null,
          membershipStatus,
          now,
        });

        expect(view?.actionLabel).toBeNull();
        expect(view?.description).not.toContain("Gere um novo PIX");
      }
    }
  });

  it("never calls a paid-up membership expired", () => {
    for (const chargeStatus of ["EXPIRED", "FAILED", "REFUNDED"] as const) {
      const view = buildCheckoutChargeView({
        canRenew: false,
        chargeStatus,
        membershipDueAt: now + 27 * DAY,
        membershipStatus: "active",
        now,
      });

      expect(view?.title).toBe("Sua mensalidade vence em 27 dias");
      expect(view?.description).not.toContain("esgotou");
      expect(view?.title).not.toContain("expirado");
    }
  });

  it("keeps the expired card without an action when nothing can be charged", () => {
    const view = buildCheckoutChargeView({
      canRenew: false,
      chargeStatus: "EXPIRED",
      now,
    });

    expect(view?.title).toBe("PIX expirado");
    expect(view?.actionLabel).toBeNull();
    expect(view?.severity).toBe("warning");
  });

  it("keeps the success card without promising access while approval is pending", () => {
    const view = buildCheckoutChargeView({
      canRenew: false,
      chargePaidAt: "2026-09-15T12:00:00.000Z",
      chargeStatus: "PAID",
      membershipStatus: "pending",
      now,
    });

    expect(view?.title).toBe("Pagamento confirmado!");
    expect(view?.description).toBe("Aguardando a aprovação do organizador.");
    expect(view?.severity).toBe("success");
    expect(view?.actionLabel).toBeNull();
  });

  it("closes failed and refunded charges with a card instead of a dead PIX layout", () => {
    const failed = buildCheckoutChargeView({
      canRenew: false,
      chargeStatus: "FAILED",
      now,
    });
    const refunded = buildCheckoutChargeView({
      canRenew: false,
      chargeStatus: "REFUNDED",
      now,
    });

    expect(failed?.title).toBe("Pagamento não concluído");
    expect(failed?.actionLabel).toBeNull();
    expect(refunded?.title).toBe("Pagamento reembolsado");
    expect(refunded?.actionLabel).toBeNull();
    expect(refunded?.severity).toBe("warning");
  });
});

describe("resolveCheckoutDisplay", () => {
  const membershipContext = {
    canRenew: true,
    membershipDueAt: null,
    membershipStatus: "payment_due",
    sourceType: "league_membership",
  };
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
        ...membershipContext,
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

  it("asks for a new PIX when the source has no live charge", () => {
    for (const pendingCharge of [null, undefined]) {
      const display = resolveCheckoutDisplay({
        context: {
          ...membershipContext,
          ...linkCharge,
          pendingCharge,
          status: "PAID",
        },
        now,
      });

      expect(display.card?.actionLabel).toBe("Gerar novo Pix");
      expect(display.card?.title).toBe("Mensalidade em atraso");
      expect(display.card?.description).not.toContain("acessar a liga");
    }
  });

  it("keeps the normal PIX flow while the link charge is pending", () => {
    // No fluxo normal o servidor devolve a MESMA cobrança que o link carrega.
    const withPending = resolveCheckoutDisplay({
      context: {
        ...membershipContext,
        ...linkCharge,
        pendingCharge: linkCharge,
      },
      now,
    });
    // E uma resposta em cache anterior ao campo aditivo segue funcionando.
    const withoutPending = resolveCheckoutDisplay({
      context: { ...membershipContext, ...linkCharge },
      now,
    });

    expect(withPending.card).toBeNull();
    expect(withPending.charge.chargeId).toBe("charge_from_link");
    expect(withoutPending.card).toBeNull();
    expect(withoutPending.charge.chargeId).toBe("charge_from_link");
  });

  it("keeps the PIX the server validated even when the device clock runs past it", () => {
    // Aparelho ADIANTADO: o servidor acabou de afirmar que este PIX é
    // utilizável, então esconder a charge dele (e cair no cartão com um CTA
    // que reusa a MESMA charge) é o defeito que este teste tranca.
    const display = resolveCheckoutDisplay({
      context: {
        ...membershipContext,
        ...linkCharge,
        canRenew: false,
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

  it("shows the paid-up membership once the link charge is history and nothing is chargeable", () => {
    const display = resolveCheckoutDisplay({
      context: {
        ...membershipContext,
        ...linkCharge,
        canRenew: false,
        membershipDueAt: now + 27 * DAY,
        membershipStatus: "active",
        status: "EXPIRED",
      },
      now,
    });

    expect(display.card?.title).toBe("Sua mensalidade vence em 27 dias");
    expect(display.card?.actionLabel).toBeNull();
    expect(display.charge.chargeId).toBe("charge_from_link");
  });

  it("demotes the link charge by the device clock when nothing pends on the source", () => {
    const expiredLink = resolveCheckoutDisplay({
      context: {
        ...membershipContext,
        ...linkCharge,
        expiresAt: new Date(now - 1000).toISOString(),
      },
      now,
    });
    const failed = resolveCheckoutDisplay({
      context: {
        ...membershipContext,
        ...linkCharge,
        canRenew: false,
        expiresAt: new Date(now - 1000).toISOString(),
        status: "FAILED",
      },
      now,
    });

    expect(expiredLink.card?.actionLabel).toBe("Gerar novo Pix");
    expect(expiredLink.card?.title).toBe("Mensalidade em atraso");
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

describe("resolveCheckoutRenewSignals", () => {
  const context = {
    canRenew: true,
    membershipDueAt: null,
    membershipStatus: null,
    sourceType: "league_membership",
  };

  it("drives the card header from the live membership state", () => {
    const signals = resolveCheckoutRenewSignals({
      context: { ...context, membershipStatus: "payment_due" },
    });

    expect(signals.canRenew).toBe(true);
    expect(
      buildCheckoutChargeView({
        canRenew: signals.canRenew,
        chargeStatus: "PAID",
        membershipDueAt: signals.membershipDueAt,
        membershipStatus: signals.membershipStatus,
        now,
      })?.title
    ).toBe("Mensalidade em atraso");
  });

  it("keeps the previous behaviour while a cached context carries no canRenew", () => {
    const signals = resolveCheckoutRenewSignals({
      context: {
        membershipDueAt: null,
        membershipStatus: null,
        sourceType: "league_membership",
      },
      paymentItem: { canRegenerate: true },
    });

    expect(signals.canRenew).toBe(true);
    expect(
      buildCheckoutChargeView({
        canRenew: signals.canRenew,
        chargeStatus: "PAID",
        membershipDueAt: signals.membershipDueAt,
        membershipStatus: signals.membershipStatus,
        now,
      })?.title
    ).toBe("Renove a sua mensalidade");
  });

  it("trusts the context over the payments hub when both are present", () => {
    expect(
      resolveCheckoutRenewSignals({
        context: { ...context, canRenew: false },
        paymentItem: { canRegenerate: true },
      }).canRenew
    ).toBe(false);
  });

  it("never renews a charge that is not a league membership", () => {
    expect(
      resolveCheckoutRenewSignals({
        context: { ...context, sourceType: "tournament_entry" },
        paymentItem: { canRegenerate: true },
      }).canRenew
    ).toBe(false);
  });
});
