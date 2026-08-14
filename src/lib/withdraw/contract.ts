/**
 * Contrato da feature de saque do organizador (DECISAO-003) — namespace
 * `payment/withdraw`.
 *
 * Espelha `convex/domains/payment/contract.ts` (`withdrawBalanceSchema`,
 * `requestWithdrawOutputSchema`) — o backend existe em
 * `convex/functions/payment/withdraw.ts` (`getBalance`, `requestWithdraw`) e
 * os tipos aqui devem produzir o mesmo shape que
 * `ApiOutputs["payment"]["withdraw"][...]` do codegen (keep both in sync).
 *
 * Modelo de taxa (definido pelo Bruno): FAIXAS ESCALONADAS — a tabela vem
 * do backend, nunca hardcoded no frontend.
 */

/** payment/withdraw:getBalance — saldo real da subconta + regras de taxa + destino. */
export type WithdrawBalance = {
  /**
   * Nome da conta (titular/apelido) exibido no destino do saque (IBX-0002).
   * null para chaves cadastradas antes do campo existir — a tela cai no
   * rótulo genérico "Chave PIX".
   */
  accountName: string | null;
  /** Saldo disponível da subconta (centavos). */
  balanceCents: number;
  /**
   * Mínimo de saque (centavos). O valor vem do backend via getBalance;
   * nunca hardcode no frontend.
   */
  minWithdrawCents: number;
  /**
   * Faixas escalonadas de taxa, ordenadas por `upToCents` crescente.
   * O fee aplicado é o do primeiro tier cujo `upToCents >= amountCents`.
   */
  feeTiers: { feeCents: number; upToCents: number }[];
  /** Acima deste valor (centavos) o saque é grátis. */
  freeFromCents: number;
  /**
   * Chave PIX de destino do saque, mascarada (mesmo tratamento de
   * `payment.onboarding.getStatus`) — IBX-0002.
   */
  pixKey: string;
};

/** payment/withdraw:requestWithdraw — input. */
export type WithdrawRequestInput = {
  amountCents: number;
  /**
   * Chave de idempotência ESTÁVEL por tentativa (BUG-0005): preservada entre
   * erros/retries da mesma tentativa — o backend faz replay da reserva
   * `withdrawals` em vez de um 2º POST ao provedor (dinheiro duplicado +
   * fee dupla quando a resposta do 1º POST se perde). Nova chave só após
   * sucesso confirmado (src/lib/withdraw/idempotency.ts). Gerada
   * server-side quando ausente.
   */
  idempotencyKey?: string;
};

/** payment/withdraw:requestWithdraw — resultado. */
export type WithdrawRequestResult = {
  /** Taxa efetivamente aplicada (centavos). */
  feeCents: number;
  /** Valor líquido que será transferido após a taxa (centavos). */
  liquidAmountCents: number;
  /** Status do saque — pending|failed|completed (WITHDRAW_STATUSES do backend). */
  status: string;
};
