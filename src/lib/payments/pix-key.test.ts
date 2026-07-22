import { describe, expect, it } from "bun:test";

import {
  applyPixInputChange,
  formatPixKey,
  isNumericPixKey,
  isValidPixKey,
  rawPixKey,
  sanitizePixInput,
} from "./pix-key";

describe("pix-key", () => {
  describe("formatPixKey", () => {
    it("masks a CPF as 000.000.000-00", () => {
      expect(formatPixKey("12345678901", "cpf")).toBe("123.456.789-01");
    });

    it("is idempotent on a masked CPF", () => {
      expect(formatPixKey("123.456.789-01", "cpf")).toBe("123.456.789-01");
    });

    it("masks a CNPJ as 00.000.000/0000-00", () => {
      expect(formatPixKey("12345678000190", "cnpj")).toBe("12.345.678/0001-90");
    });

    it("masks a celular with 9 as +55 (18) 00000-0000 (5-4)", () => {
      expect(formatPixKey("18999998888", "celular")).toBe(
        "+55 (18) 99999-8888"
      );
    });

    it("masks a celular without 9 as +55 (18) 0000-0000 (4-4)", () => {
      expect(formatPixKey("1833338888", "celular")).toBe("+55 (18) 3333-8888");
    });

    // Regression: a partial celular must never render a trailing separator
    // (e.g. `+55 (22) 2-`) because backspace removes the separator (not the
    // digit), `sanitizePixInput` re-extracts the same digits, and `formatPixKey`
    // rebuilds the identical string -- the input gets stuck in a loop where
    // the user cannot delete the last digit. Separators may only appear
    // BETWEEN digits that already exist.
    it("never renders a trailing separator on a partial celular", () => {
      // empty -> placeholder shows the mask shape
      expect(formatPixKey("", "celular")).toBe("");
      // 1 digit
      expect(formatPixKey("1", "celular")).toBe("+55 1");
      // 2 digits (DDD complete, no number yet)
      expect(formatPixKey("22", "celular")).toBe("+55 22");
      // 3 digits (DDD + 1) -- previously rendered "+55 (22) 2-" (bug)
      expect(formatPixKey("222", "celular")).toBe("+55 (22) 2");
      // 4 digits
      expect(formatPixKey("2222", "celular")).toBe("+55 (22) 22");
      // 6 digits (DDD + 4)
      expect(formatPixKey("223333", "celular")).toBe("+55 (22) 3333");
      // 7 digits (DDD + 5) -- previously rendered "+55 (22) 33333-" (bug)
      expect(formatPixKey("2233333", "celular")).toBe("+55 (22) 33333");
    });

    it("returns email unchanged", () => {
      expect(formatPixKey("user@example.com", "email")).toBe(
        "user@example.com"
      );
    });

    it("returns an aleatoria key unchanged", () => {
      const key = "123e4567-e89b-4d12-a456-426614174000";
      expect(formatPixKey(key, "aleatoria")).toBe(key);
    });

    it("returns empty string for blank input", () => {
      expect(formatPixKey("   ", "cpf")).toBe("");
    });
  });

  describe("rawPixKey", () => {
    it("strips the CPF mask to digits", () => {
      expect(rawPixKey("123.456.789-01", "cpf")).toBe("12345678901");
    });

    it("strips the CNPJ mask to digits", () => {
      expect(rawPixKey("12.345.678/0001-90", "cnpj")).toBe("12345678000190");
    });

    it("prefixes a celular with +55 (E.164)", () => {
      expect(rawPixKey("(18) 99999-8888", "celular")).toBe("+5518999998888");
    });

    it("returns email trimmed", () => {
      expect(rawPixKey("  user@example.com  ", "email")).toBe(
        "user@example.com"
      );
    });
  });

  describe("isValidPixKey", () => {
    it("accepts a valid CPF", () => {
      expect(isValidPixKey("12345678901", "cpf")).toBe(true);
    });

    it("accepts a valid CNPJ", () => {
      expect(isValidPixKey("12345678000190", "cnpj")).toBe(true);
    });

    it("accepts a celular with 9 (DDD + 9 + 8)", () => {
      expect(isValidPixKey("18999998888", "celular")).toBe(true);
    });

    it("accepts a celular without 9 (DDD + 8)", () => {
      expect(isValidPixKey("1833338888", "celular")).toBe(true);
    });

    it("accepts a valid email", () => {
      expect(isValidPixKey("user@example.com", "email")).toBe(true);
    });

    it("accepts a valid aleatoria UUID", () => {
      expect(
        isValidPixKey("123e4567-e89b-4d12-a456-426614174000", "aleatoria")
      ).toBe(true);
    });

    it("rejects a CPF with wrong length", () => {
      expect(isValidPixKey("123456789", "cpf")).toBe(false);
    });

    it("rejects a celular with too few digits", () => {
      expect(isValidPixKey("183333888", "celular")).toBe(false);
    });

    it("rejects an invalid email", () => {
      expect(isValidPixKey("not-an-email", "email")).toBe(false);
    });
  });

  describe("sanitizePixInput", () => {
    it("keeps only digits for cpf", () => {
      expect(sanitizePixInput("123.456.789-01", "cpf")).toBe("12345678901");
    });

    it("keeps only digits for celular", () => {
      expect(sanitizePixInput("(18) 99999-8888", "celular")).toBe(
        "18999998888"
      );
    });

    it("keeps text for email", () => {
      expect(sanitizePixInput("user@example.com", "email")).toBe(
        "user@example.com"
      );
    });

    it("keeps text for aleatoria", () => {
      expect(
        sanitizePixInput("123e4567-e89b-4d12-a456-426614174000", "aleatoria")
      ).toBe("123e4567-e89b-4d12-a456-426614174000");
    });
  });

  describe("applyPixInputChange", () => {
    // Regression for the "can't backspace a separator" bug: when the user
    // positions the cursor on a separator (-, ' ', '(', ')') and presses
    // backspace, the separator is removed but the digits are unchanged, so a
    // naive sanitize -> format loop rebuilds the identical string and the
    // input gets stuck. applyPixInputChange detects that case and removes the
    // digit immediately before the removed separator instead.
    it("removes the digit before the cursor when backspace deletes the '-' (celular)", () => {
      // Backspace on '-': the separator is deleted (next is one char shorter),
      // digits unchanged -> remove the last digit of the first group.
      expect(
        applyPixInputChange("(18) 99666-0126", "(18) 996660126", "celular")
      ).toBe("1899660126");
    });

    it("removes the digit before the cursor when backspace deletes the space (celular)", () => {
      // Backspace on the space after ')': deletes it, digits unchanged ->
      // remove the last digit of the DDD.
      expect(
        applyPixInputChange("(18) 99666-0126", "(18)99666-0126", "celular")
      ).toBe("1996660126");
    });

    it("removes the digit before the cursor when backspace deletes ')' (celular)", () => {
      expect(
        applyPixInputChange("(18) 99666-0126", "(18 99666-0126", "celular")
      ).toBe("1996660126");
    });

    it("keeps digits unchanged when backspace deletes '(' (no digit before it)", () => {
      // '(' is the first char; there is no preceding digit to remove, so the
      // call falls through to the unchanged digits (the user has to backspace
      // again to actually delete a digit).
      expect(
        applyPixInputChange("(18) 99666-0126", "18) 99666-0126", "celular")
      ).toBe("18996660126");
    });

    it("removes the digit before the cursor when backspace deletes a CPF separator", () => {
      // "123.456.789-01", backspace on the '-' deletes the '9'.
      expect(
        applyPixInputChange("123.456.789-01", "123.456.78901", "cpf")
      ).toBe("1234567801");
    });

    it("returns the new digits unchanged when a real digit was deleted (normal backspace)", () => {
      // Display "(18) 99666-0126", backspace at the end deletes '6'.
      expect(
        applyPixInputChange("(18) 99666-0126", "(18) 99666-012", "celular")
      ).toBe("1899666012");
    });

    it("returns the new digits unchanged when typing (digits grew)", () => {
      expect(
        applyPixInputChange("(18) 99666-012", "(18) 99666-0126", "celular")
      ).toBe("18996660126");
    });

    it("returns empty string when clearing the field", () => {
      expect(applyPixInputChange("(18) 99", "", "celular")).toBe("");
    });

    // The celular mask now renders a fixed "+55 " prefix as part of the
    // displayed value. applyPixInputChange must strip it before comparing so
    // the country code's "55" isn't mistaken for the local key digits.
    it("ignores the +55 prefix when detecting a backspace on a celular", () => {
      // Display "+55 (18) 99666-0000", backspace on '-' -> remove the digit
      // before it. Must NOT count the '5','5' of "+55" as key digits.
      expect(
        applyPixInputChange(
          "+55 (18) 99666-0000",
          "+55 (18) 996660000",
          "celular"
        )
      ).toBe("1899660000");
    });

    it("ignores the +55 prefix on a normal end backspace (celular)", () => {
      expect(
        applyPixInputChange(
          "+55 (18) 99666-0000",
          "+55 (18) 99666-000",
          "celular"
        )
      ).toBe("1899666000");
    });
  });

  describe("isNumericPixKey", () => {
    it("returns true for cpf/cnpj/celular", () => {
      expect(isNumericPixKey("cpf")).toBe(true);
      expect(isNumericPixKey("cnpj")).toBe(true);
      expect(isNumericPixKey("celular")).toBe(true);
    });

    it("returns false for email/aleatoria", () => {
      expect(isNumericPixKey("email")).toBe(false);
      expect(isNumericPixKey("aleatoria")).toBe(false);
    });
  });
});
