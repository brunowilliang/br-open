import { describe, expect, test } from "bun:test";

import {
  normalizeUsername,
  resolveUsernameSubmitIssue,
  shouldCheckUsernameAvailability,
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

  test("campo vazio não é erro de formato (regra de vazio é do submit)", () => {
    expect(validateUsernameFormat("")).toBeNull();
    expect(validateUsernameFormat("   ")).toBeNull();
  });
});

describe("resolveUsernameSubmitIssue", () => {
  test("username definido + campo vazio no submit = cannot_remove", () => {
    expect(
      resolveUsernameSubmitIssue({ currentUsername: "maria", value: "" })
    ).toBe("cannot_remove");
    expect(
      resolveUsernameSubmitIssue({ currentUsername: "maria", value: "  " })
    ).toBe("cannot_remove");
  });

  test("sem username atual, vazio segue válido (campo opcional)", () => {
    expect(
      resolveUsernameSubmitIssue({ currentUsername: null, value: "" })
    ).toBeNull();
    expect(
      resolveUsernameSubmitIssue({ currentUsername: "", value: "" })
    ).toBeNull();
  });

  test("valor preenchido (mesmo igual ao atual) não gera issue de submit", () => {
    expect(
      resolveUsernameSubmitIssue({ currentUsername: "maria", value: "maria" })
    ).toBeNull();
    expect(
      resolveUsernameSubmitIssue({ currentUsername: "maria", value: "MARIA" })
    ).toBeNull();
    expect(
      resolveUsernameSubmitIssue({ currentUsername: null, value: "joao_p" })
    ).toBeNull();
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
