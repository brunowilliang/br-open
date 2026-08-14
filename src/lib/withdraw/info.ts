import { formatCurrencyCents } from "@/lib/format/currency";

import type { WithdrawBalance } from "./contract";

export type WithdrawInfoContent = {
  description: string;
  title: string;
};

export type WithdrawFeeLine = {
  label: string;
  value: string;
};

/**
 * Linhas legíveis da tabela de taxas (faixas escalonadas do DECISAO-003),
 * derivadas do `getBalance` — nunca hardcoded. A última linha é a
 * gratuidade a partir do piso. Fonte única: usada na tela de saque e no
 * dialog de explicação do card de saldo.
 */
export function buildWithdrawFeeLines(
  balance: WithdrawBalance
): WithdrawFeeLine[] {
  return [
    ...balance.feeTiers.map((tier) => ({
      label: `até ${formatCurrencyCents(tier.upToCents)}`,
      value: formatCurrencyCents(tier.feeCents),
    })),
    {
      label: `a partir de ${formatCurrencyCents(balance.freeFromCents)}`,
      value: "Grátis",
    },
  ];
}

/**
 * Texto de explicação do card de saldo (withdraw-card): o que é o saldo,
 * mínimo de saque e a tabela de taxas — tudo derivado do `getBalance`
 * (backend), nunca hardcoded no frontend.
 */
export function buildWithdrawInfoContent(
  balance: WithdrawBalance
): WithdrawInfoContent {
  const feeLines = buildWithdrawFeeLines(balance).map(
    (line) => `· ${line.label} → ${line.value}`
  );

  return {
    description: [
      "O saldo é o dinheiro das inscrições da sua organização, guardado na sua subconta Woovi.",
      `Mínimo de saque: ${formatCurrencyCents(balance.minWithdrawCents)}.`,
      "Taxas por faixa:",
      ...feeLines,
    ].join("\n"),
    title: "Saldo disponível",
  };
}
