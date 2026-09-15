/**
 * Mapa de erros de segurança/contas do better-auth para mensagens em pt-BR.
 *
 * Os erros chegam de duas formas:
 * - objeto de erro do client do better-auth (`{code, message, status}`),
 *   retornado em `error` nas chamadas do `authClient`;
 * - `AuthMutationError` do kitcn (mesma forma) ou `Error` comum.
 *
 * O `code` tem prioridade; mensagens sem code próprio (ex.: "Email already in
 * use") são casadas pelo texto.
 */

const CODE_MESSAGES: Record<string, string> = {
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Sua conta não tem senha cadastrada.",
  FAILED_TO_UNLINK_LAST_ACCOUNT:
    "Essa é sua última forma de login. Conecte outra antes de remover.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  INVALID_OTP: "Código inválido. Confira os dígitos e tente novamente.",
  INVALID_PASSWORD: "Senha atual incorreta. Tente novamente.",
  INVALID_USERNAME: "Use apenas letras, números, ponto e underline.",
  LINKING_DIFFERENT_EMAILS_NOT_ALLOWED:
    "Esse Apple ID usa um e-mail privado diferente do e-mail da sua conta. Use o Apple ID do mesmo e-mail.",
  OTP_EXPIRED: "O código expirou. Solicite um novo.",
  PASSWORD_TOO_LONG: "A nova senha deve ter no máximo 128 caracteres.",
  PASSWORD_TOO_SHORT: "A nova senha deve ter no mínimo 8 caracteres.",
  TOO_MANY_ATTEMPTS:
    "Muitas tentativas com o código. Aguarde um pouco e tente de novo.",
  USER_NOT_FOUND: "Não encontramos uma conta com esse e-mail.",
  USERNAME_IS_ALREADY_TAKEN: "Esse username já está em uso. Escolha outro.",
  USERNAME_TOO_LONG: "O username deve ter no máximo 30 caracteres.",
  USERNAME_TOO_SHORT: "O username deve ter no mínimo 3 caracteres.",
};

type PartialAuthError = { code?: string; message?: string };

function asAuthError(error: unknown): PartialAuthError {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  const candidate = error as PartialAuthError;
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
  };
}

function messageFromText(message: string): string | undefined {
  const normalized = message.toLowerCase();

  if (normalized.includes("email already in use")) {
    return "Esse e-mail já está em uso por outra conta.";
  }

  if (normalized.includes("email is the same")) {
    return "O novo e-mail é igual ao e-mail atual da sua conta.";
  }

  if (normalized.includes("change email with otp is disabled")) {
    return "A troca de e-mail ainda não está disponível. Tente novamente mais tarde.";
  }

  if (normalized.includes("indisponível neste build")) {
    return "Login nativo com Apple não está disponível neste dispositivo. Atualize o app e tente novamente.";
  }
}

export function getSecurityErrorMessage(
  error: unknown,
  fallback: string
): string {
  const { code, message } = asAuthError(error);

  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  if (message) {
    return messageFromText(message) ?? fallback;
  }

  return fallback;
}

/** Sessão criada há ≥24h em endpoint sensível (unlink, troca de e-mail) — exige re-login guiado. */
export function isSessionNotFreshError(error: unknown): boolean {
  return asAuthError(error).code === "SESSION_NOT_FRESH";
}

/** Cancelamento pelo usuário no fluxo social (Apple nativa ou browser do Google). */
export function isSocialAuthCanceledError(error: unknown): boolean {
  const message = asAuthError(error).message;

  if (!message) {
    return false;
  }

  return (
    message === "The user canceled the authorization attempt" ||
    message === "Authentication did not complete. Try again."
  );
}
