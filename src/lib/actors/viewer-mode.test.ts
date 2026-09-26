import { describe, expect, it } from "bun:test";

import { getViewerActorKey, getViewerMode } from "./viewer-mode";

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

describe("getViewerActorKey", () => {
  it("identifica ator por tipo e id: trocar de modo ou de organização muda a chave", () => {
    expect(getViewerActorKey({ id: "p-1", kind: "player" })).toBe("player:p-1");
    expect(getViewerActorKey({ id: "o-1", kind: "organization" })).toBe(
      "organization:o-1"
    );
    expect(getViewerActorKey({ id: "o-2", kind: "organization" })).not.toBe(
      getViewerActorKey({ id: "o-1", kind: "organization" })
    );
  });

  it("contexto pendente não tem ator", () => {
    expect(getViewerActorKey(null)).toBeNull();
    expect(getViewerActorKey(undefined)).toBeNull();
  });
});
