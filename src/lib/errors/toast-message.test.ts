import { ConvexError } from "convex/values";
import { CRPCClientError } from "kitcn/crpc";
import { describe, expect, it } from "bun:test";

import { getToastErrorMessage } from "./toast-message";

describe("getToastErrorMessage", () => {
  it("surfaces the backend message for a CRPC error with a custom message", () => {
    const error = new CRPCClientError({
      code: "NOT_FOUND",
      functionName: "league/challenges:organizerManage",
      message:
        "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível reabrir o resultado."
    );

    expect(result).toBe(
      "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente."
    );
  });

  it("falls back when the CRPC error has no custom message (generic code:fn form)", () => {
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "league/management:create",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível criar a liga."
    );

    expect(result).toBe("Não foi possível criar a liga.");
  });

  it("falls back for non-CRPC errors (Convex internals, transport errors)", () => {
    const error = new Error(
      "[CONVEX M(league/management:create)] Server Error\nArgumentValidationError: Value does not match validator.\nPath: .ruleConfig.maxActiveChallengesPerPlayer\nValue: {enabled: false, value: 1.0}\nValidator: v.float64()"
    );

    const result = getToastErrorMessage(
      error,
      "Não foi possível criar a liga."
    );

    expect(result).toBe("Não foi possível criar a liga.");
  });

  it("surfaces the backend message that rides in the ConvexError payload", () => {
    // Recusa de regra do servidor: o CRPCError vira ConvexError e o texto
    // específico viaja em `data` — o `message` do erro do cliente é só o
    // wrapper do Convex.
    const error = new ConvexError({
      code: "BAD_REQUEST",
      message:
        "Essa vaga vem de um confronto já decidido e não pode ser ajustada.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível trocar as posições. Tente novamente."
    );

    expect(result).toBe(
      "Essa vaga vem de um confronto já decidido e não pode ser ajustada."
    );
  });

  it("falls back when the payload has no message of its own (code echo)", () => {
    const error = new ConvexError({
      code: "INTERNAL_SERVER_ERROR",
      message: "INTERNAL_SERVER_ERROR",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível salvar o resultado. Tente novamente."
    );

    expect(result).toBe(
      "Não foi possível salvar o resultado. Tente novamente."
    );
  });

  it("falls back for a ConvexError payload that is not the CRPC shape", () => {
    expect(
      getToastErrorMessage(
        new ConvexError({ reason: "sem code nem message" }),
        "Não foi possível trocar as posições. Tente novamente."
      )
    ).toBe("Não foi possível trocar as posições. Tente novamente.");
    expect(
      getToastErrorMessage(
        new ConvexError("payload string"),
        "Não foi possível trocar as posições. Tente novamente."
      )
    ).toBe("Não foi possível trocar as posições. Tente novamente.");
  });
});
