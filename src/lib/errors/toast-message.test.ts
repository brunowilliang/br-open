import { ConvexError } from "convex/values";
import { CRPCClientError } from "kitcn/crpc";
import { describe, expect, it } from "bun:test";

import { getToastErrorMessage } from "./toast-message";

describe("getToastErrorMessage", () => {
  it("surfaces the backend message for a CRPC error with a custom message", () => {
    const error = new CRPCClientError({
      code: "NOT_FOUND",
      functionName: "tournament/matches:publishResult",
      message:
        "A partida já foi publicada e não pode ser reaberta automaticamente.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível reabrir o resultado."
    );

    expect(result).toBe(
      "A partida já foi publicada e não pode ser reaberta automaticamente."
    );
  });

  it("falls back when the CRPC error has no custom message (generic code:fn form)", () => {
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "tournament/management:create",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível criar o torneio."
    );

    expect(result).toBe("Não foi possível criar o torneio.");
  });

  it("falls back for non-CRPC errors (Convex internals, transport errors)", () => {
    const error = new Error(
      "[CONVEX M(tournament/management:create)] Server Error\nArgumentValidationError: Value does not match validator.\nPath: .matchConfig.bestOfSets\nValue: {enabled: false, value: 1.0}\nValidator: v.float64()"
    );

    const result = getToastErrorMessage(
      error,
      "Não foi possível criar o torneio."
    );

    expect(result).toBe("Não foi possível criar o torneio.");
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

  it("surfaces the backend message when the Convex envelope wraps it (BUG-0054)", () => {
    // Forma REAL capturada no device (aprovar uma solicitação já resolvida):
    // o `message` do erro do cliente é o ENVELOPE do Convex em volta da
    // mensagem do backend. Antes do fix, o toast mostrava isto cru.
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "tournament/entries:approve",
      message:
        "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError: Essa inscrição já foi resolvida.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível aprovar a inscrição. Tente novamente."
    );

    expect(result).toBe("Essa inscrição já foi resolvida.");
  });

  it("strips the envelope from an Error that is not the CRPC client error", () => {
    const error = new Error(
      "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError: Essa inscrição já foi resolvida."
    );

    const result = getToastErrorMessage(
      error,
      "Não foi possível aprovar a inscrição. Tente novamente."
    );

    expect(result).toBe("Essa inscrição já foi resolvida.");
  });

  it("leaves no stack of the enveloped message in the toast", () => {
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "tournament/entries:approve",
      message:
        "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError: Essa inscrição já foi resolvida.\n    at handler (../convex/functions/tournament/entries.ts:214:11)\n    at async invoke (../convex/functions/generated/server.ts:88:5)\nCalled by client",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível aprovar a inscrição. Tente novamente."
    );

    expect(result).toBe("Essa inscrição já foi resolvida.");
  });

  it("never shows the Convex envelope markers nor the request id", () => {
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "tournament/entries:approve",
      message:
        "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError: Essa inscrição já foi resolvida.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível aprovar a inscrição. Tente novamente."
    );

    expect(result).not.toContain("[CONVEX");
    expect(result).not.toContain("Request ID");
    expect(result).not.toContain("CRPCError");
    expect(result).not.toContain("Server Error");
  });

  it("still falls back for an envelope of an internal Convex error", () => {
    // O rótulo prova que NÃO é um throw intencional do backend: o texto do
    // Convex interno (validação, stack) nunca vira toast.
    const error = new CRPCClientError({
      code: "BAD_REQUEST",
      functionName: "tournament/management:create",
      message:
        "[CONVEX M(tournament/management:create)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught ArgumentValidationError: Value does not match validator.",
    });

    const result = getToastErrorMessage(
      error,
      "Não foi possível criar o torneio."
    );

    expect(result).toBe("Não foi possível criar o torneio.");
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

  it("extracts the backend message when the envelope rides in the payload", () => {
    // Defesa: se o envelope chegar só no payload (message do erro vazio ou
    // não-string), o toast ainda sai com a mensagem do backend, não com o
    // wrapper.
    const error = new ConvexError({
      code: "BAD_REQUEST",
      message:
        "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError: Essa inscrição já foi resolvida.",
    });

    expect(
      getToastErrorMessage(
        error,
        "Não foi possível aprovar a inscrição. Tente novamente."
      )
    ).toBe("Essa inscrição já foi resolvida.");
  });

  it("never lets an envelope leak through the payload path", () => {
    const fallback = "Não foi possível criar o torneio.";
    const envelope = (label: string) =>
      `[CONVEX M(tournament/management:create)] [Request ID: 76269abf707e6ef7] Server Error\n${label}`;

    // Envelope de erro interno no payload: cai no amigável.
    expect(
      getToastErrorMessage(
        new ConvexError({
          code: "BAD_REQUEST",
          message: envelope(
            "Uncaught ArgumentValidationError: Value does not match validator."
          ),
        }),
        fallback
      )
    ).toBe(fallback);

    // Envelope sem rótulo de throw intencional: também.
    expect(
      getToastErrorMessage(
        new ConvexError({ code: "BAD_REQUEST", message: envelope("") }),
        fallback
      )
    ).toBe(fallback);
  });

  it("falls back when the intentional label carries no message of its own", () => {
    const fallback = "Não foi possível aprovar a inscrição. Tente novamente.";

    // Rótulo sozinho na linha: a linha seguinte é o stack do dev, nunca o
    // toast.
    expect(
      getToastErrorMessage(
        new CRPCClientError({
          code: "BAD_REQUEST",
          functionName: "tournament/entries:approve",
          message:
            "[CONVEX M(tournament/entries:approve)] [Request ID: 76269abf707e6ef7] Server Error\nUncaught CRPCError:\nat handler (../convex/functions/tournament/entries.ts:214:11)\nCalled by client",
        }),
        fallback
      )
    ).toBe(fallback);

    // Mesmo caso chegando pelo payload.
    expect(
      getToastErrorMessage(
        new ConvexError({
          code: "BAD_REQUEST",
          message: "Uncaught CRPCError:\nat handler (membership.ts:214:11)",
        }),
        fallback
      )
    ).toBe(fallback);
  });
});
