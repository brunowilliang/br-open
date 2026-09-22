/**
 * `payment/withdraw:getBalance` lança PRECONDITION_FAILED quando a organização
 * ainda não tem conta de pagamento ativa. O code chega ao cliente em
 * `error.data.code` (o CRPCError do backend estende ConvexError e serializa
 * `{ code, message }` no data); `error.code` cobre transportes que exponham o
 * code direto.
 */
export function isMissingPaymentAccountError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const data = (error as { data?: { code?: unknown } }).data;
  if (data && typeof data === "object" && data.code === "PRECONDITION_FAILED") {
    return true;
  }
  return (error as { code?: unknown }).code === "PRECONDITION_FAILED";
}

/**
 * `payment/withdraw:requestWithdraw` lança CONFLICT em um único caso: replay de
 * linha `failed` (o provedor rejeitou o PIX out e a reserva definitiva falhou).
 * Replays de linha pending/completed devolvem sucesso, não erro.
 *
 * Dead-end da UX: nessa falha a chave estável da tentativa já cumpriu seu papel
 * (impediu o 2º POST) e não há mais nada a proteger — a tela libera a chave
 * (`confirmed()`) para o próximo retry nascer com chave nova.
 */
export function isWithdrawConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const data = (error as { data?: { code?: unknown } }).data;
  if (data && typeof data === "object" && data.code === "CONFLICT") {
    return true;
  }
  return (error as { code?: unknown }).code === "CONFLICT";
}
