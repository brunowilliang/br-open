import { useCallback, useRef } from "react";

/**
 * Idempotência do saque no cliente (BUG-0005): o endpoint de saque da Woovi
 * não aceita correlationID, então o backend deduplica localmente pela
 * `idempotencyKey` única da linha `withdrawals`. A chave precisa ser ESTÁVEL
 * por tentativa — se a resposta do 1º POST se perder mas o saque ocorrer, o
 * retry com a MESMA chave faz replay da reserva em vez de um 2º POST
 * (dinheiro duplicado + fee dupla). A chave é liberada no sucesso confirmado
 * OU na falha definitiva (CONFLICT de linha failed — ver errors.ts), quando
 * não há mais nada a proteger.
 */

/** Chave de cliente (a gerada no backend é `bropen:withdraw:<orgId>:…`). */
export function createWithdrawIdempotencyKey(): string {
  // Hermes não expõe crypto.randomUUID sem polyfill — Date.now + Math.random
  // bastam: a chave só precisa ser única por tentativa (dedup local), não é
  // segredo. Contrato do backend: z.string().min(1).max(128).
  const random = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  return `bropen:withdraw:client:${random}`;
}

/** Ciclo de vida da chave por tentativa. */
export type WithdrawAttemptKeyLifecycle = {
  /** Chave da tentativa atual — gera na 1ª chamada e preserva até sucesso. */
  attemptKey: () => string;
  /** Sucesso confirmado: a próxima tentativa ganha chave nova. */
  confirmed: () => void;
};

/**
 * Puro (sem React) para ser testável: `attemptKey()` gera na 1ª chamada e
 * PRESERVA entre erros/retries da mesma tentativa; `confirmed()` reseta —
 * a próxima tentativa ganha chave nova.
 */
export function createWithdrawAttemptKeyLifecycle(): WithdrawAttemptKeyLifecycle {
  let current: string | null = null;
  return {
    attemptKey(): string {
      current ??= createWithdrawIdempotencyKey();
      return current;
    },
    confirmed(): void {
      current = null;
    },
  };
}

/**
 * Binding do ciclo de vida para a tela `/withdraw`: a tentativa vive em
 * useRef — a chave atravessa erros/toasts na mesma tela e só é trocada
 * depois de um sucesso confirmado (BUG-0005).
 */
export function useWithdrawIdempotencyKey() {
  const lifecycleRef = useRef<WithdrawAttemptKeyLifecycle | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = createWithdrawAttemptKeyLifecycle();
  }
  const attemptKey = useCallback(() => lifecycleRef.current!.attemptKey(), []);
  const confirmed = useCallback(() => lifecycleRef.current!.confirmed(), []);
  return { attemptKey, confirmed };
}
