/**
 * Regras puras do username (plugin `username` do better-auth).
 *
 * Espelham os defaults do servidor (verificados no source 1.6.24, ver
 * docs/spec/auth.md → Username): 3–30 chars, charset `[a-zA-Z0-9_.]`,
 * normalização lowercase (o valor canônico é sempre minúsculo).
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export const USERNAME_FIELD_HINT =
  "3 a 30 caracteres: letras, números, ponto e underline. Sempre em minúsculas.";
export const USERNAME_CANNOT_REMOVE_MESSAGE =
  "O username não pode ser removido, apenas trocado.";
export const USERNAME_TAKEN_MESSAGE =
  "Esse username já está em uso. Escolha outro.";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Mensagem de erro de formato (client) ou `null` quando válido/vazio. */
export function validateUsernameFormat(value: string): null | string {
  const normalized = normalizeUsername(value);

  if (!normalized) {
    return null;
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `O username deve ter no mínimo ${USERNAME_MIN_LENGTH} caracteres.`;
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `O username deve ter no máximo ${USERNAME_MAX_LENGTH} caracteres.`;
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use apenas letras, números, ponto e underline.";
  }

  return null;
}

export type UsernameSubmitIssue = "cannot_remove" | null;

/**
 * Issue de submit que o schema estático não cobre: username já definido não
 * pode ser removido (o servidor rejeita string vazia pelo mínimo de 3 chars).
 */
export function resolveUsernameSubmitIssue(input: {
  currentUsername: null | string | undefined;
  value: string;
}): UsernameSubmitIssue {
  const current = normalizeUsername(input.currentUsername ?? "");

  if (current && !normalizeUsername(input.value)) {
    return "cannot_remove";
  }

  return null;
}

/** Deve checar disponibilidade no servidor? (formato válido, mudou, não vazio) */
export function shouldCheckUsernameAvailability(input: {
  currentUsername: null | string | undefined;
  value: string;
}): boolean {
  const normalized = normalizeUsername(input.value);
  const current = normalizeUsername(input.currentUsername ?? "");

  return normalized && normalized !== current
    ? validateUsernameFormat(normalized) === null
    : false;
}
