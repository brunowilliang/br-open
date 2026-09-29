import { describe, expect, it } from "bun:test";

import { getPageOverlayKind } from "./overlay-kind";

describe("getPageOverlayKind", () => {
  it("no Android o overlay da página vira degradê", () => {
    expect(getPageOverlayKind("android")).toBe("gradient");
  });

  it("no iOS o overlay segue no blur", () => {
    expect(getPageOverlayKind("ios")).toBe("blur");
  });

  it("fora do Android nenhuma plataforma muda", () => {
    expect(getPageOverlayKind("web")).toBe("blur");
  });
});
