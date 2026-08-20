import { describe, expect, test } from "bun:test";

import {
  getSecurityErrorMessage,
  isSocialAuthCanceledError,
  isSessionNotFreshError,
} from "./security-errors";

const FALLBACK = "Não foi possível concluir a ação. Tente novamente.";

function authError(code?: string, message?: string) {
  return { code, message, status: 400 };
}

describe("getSecurityErrorMessage", () => {
  test("mapeia INVALID_PASSWORD para senha atual incorreta", () => {
    expect(
      getSecurityErrorMessage(
        authError("INVALID_PASSWORD", "Invalid password"),
        FALLBACK
      )
    ).toBe("Senha atual incorreta. Tente novamente.");
  });

  test("mapeia FAILED_TO_UNLINK_LAST_ACCOUNT para última forma de login", () => {
    expect(
      getSecurityErrorMessage(
        authError(
          "FAILED_TO_UNLINK_LAST_ACCOUNT",
          "You can't unlink your last account"
        ),
        FALLBACK
      )
    ).toBe(
      "Essa é sua última forma de login — conecte outra antes de remover."
    );
  });

  test("mapeia LINKING_DIFFERENT_EMAILS_NOT_ALLOWED para Apple ID com e-mail privado", () => {
    expect(
      getSecurityErrorMessage(
        authError(
          "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED",
          "Account not linked - different emails not allowed"
        ),
        FALLBACK
      )
    ).toBe(
      "Esse Apple ID usa um e-mail privado diferente do e-mail da sua conta. Use o Apple ID do mesmo e-mail."
    );
  });

  test("mapeia os erros de OTP do fluxo de troca de e-mail", () => {
    expect(
      getSecurityErrorMessage(authError("OTP_EXPIRED", "OTP expired"), FALLBACK)
    ).toBe("O código expirou. Solicite um novo.");
    expect(
      getSecurityErrorMessage(authError("INVALID_OTP", "Invalid OTP"), FALLBACK)
    ).toBe("Código inválido. Confira os dígitos e tente novamente.");
    expect(
      getSecurityErrorMessage(
        authError("TOO_MANY_ATTEMPTS", "Too many attempts"),
        FALLBACK
      )
    ).toBe("Muitas tentativas com o código. Aguarde um pouco e tente de novo.");
  });

  test("mapeia 'Email already in use' pelo texto (erro sem code próprio)", () => {
    expect(
      getSecurityErrorMessage(
        authError(undefined, "Email already in use"),
        FALLBACK
      )
    ).toBe("Esse e-mail já está em uso por outra conta.");
  });

  test("mapeia 'Email is the same' pelo texto", () => {
    expect(
      getSecurityErrorMessage(
        authError(undefined, "Email is the same"),
        FALLBACK
      )
    ).toBe("O novo e-mail é igual ao e-mail atual da sua conta.");
  });

  test("mapeia flag de troca de e-mail desligada (backend em paralelo)", () => {
    expect(
      getSecurityErrorMessage(
        authError(undefined, "Change email with OTP is disabled"),
        FALLBACK
      )
    ).toBe(
      "A troca de e-mail ainda não está disponível. Tente novamente mais tarde."
    );
  });

  test("mapeia Apple nativa indisponível pelo texto (Error comum do device)", () => {
    expect(
      getSecurityErrorMessage(
        new Error(
          "Login nativo com Apple indisponível neste build. Rebuild o app iOS."
        ),
        FALLBACK
      )
    ).toBe(
      "Login nativo com Apple não está disponível neste dispositivo. Atualize o app e tente novamente."
    );
  });

  test("mapeia CREDENTIAL_ACCOUNT_NOT_FOUND para conta sem senha", () => {
    expect(
      getSecurityErrorMessage(
        authError(
          "CREDENTIAL_ACCOUNT_NOT_FOUND",
          "Credential account not found"
        ),
        FALLBACK
      )
    ).toBe("Sua conta não tem senha cadastrada.");
  });

  test("mapeia INVALID_EMAIL do requestEmailChange (single-OTP)", () => {
    expect(getSecurityErrorMessage(authError("INVALID_EMAIL"), FALLBACK)).toBe(
      "Informe um e-mail válido."
    );
  });

  test("mapeia os erros de senha do reset por OTP (8-128 do better-auth)", () => {
    expect(
      getSecurityErrorMessage(authError("PASSWORD_TOO_SHORT"), FALLBACK)
    ).toBe("A nova senha deve ter no mínimo 8 caracteres.");
    expect(
      getSecurityErrorMessage(authError("PASSWORD_TOO_LONG"), FALLBACK)
    ).toBe("A nova senha deve ter no máximo 128 caracteres.");
  });

  test("mapeia USER_NOT_FOUND do check de OTP com e-mail inexistente", () => {
    expect(getSecurityErrorMessage(authError("USER_NOT_FOUND"), FALLBACK)).toBe(
      "Não encontramos uma conta com esse e-mail."
    );
  });

  test("retorna o fallback para erro desconhecido", () => {
    expect(
      getSecurityErrorMessage(authError("SOMETHING_ELSE", "weird"), FALLBACK)
    ).toBe(FALLBACK);
    expect(getSecurityErrorMessage(new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(getSecurityErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });

  test("prioriza o code sobre o message quando ambos mapeiam", () => {
    expect(
      getSecurityErrorMessage(
        authError("INVALID_OTP", "Email already in use"),
        FALLBACK
      )
    ).toBe("Código inválido. Confira os dígitos e tente novamente.");
  });
});

describe("isSessionNotFreshError", () => {
  test("detecta pelo code SESSION_NOT_FRESH", () => {
    expect(
      isSessionNotFreshError(
        authError("SESSION_NOT_FRESH", "Session is not fresh")
      )
    ).toBe(true);
  });

  test("não detecta outros erros", () => {
    expect(
      isSessionNotFreshError(authError("INVALID_OTP", "Invalid OTP"))
    ).toBe(false);
    expect(isSessionNotFreshError(new Error("Session is not fresh"))).toBe(
      false
    );
    expect(isSessionNotFreshError(undefined)).toBe(false);
  });
});

describe("isSocialAuthCanceledError", () => {
  test("detecta cancelamento da Apple", () => {
    expect(
      isSocialAuthCanceledError(
        new Error("The user canceled the authorization attempt")
      )
    ).toBe(true);
  });

  test("detecta cancelamento do Google (browser auth)", () => {
    expect(
      isSocialAuthCanceledError(
        new Error("Authentication did not complete. Try again.")
      )
    ).toBe(true);
  });

  test("não detecta outros erros", () => {
    expect(isSocialAuthCanceledError(new Error("boom"))).toBe(false);
    expect(isSocialAuthCanceledError(undefined)).toBe(false);
  });
});
