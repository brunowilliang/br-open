import { describe, expect, it } from "bun:test";

import { buildWithdrawBalanceCard } from "./balance-card";

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
  reservedCents: 0,
};

describe("buildWithdrawBalanceCard", () => {
  it("mostra o saldo formatado e o piso de gratuidade (a taxa depende do valor sacado)", () => {
    const card = buildWithdrawBalanceCard({
      balance: BALANCE,
      isError: false,
      isPending: false,
    });

    expect(card.isLoading).toBe(false);
    expect(card.value).toBe("R$ 5.000,00");
    // Saldo alto NÃO significa saque grátis: a copy informa o piso, sem
    // afirmar que o saldo atual está isento (saldo R$ 5.000 + saque R$ 100
    // → taxa normal).
    expect(card.description).toBe("Saques grátis a partir de R$ 3.000,00.");
    expect(card.info?.title).toBe("Saldo disponível");
  });

  it("mantém a copy do piso mesmo com saldo abaixo dele", () => {
    const card = buildWithdrawBalanceCard({
      balance: { ...BALANCE, balanceCents: 150_000 },
      isError: false,
      isPending: false,
    });

    expect(card.value).toBe("R$ 1.500,00");
    expect(card.description).toBe("Saques grátis a partir de R$ 3.000,00.");
  });

  it("com estorno em aberto mostra o DISPONÍVEL e explica a reserva", () => {
    const card = buildWithdrawBalanceCard({
      balance: { ...BALANCE, reservedCents: 120_000 },
      isError: false,
      isPending: false,
    });

    // R$ 5.000,00 de saldo menos R$ 1.200,00 reservado = R$ 3.800,00 sacáveis.
    expect(card.value).toBe("R$ 3.800,00");
    expect(card.description).toBe(
      "R$ 1.200,00 reservado para estornos em andamento."
    );
    expect(card.info?.description).toContain("R$ 1.200,00 está reservado");
  });

  it("reserva que come tudo zera o disponível sem esconder o card", () => {
    const card = buildWithdrawBalanceCard({
      balance: { ...BALANCE, reservedCents: 500_000 },
      isError: false,
      isPending: false,
    });

    expect(card.value).toBe("R$ 0,00");
    expect(card.description).toBe(
      "R$ 5.000,00 reservado para estornos em andamento."
    );
  });

  it("entra em loading enquanto a query não resolveu", () => {
    const card = buildWithdrawBalanceCard({
      balance: undefined,
      isError: false,
      isPending: true,
    });

    expect(card.isLoading).toBe(true);
    expect(card.value).toBe("Indisponível");
    expect(card.info).toBeUndefined();
  });

  it("mostra erro sem loading quando a query falhou", () => {
    const card = buildWithdrawBalanceCard({
      balance: undefined,
      isError: true,
      isPending: false,
    });

    expect(card.isLoading).toBe(false);
    expect(card.description).toBe("Não foi possível carregar o saldo.");
  });
});
