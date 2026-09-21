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
  "3 a 30 caracteres, apenas letras, números, ponto e underline.";
export const USERNAME_REQUIRED_MESSAGE = "Informe um username.";
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

/**
 * Validação do CAMPO do form (o username é obrigatório no perfil): vazio
 * devolve a mensagem de obrigatório, preenchido delega para a regra de
 * formato. O schema do perfil (`profile.tsx`) consome esta função.
 */
export function validateUsernameField(value: string): null | string {
  if (!normalizeUsername(value)) {
    return USERNAME_REQUIRED_MESSAGE;
  }

  return validateUsernameFormat(value);
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
