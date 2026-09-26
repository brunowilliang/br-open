import { describe, expect, it } from "bun:test";

import { getCompetitionListSurface } from "./competitions-surface";

describe("getCompetitionListSurface", () => {
  it("no modo jogador o organizador não aparece em nada", () => {
    const surface = getCompetitionListSurface("player");

    expect(surface.list).toBe("participating");
    expect(surface.showsEditAction).toBe(false);
    expect(surface.showsCreateCard).toBe(false);
  });

  it("no modo organizador a lista é a dele, com editar e criar", () => {
    const surface = getCompetitionListSurface("organization");

    expect(surface.list).toBe("mine");
    expect(surface.showsEditAction).toBe(true);
    expect(surface.showsCreateCard).toBe(true);
  });
});
