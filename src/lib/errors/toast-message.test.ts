import { describe, expect, it } from "bun:test";

import { getToastErrorMessage } from "./toast-message";

describe("getToastErrorMessage", () => {
  it("prefers the structured CRPC data.message when present", () => {
    const result = getToastErrorMessage(
      {
        data: {
          message:
            "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.",
        },
        message:
          "[CONVEX M(league/challenges:adminManage)] Uncaught CRPCError: O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.",
      },
      "Não foi possível reabrir o resultado."
    );

    expect(result).toBe(
      "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente."
    );
  });

  it("uses error.message when there is no structured data.message", () => {
    const result = getToastErrorMessage(
      {
        message: "Não foi possível aplicar a ação.",
      },
      "Não foi possível reabrir o resultado."
    );

    expect(result).toBe("Não foi possível aplicar a ação.");
  });

  it("falls back when there is no usable error message", () => {
    const result = getToastErrorMessage(
      {
        data: {},
        message: "",
      },
      "Não foi possível reabrir o resultado."
    );

    expect(result).toBe("Não foi possível reabrir o resultado.");
  });
});
