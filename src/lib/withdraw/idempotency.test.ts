import { describe, expect, it } from "bun:test";

import {
  createWithdrawAttemptKeyLifecycle,
  createWithdrawIdempotencyKey,
} from "./idempotency";

describe("withdraw idempotency key", () => {
  it("gera chave de cliente única com prefixo (limite do backend: 128)", () => {
    const a = createWithdrawIdempotencyKey();
    const b = createWithdrawIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.startsWith("bropen:withdraw:client:")).toBe(true);
    expect(a.length).toBeLessThanOrEqual(128);
  });

  it("gera uma vez e preserva a chave entre erros/retries da mesma tentativa", () => {
    const lifecycle = createWithdrawAttemptKeyLifecycle();
    const first = lifecycle.attemptKey();
    // Retry após erro: MESMA chave — o backend faz replay da reserva em
    // vez de um 2º POST (BUG-0005).
    expect(lifecycle.attemptKey()).toBe(first);
  });

  it("reseta a chave somente após sucesso confirmado", () => {
    const lifecycle = createWithdrawAttemptKeyLifecycle();
    const first = lifecycle.attemptKey();
    lifecycle.confirmed();
    expect(lifecycle.attemptKey()).not.toBe(first);
  });
});
