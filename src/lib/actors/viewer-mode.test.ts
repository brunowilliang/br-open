import { describe, expect, it } from "bun:test";

import { getViewerMode } from "./viewer-mode";

describe("getViewerMode", () => {
  it("é organization só quando o ator ATIVO é a organização", () => {
    expect(getViewerMode({ kind: "organization" })).toBe("organization");
    expect(getViewerMode({ kind: "player" })).toBe("player");
  });

  it("sem ator (contexto pendente ou em erro) é player", () => {
    expect(getViewerMode(null)).toBe("player");
    expect(getViewerMode(undefined)).toBe("player");
  });
});
