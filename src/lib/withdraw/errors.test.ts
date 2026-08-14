import { describe, expect, it } from "bun:test";

import {
  isMissingPaymentAccountError,
  isWithdrawConflictError,
} from "./errors";

describe("isMissingPaymentAccountError", () => {
  it("reconhece PRECONDITION_FAILED em error.data (ConvexError do kitcn)", () => {
    expect(
      isMissingPaymentAccountError({
        data: {
          code: "PRECONDITION_FAILED",
          message: "Conta não configurada.",
        },
      })
    ).toBe(true);
  });

  it("reconhece PRECONDITION_FAILED em error.code", () => {
    expect(isMissingPaymentAccountError({ code: "PRECONDITION_FAILED" })).toBe(
      true
    );
  });

  it("rejeita outros códigos", () => {
    expect(
      isMissingPaymentAccountError({ data: { code: "BAD_REQUEST" } })
    ).toBe(false);
    expect(isMissingPaymentAccountError({ code: "UNAUTHORIZED" })).toBe(false);
  });

  it("rejeita não-objetos e null/undefined", () => {
    expect(isMissingPaymentAccountError(null)).toBe(false);
    expect(isMissingPaymentAccountError(undefined)).toBe(false);
    expect(isMissingPaymentAccountError("erro")).toBe(false);
    expect(isMissingPaymentAccountError(new Error("x"))).toBe(false);
  });
});

describe("isWithdrawConflictError", () => {
  it("reconhece CONFLICT em error.data (replay de linha failed)", () => {
    expect(
      isWithdrawConflictError({
        data: {
          code: "CONFLICT",
          message: "O saque anterior falhou; tente novamente.",
        },
      })
    ).toBe(true);
  });

  it("reconhece CONFLICT em error.code", () => {
    expect(isWithdrawConflictError({ code: "CONFLICT" })).toBe(true);
  });

  it("rejeita outros códigos e não-objetos", () => {
    expect(isWithdrawConflictError({ code: "BAD_REQUEST" })).toBe(false);
    expect(
      isWithdrawConflictError({ data: { code: "PRECONDITION_FAILED" } })
    ).toBe(false);
    expect(isWithdrawConflictError(null)).toBe(false);
    expect(isWithdrawConflictError(new Error("timeout"))).toBe(false);
  });
});
