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
});
