import { describe, expect, it } from "bun:test";

import { maskPixKey } from "../pix-key";

describe("maskPixKey", () => {
  it("keeps the first and last 2 characters", () => {
    expect(maskPixKey("org@example.com")).toBe("or********om");
  });

  it("caps the stars at 8 for long keys", () => {
    expect(maskPixKey("a1b2c3d4e5f6a7b8c9d0e1f2")).toBe("a1********f2");
  });

  it("returns short keys verbatim", () => {
    expect(maskPixKey("abcd")).toBe("abcd");
  });

  it("handles a 5-character key", () => {
    expect(maskPixKey("abcde")).toBe("ab*de");
  });
});
