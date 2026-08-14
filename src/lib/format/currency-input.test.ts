import { describe, expect, it } from "bun:test";

import {
  applyCurrencyInputChange,
  centsToCurrencyInput,
  currencyInputToCents,
  formatCurrencyInput,
} from "./currency-input";

describe("currency-input", () => {
  describe("formatCurrencyInput", () => {
    it("returns empty for empty input", () => {
      expect(formatCurrencyInput("")).toBe("");
    });

    it("treats digits as progressive cents", () => {
      expect(formatCurrencyInput("1")).toBe("0,01");
      expect(formatCurrencyInput("12")).toBe("0,12");
      expect(formatCurrencyInput("123")).toBe("1,23");
      expect(formatCurrencyInput("1234")).toBe("12,34");
    });

    it("groups thousands with dots", () => {
      expect(formatCurrencyInput("123456")).toBe("1.234,56");
      expect(formatCurrencyInput("1234567")).toBe("12.345,67");
    });

    it("is idempotent on a masked value", () => {
      expect(formatCurrencyInput("1.234,56")).toBe("1.234,56");
      expect(formatCurrencyInput("0,50")).toBe("0,50");
    });

    it("strips leading zeros accumulated from the masked value", () => {
      // Bug: masked "0,05" → digits "005" → accumulates leading zeros
      // on subsequent keystrokes, producing "005,50" instead of "5,50".
      expect(formatCurrencyInput("005")).toBe("0,05");
      expect(formatCurrencyInput("0050")).toBe("0,50");
      expect(formatCurrencyInput("00550")).toBe("5,50");
    });

    it("keeps a single zero for all-zero input", () => {
      expect(formatCurrencyInput("0")).toBe("0,00");
      expect(formatCurrencyInput("000")).toBe("0,00");
    });

    it("ignores non-digit characters", () => {
      expect(formatCurrencyInput("R$ 12,34")).toBe("12,34");
    });
  });

  describe("applyCurrencyInputChange", () => {
    it("accepts a digit typed at the end", () => {
      expect(applyCurrencyInputChange("12,34", "12,345")).toBe("12345");
      expect(applyCurrencyInputChange("", "5")).toBe("5");
    });

    it("accepts a plain backspace", () => {
      expect(applyCurrencyInputChange("12,34", "12,3")).toBe("123");
    });

    it("removes the digit before a deleted separator", () => {
      expect(applyCurrencyInputChange("1.234,56", "1.23456")).toBe("12356");
      expect(applyCurrencyInputChange("0,50", "050")).toBe("50");
    });
  });

  describe("currencyInputToCents", () => {
    it("converts masked input to cents", () => {
      expect(currencyInputToCents("1.234,56")).toBe(123_456);
      expect(currencyInputToCents("4,50")).toBe(450);
    });

    it("returns 0 for empty or zero", () => {
      expect(currencyInputToCents("")).toBe(0);
      expect(currencyInputToCents("0,00")).toBe(0);
    });
  });

  describe("centsToCurrencyInput", () => {
    it("converts cents to masked input", () => {
      expect(centsToCurrencyInput(450)).toBe("4,50");
      expect(centsToCurrencyInput(123_456)).toBe("1.234,56");
      expect(centsToCurrencyInput(50)).toBe("0,50");
    });

    it("returns empty for zero, negative, or non-integer", () => {
      expect(centsToCurrencyInput(0)).toBe("");
      expect(centsToCurrencyInput(-50)).toBe("");
      expect(centsToCurrencyInput(45.5)).toBe("");
    });
  });
});
