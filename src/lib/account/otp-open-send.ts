/**
 * Decide se a ABERTURA de um dialog de OTP deve enviar um novo código.
 *
 * Abertura e reenvio compartilham o mesmo balde de cooldown (QA round 6,
 * adendo): reabrir o dialog não empilha códigos válidos no inbox — enquanto
 * o cooldown da última tentativa (envio OU reenvio) estiver ativo, a
 * abertura mostra apenas o input com o timer correndo; o código anterior
 * ainda é utilizável.
 */

/** Lê o timestamp persistido (SecureStore, mesma key do `useOtpCooldown`). */
export function shouldSendOtpOnOpen(
  cooldownSeconds: number,
  persistedTimestamp: number | string | null,
  nowMs: number = Date.now()
): boolean {
  if (persistedTimestamp === null) {
    return true;
  }

  const timestamp = Number(persistedTimestamp);

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  const elapsedSeconds = Math.floor((nowMs - timestamp) / 1000);

  return elapsedSeconds >= cooldownSeconds;
}
