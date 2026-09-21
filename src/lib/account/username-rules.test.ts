import { describe, expect, test } from "bun:test";

import {
  normalizeUsername,
  shouldCheckUsernameAvailability,
  USERNAME_REQUIRED_MESSAGE,
  validateUsernameField,
  validateUsernameFormat,
} from "./username-rules";

describe("normalizeUsername", () => {
  test("trim + lowercase (o servidor grava o valor canônico minúsculo)", () => {
    expect(normalizeUsername("  Maria.Silva  ")).toBe("maria.silva");
  });
});

describe("validateUsernameFormat", () => {
  test("aceita 3 chars com letras, números, ponto e underline", () => {
    expect(validateUsernameFormat("ab_")).toBeNull();
    expect(validateUsernameFormat("a1.x")).toBeNull();
    expect(validateUsernameFormat("A9_")).toBeNull();
  });

  test("rejeita abaixo do mínimo de 3 (com trim aplicado)", () => {
    expect(validateUsernameFormat("ab")).toBe(
      "O username deve ter no mínimo 3 caracteres."
    );
    expect(validateUsernameFormat("  ab  ")).toBe(
      "O username deve ter no mínimo 3 caracteres."
    );
  });

  test("rejeita acima do máximo de 30", () => {
    expect(validateUsernameFormat("a".repeat(31))).toBe(
      "O username deve ter no máximo 30 caracteres."
    );
    expect(validateUsernameFormat("a".repeat(30))).toBeNull();
  });

  test("rejeita charset fora de [a-zA-Z0-9_.] (espaço, hífen, acento)", () => {
    const message = "Use apenas letras, números, ponto e underline.";

    expect(validateUsernameFormat("joão.silva")).toBe(message);
    expect(validateUsernameFormat("maria-silva")).toBe(message);
    expect(validateUsernameFormat("maria silva")).toBe(message);
    expect(validateUsernameFormat("maria@silva")).toBe(message);
  });

  test("campo vazio não é erro de formato (a obrigatoriedade é do campo)", () => {
    expect(validateUsernameFormat("")).toBeNull();
    expect(validateUsernameFormat("   ")).toBeNull();
  });
});

describe("validateUsernameField", () => {
  test("vazio (ou só espaços) é obrigatório", () => {
    expect(validateUsernameField("")).toBe(USERNAME_REQUIRED_MESSAGE);
    expect(validateUsernameField("   ")).toBe(USERNAME_REQUIRED_MESSAGE);
  });

  test("preenchido cai na regra de formato", () => {
    expect(validateUsernameField("Maria.Silva")).toBeNull();
    expect(validateUsernameField("ab")).toBe(
      "O username deve ter no mínimo 3 caracteres."
    );
    expect(validateUsernameField("maria silva")).toBe(
      "Use apenas letras, números, ponto e underline."
    );
  });
});

describe("shouldCheckUsernameAvailability", () => {
  test("checa quando o formato é válido e difere do username atual", () => {
    expect(
      shouldCheckUsernameAvailability({
        currentUsername: "maria",
        value: "maria.silva",
      })
    ).toBeTrue();
    expect(
      shouldCheckUsernameAvailability({
        currentUsername: null,
        value: "joao_p",
      })
    ).toBeTrue();
  });

  test("não checa quando igual ao username atual (normalizado)", () => {
    expect(
      shouldCheckUsernameAvailability({
        currentUsername: "maria.silva",
        value: "Maria.Silva",
      })
    ).toBeFalse();
  });

  test("não checa vazio nem formato inválido", () => {
    expect(
      shouldCheckUsernameAvailability({ currentUsername: null, value: "" })
    ).toBeFalse();
    expect(
      shouldCheckUsernameAvailability({
        currentUsername: "maria",
        value: "joão",
      })
    ).toBeFalse();
    expect(
      shouldCheckUsernameAvailability({ currentUsername: null, value: "ab" })
    ).toBeFalse();
  });
});
