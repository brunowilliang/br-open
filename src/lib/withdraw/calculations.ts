import { formatCurrencyCents } from "@/lib/format/currency";
import type { WithdrawBalance } from "./contract";

/**
 * Taxa do saque (modelo de faixas escalonadas do DECISAO-003):
 * - grátis quando `amountCents >= freeFromCents`;
 * - senão, o fee do primeiro tier cujo `upToCents >= amountCents`;
 * - acima do maior tier, vale o fee do último (teto);
 * - sem tiers, taxa zero.
 */
export function computeWithdrawFeeCents(input: {
  amountCents: number;
  feeTiers: WithdrawBalance["feeTiers"];
  freeFromCents: number;
}): number {
  const { amountCents, feeTiers, freeFromCents } = input;
  if (amountCents >= freeFromCents) {
    return 0;
  }
  const tier = feeTiers.find((t) => amountCents <= t.upToCents);
  return (tier ?? feeTiers.at(-1))?.feeCents ?? 0;
}

/** Valor líquido estimado: saque menos a taxa aplicável. */
export function computeLiquidAmountCents(
  amountCents: number,
  feeCents: number
): number {
  return amountCents - feeCents;
}

/**
 * DISPONÍVEL para saque = saldo menos a RESERVA de estornos em aberto, nunca
 * negativo (espelho de `computeAvailableCents` do backend). O que sobra continua
 * sacável: estorno nenhum trava o saque inteiro.
 */
export function computeAvailableForWithdrawCents(input: {
  balanceCents: number;
  reservedCents: number;
}): number {
  return Math.max(input.balanceCents - input.reservedCents, 0);
}

export type WithdrawAmountValidation =
  | { ok: true }
  | { message: string; ok: false };

/**
 * Regras de negócio do contrato: mínimo (`minWithdrawCents`, do backend) e
 * máximo = DISPONÍVEL (saldo menos a reserva de estorno em aberto).
 */
export function validateWithdrawAmountCents(
  amountCents: number,
  input: {
    balanceCents: number;
    minWithdrawCents: number;
    reservedCents: number;
  }
): WithdrawAmountValidation {
  if (amountCents < input.minWithdrawCents) {
    return {
      message: `O valor mínimo de saque é ${formatCurrencyCents(
        input.minWithdrawCents
      )}.`,
      ok: false,
    };
  }
  if (amountCents > computeAvailableForWithdrawCents(input)) {
    return {
      message:
        input.reservedCents > 0
          ? `O valor não pode ser maior que o disponível para saque. ${formatCurrencyCents(
              input.reservedCents
            )} está reservado para estornos em andamento.`
          : "O valor não pode ser maior que o saldo disponível.",
      ok: false,
    };
  }
  return { ok: true };
}
