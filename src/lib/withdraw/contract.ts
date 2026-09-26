/**
 * Contrato da feature de saque do organizador — namespace `payment/withdraw`.
 * Espelha `convex/domains/payment/contract.ts` e deve produzir o mesmo shape de
 * `ApiOutputs["payment"]["withdraw"][...]` do codegen (manter em sync).
 *
 * A tabela de taxa vem do backend, nunca hardcoded no frontend.
 */

/** payment/withdraw:getBalance — saldo real da subconta + regras de taxa + destino. */
export type WithdrawBalance = {
  /** Nome da conta (titular/apelido) exibido no destino; null em chaves
   * cadastradas antes do campo existir — a tela cai no rótulo "Chave PIX". */
  accountName: string | null;
  balanceCents: number;
  /** Mínimo de saque (centavos) — vem do backend, nunca hardcode. */
  minWithdrawCents: number;
  /** Faixas ordenadas por `upToCents` crescente; o fee aplicado é o do primeiro
   * tier cujo `upToCents >= amountCents`. */
  feeTiers: { feeCents: number; upToCents: number }[];
  /** Acima deste valor (centavos) o saque é grátis. */
  freeFromCents: number;
  /** Chave PIX de destino, mascarada (mesmo tratamento do onboarding). */
  pixKey: string;
  /**
   * Dinheiro da organização preso em cobranças com estorno EM ABERTO
   * (pending|failed): sai do DISPONÍVEL, nunca do saldo real. O card mostra este
   * valor e o disponível (`balanceCents - reservedCents`).
   */
  reservedCents: number;
};

/** payment/withdraw:requestWithdraw — input. */
export type WithdrawRequestInput = {
  amountCents: number;
  /**
   * Chave de idempotência ESTÁVEL por tentativa: preservada entre erros/retries
   * da mesma tentativa (nunca gerar uma nova a cada POST) — o backend faz
   * replay da reserva `withdrawals` em vez de um 2º POST ao provedor (dinheiro
   * e fee duplicados quando a resposta do 1º POST se perde). Nova chave só após
   * sucesso confirmado (`src/lib/withdraw/idempotency.ts`); gerada server-side
   * quando ausente.
   */
  idempotencyKey?: string;
};

/** payment/withdraw:requestWithdraw — resultado. */
export type WithdrawRequestResult = {
  feeCents: number;
  /** Valor transferido após a taxa (centavos). */
  liquidAmountCents: number;
  /** pending|failed|completed (WITHDRAW_STATUSES do backend). */
  status: string;
};
