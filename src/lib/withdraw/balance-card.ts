import { formatCurrencyCents } from "@/lib/format/currency";

import { computeAvailableForWithdrawCents } from "./calculations";
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
  // o card mostra o DISPONÍVEL (saldo menos a reserva de estorno em aberto),
  // não um saque em si, então a copy informa o piso sem afirmar que o saldo
  // atual é grátis (saldo alto + saque pequeno = taxa normal).
  const availableCents = computeAvailableForWithdrawCents({
    balanceCents: input.balance.balanceCents,
    reservedCents: input.balance.reservedCents,
  });

  return {
    description:
      input.balance.reservedCents > 0
        ? `${formatCurrencyCents(
            input.balance.reservedCents
          )} reservado para estornos em andamento.`
        : `Saques grátis a partir de ${formatCurrencyCents(input.balance.freeFromCents)}.`,
    info: buildWithdrawInfoContent(input.balance),
    isLoading: false,
    value: formatCurrencyCents(availableCents),
  };
}
