import { describe, expect, it } from "bun:test";

import { filterTournamentsBySearchQuery } from "../discovery-list";

const tournaments = [
  {
    city: "Sao Paulo",
    description: "Eliminatoria de fim de semana",
    id: "tournament-1",
    name: "Circuito Paulista",
    state: "SP",
  },
  {
    city: "Florianopolis",
    description: "Tenis na areia",
    id: "tournament-2",
    name: "Copa Costao",
    state: "SC",
  },
  {
    city: "Curitiba",
    description: null,
    id: "tournament-3",
    name: "Arena Sul",
    state: "PR",
  },
] as const;

describe("tournament discovery list helpers", () => {
  it("returns all tournaments while the search query is blank", () => {
    const result = filterTournamentsBySearchQuery(tournaments, "   ");

    expect(result.map((tournament) => tournament.id)).toEqual([
      "tournament-1",
      "tournament-2",
      "tournament-3",
    ]);
  });

  it("searches by name, location, and description without accents", () => {
    expect(
      filterTournamentsBySearchQuery(tournaments, "paulista").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-1"]);

    expect(
      filterTournamentsBySearchQuery(tournaments, "florianópolis").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-2"]);

    expect(
      filterTournamentsBySearchQuery(tournaments, "veteranos").map(
        (tournament) => tournament.id
      )
    ).toEqual([]);

    expect(
      filterTournamentsBySearchQuery(tournaments, "fim de semana").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-1"]);
  });

  it("matches every term of a multi-word query", () => {
    expect(
      filterTournamentsBySearchQuery(tournaments, "copio florianópolis").length
    ).toBe(0);
    expect(
      filterTournamentsBySearchQuery(tournaments, "copa florianópolis").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-2"]);
    expect(
      filterTournamentsBySearchQuery(tournaments, "arena curitiba").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-3"]);
  });

  it("normalizes case before matching", () => {
    expect(
      filterTournamentsBySearchQuery(tournaments, "CIRCUITO PAULISTA").map(
        (tournament) => tournament.id
      )
    ).toEqual(["tournament-1"]);
  });
});
