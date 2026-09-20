import { describe, expect, it } from "bun:test";

import {
  buildPlayerDisplayName,
  buildPlayerProfileDisplayName,
} from "../identity";

describe("nome humano de um perfil para copy que nomeia a pessoa", () => {
  it("usa o nome completo (o que o card do torneio mostra)", () => {
    expect(
      buildPlayerProfileDisplayName({
        fullName: "Marina Costa",
        name: "conta",
        nickname: "Mari",
        userId: "user-1",
      })
    ).toBe("Marina Costa");
  });

  it("cai no apelido quando nao ha nome completo", () => {
    expect(
      buildPlayerProfileDisplayName({
        fullName: "   ",
        name: "conta",
        nickname: "Mari",
        userId: "user-1",
      })
    ).toBe("Mari");
  });

  it("cai no nome da conta quando nao ha nome nem apelido", () => {
    expect(
      buildPlayerProfileDisplayName({
        fullName: null,
        name: "Conta do Bruno",
        nickname: null,
        userId: "user-1",
      })
    ).toBe("Conta do Bruno");
  });

  it("sem nome nenhum entrega o fallback do app, nunca vazio", () => {
    const name = buildPlayerProfileDisplayName({
      fullName: null,
      name: null,
      nickname: "  ",
      userId: "user-1",
    });

    expect(name).toStartWith("Jogador#");
    expect(name.length).toBeGreaterThan("Jogador#".length);
    expect(
      buildPlayerProfileDisplayName({
        fullName: " ",
        name: "",
        nickname: null,
        userId: null,
      })
    ).toBe("Jogador");
  });

  it("nao inventa campo: so usa os tres nomes vivos do app", () => {
    expect(buildPlayerDisplayName({ name: "  Ana  ", userId: "user-1" })).toBe(
      "Ana"
    );
  });
});
