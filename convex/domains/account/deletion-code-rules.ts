export const DELETION_CODE_LENGTH = 6;
export const DELETION_CODE_MAX_ATTEMPTS = 5;
export const DELETION_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
export const DELETION_CODE_TTL_MS = 10 * 60 * 1000;

/** Bytes aleatórios (crypto.getRandomValues, ctx de action) viram os dígitos. */
export function generateDeletionCode(randomBytes: Uint8Array): string {
  return [...randomBytes].map((value) => String(value % 10)).join("");
}

export function isDeletionCodeFormatValid(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Cooldown de reenvio só vale para um pedido REALMENTE recente; linha ausente
 * (`null`) libera.
 */
export function resolveDeletionCodeRequestGate(input: {
  requestedAtMs: null | number;
  nowMs: number;
}): "allowed" | "cooldown" {
  if (
    input.requestedAtMs !== null &&
    input.nowMs - input.requestedAtMs < DELETION_CODE_RESEND_COOLDOWN_MS
  ) {
    return "cooldown";
  }
  return "allowed";
}

/**
 * Ordem das recusas importa pro UX: vazio (envio ainda não fechou) e expirado
 * mandam pedir código novo; esgotado idem; errado conta a tentativa e devolve
 * quantas restam.
 */
export function resolveDeletionCodeCheck(input: {
  attempts: number;
  codeHash: string;
  expiresAtMs: number;
  nowMs: number;
  submittedHash: string;
}):
  | { status: "ok" }
  | { status: "expired" }
  | { status: "exhausted" }
  | { status: "invalid"; attemptsLeft: number } {
  if (input.codeHash.length === 0 || input.nowMs >= input.expiresAtMs) {
    return { status: "expired" };
  }
  if (input.attempts >= DELETION_CODE_MAX_ATTEMPTS) {
    return { status: "exhausted" };
  }
  if (input.submittedHash !== input.codeHash) {
    return {
      attemptsLeft: Math.max(
        0,
        DELETION_CODE_MAX_ATTEMPTS - input.attempts - 1
      ),
      status: "invalid",
    };
  }
  return { status: "ok" };
}
