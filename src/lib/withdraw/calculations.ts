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

export type WithdrawAmountValidation =
  | { ok: true }
  | { message: string; ok: false };

/**
 * Regras de negócio do contrato: mínimo (minWithdrawCents, do backend) e
 * máximo = saldo disponível.
 */
export function validateWithdrawAmountCents(
  amountCents: number,
  input: {
    balanceCents: number;
    minWithdrawCents: number;
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
  if (amountCents > input.balanceCents) {
    return {
      message: "O valor não pode ser maior que o saldo disponível.",
      ok: false,
    };
  }
  return { ok: true };
}
