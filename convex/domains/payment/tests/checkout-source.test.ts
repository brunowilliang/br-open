import { describe, expect, it } from "bun:test";

import { resolveCheckoutSourceIdentity } from "../checkout-source";

const ENTRY = "tournament_entry";
const CATEGORY = { displayName: "Simples Masculino" };
const TOURNAMENT = { name: "Copa Dracena de Beach Tennis" };

describe("resolveCheckoutSourceIdentity", () => {
  it("separates the live tournament name from the category", () => {
    expect(
      resolveCheckoutSourceIdentity({
        category: CATEGORY,
        snapshotLabel: "Copa Dracena de Beach Tennis — Simples Masculino",
        sourceType: ENTRY,
        tournament: TOURNAMENT,
      })
    ).toEqual({
      category: "Simples Masculino",
      label: "Copa Dracena de Beach Tennis",
    });
  });

  it("cleans the title of an older charge, whose snapshot carries the category", () => {
    // O snapshot gravado na charge nao muda: o que decide o titulo e o source.
    expect(
      resolveCheckoutSourceIdentity({
        category: CATEGORY,
        snapshotLabel: "Liga Antiga — Duplas Mistas",
        sourceType: ENTRY,
        tournament: TOURNAMENT,
      })
    ).toEqual({
      category: "Simples Masculino",
      label: "Copa Dracena de Beach Tennis",
    });
  });

  it("keeps the snapshot when the source is not a tournament entry", () => {
    expect(
      resolveCheckoutSourceIdentity({
        category: null,
        snapshotLabel: "Cobranca avulsa",
        sourceType: "something_else",
        tournament: TOURNAMENT,
      })
    ).toEqual({ category: null, label: "Cobranca avulsa" });
  });

  it("drops the title when the live chain is broken, instead of leaking the snapshot", () => {
    // Torneio removido: o snapshot antigo ainda tem a categoria colada no nome.
    expect(
      resolveCheckoutSourceIdentity({
        category: null,
        snapshotLabel: "Copa Dracena de Beach Tennis — Simples Masculino",
        sourceType: ENTRY,
        tournament: null,
      })
    ).toEqual({ category: null, label: null });
  });

  it("has no category for an entry source that cannot resolve one", () => {
    expect(
      resolveCheckoutSourceIdentity({
        category: null,
        snapshotLabel: null,
        sourceType: ENTRY,
        tournament: TOURNAMENT,
      })
    ).toEqual({ category: null, label: null });
  });
});
