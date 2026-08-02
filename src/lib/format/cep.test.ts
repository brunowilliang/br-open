import { describe, expect, it } from "bun:test";

import { applyCepInputChange, formatCep } from "./cep";

describe("formatCep", () => {
  it("masks 8 digits as 00000-000", () => {
    expect(formatCep("01001000")).toBe("01001-000");
  });

  it("is idempotent on a masked CEP", () => {
    expect(formatCep("01001-000")).toBe("01001-000");
  });

  it("never renders a trailing separator on a partial CEP", () => {
    expect(formatCep("")).toBe("");
    expect(formatCep("0")).toBe("0");
    expect(formatCep("01001")).toBe("01001");
    expect(formatCep("010010")).toBe("01001-0");
  });

  it("ignores non-digit input and caps at 8 digits", () => {
    expect(formatCep("01001-00099")).toBe("01001-000");
    expect(formatCep("abc01001000")).toBe("01001-000");
  });
});

describe("applyCepInputChange", () => {
  it("applies typed digits progressively", () => {
    expect(applyCepInputChange("0100", "01001")).toBe("01001");
    expect(applyCepInputChange("01001-0", "01001-00")).toBe("0100100");
  });

  it("removes the digit before the separator on backspace", () => {
    // Cursor on the "-" of "01001-0" + backspace reports "010010" (same
    // digits); the digit before the separator must be dropped instead.
    expect(applyCepInputChange("01001-0", "010010")).toBe("01000");
  });

  it("deletes a digit on a regular backspace", () => {
    expect(applyCepInputChange("01001-0", "01001")).toBe("01001");
  });

  it("sanitizes pasted input to digits", () => {
    expect(applyCepInputChange("", "01001-000 abc")).toBe("01001000");
  });
});
