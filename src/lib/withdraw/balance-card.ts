import { formatCurrencyCents } from "@/lib/format/currency";

import type { WithdrawBalance } from "./contract";
import { buildWithdrawInfoContent } from "./info";

export type WithdrawBalanceCard = {
  description?: string;
  info?: ReturnType<typeof buildWithdrawInfoContent>;
  isLoading: boolean;
  value: string;
};

/**
 * Props derivadas do saldo da subconta (`getBalance`) para o KpiCard do
 * dashboard — loading, erro, gratuidade e dialog de explicação, tudo derivado
 * do backend, nunca hardcoded no frontend.
 */
export function buildWithdrawBalanceCard(input: {
  balance: WithdrawBalance | undefined;
  isError: boolean;
  isPending: boolean;
}): WithdrawBalanceCard {
  if (input.balance === undefined) {
    return {
      description: input.isError
        ? "Não foi possível carregar o saldo."
        : undefined,
      isLoading: input.isPending,
      value: "Indisponível",
    };
  }

  // A taxa depende do VALOR sacado (grátis só a partir de freeFromCents) —
  // o card mostra o saldo, não um saque em si, então a copy informa o piso
  // sem afirmar que o saldo atual é grátis (saldo alto + saque pequeno =
  // taxa normal).
  return {
    description: `Saques grátis a partir de ${formatCurrencyCents(input.balance.freeFromCents)}.`,
    info: buildWithdrawInfoContent(input.balance),
    isLoading: false,
    value: formatCurrencyCents(input.balance.balanceCents),
  };
}
