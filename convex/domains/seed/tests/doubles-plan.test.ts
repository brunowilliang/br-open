import { describe, expect, it } from "bun:test";

import {
  DOUBLES_SEED_ACTIVE_PAIRS,
  DOUBLES_SEED_CATEGORIES,
  DOUBLES_SEED_INVITE_PAIRS,
  DOUBLES_SEED_PROFILES,
  selectDoublesSeedPairs,
} from "../doubles-plan";

const CANDIDATES = [
  { gender: "Masculino", profileId: "m1" },
  { gender: "Feminino", profileId: "f1" },
  { gender: "Masculino", profileId: "m2" },
  { gender: "Feminino", profileId: "f2" },
  { gender: null, profileId: "sem-genero" },
  { gender: "Masculino", profileId: "m3" },
];

describe("seed: cenario de duplas", () => {
  it("planta so as duas categorias de duplas do pedido", () => {
    expect(DOUBLES_SEED_CATEGORIES.map((category) => category.gender)).toEqual([
      "male",
      "female",
    ]);
  });

  it("o elenco cobre os pares de cada categoria, com username unico", () => {
    const usernames = DOUBLES_SEED_PROFILES.map((profile) => profile.username);
    const profilesPerGender =
      (DOUBLES_SEED_ACTIVE_PAIRS + DOUBLES_SEED_INVITE_PAIRS) * 2;

    expect(new Set(usernames).size).toBe(usernames.length);

    for (const gender of ["Masculino", "Feminino"] as const) {
      expect(
        DOUBLES_SEED_PROFILES.filter((profile) => profile.gender === gender)
          .length
      ).toBeGreaterThanOrEqual(profilesPerGender);
    }
  });

  it("monta duplas do genero da categoria, nunca o par errado", () => {
    const pairs = selectDoublesSeedPairs({
      candidates: CANDIDATES,
      gender: "female",
      occupied: [],
      pairCount: 2,
    });

    expect(pairs).toEqual([["f1", "f2"]]);
  });

  it("nao repete perfil ja ocupado na categoria", () => {
    const pairs = selectDoublesSeedPairs({
      candidates: CANDIDATES,
      gender: "male",
      occupied: ["m1"],
      pairCount: 2,
    });

    expect(pairs).toEqual([["m2", "m3"]]);
  });

  it("devolve menos pares quando o elenco livre acaba", () => {
    const pairs = selectDoublesSeedPairs({
      candidates: CANDIDATES,
      gender: "male",
      occupied: ["m1", "m2", "m3"],
      pairCount: 2,
    });

    expect(pairs).toEqual([]);
  });

  it("mixed nao tem par de elenco: nenhuma dupla e montada", () => {
    expect(
      selectDoublesSeedPairs({
        candidates: CANDIDATES,
        gender: "mixed",
        occupied: [],
        pairCount: 2,
      })
    ).toEqual([]);
  });
});
