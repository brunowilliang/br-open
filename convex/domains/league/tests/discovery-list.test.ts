import { describe, expect, it } from "bun:test";

import {
  filterLeaguesBySearchQuery,
  getActiveMembershipLeagueIds,
} from "../discovery-list";

const leagues = [
  {
    categories: ["Classe A", "Feminino"],
    city: "Sao Paulo",
    description: "Ranking de fim de semana",
    id: "league-1",
    name: "Liga Paulista",
    state: "SP",
  },
  {
    categories: ["Open"],
    city: "Florianopolis",
    description: "Tênis na areia",
    id: "league-2",
    name: "Circuito Costao",
    state: "SC",
  },
  {
    categories: ["Veteranos"],
    city: "Curitiba",
    description: null,
    id: "league-3",
    name: "Arena Sul",
    state: "PR",
  },
] as const;

describe("league discovery list helpers", () => {
  it("keeps only active membership league ids for the home list", () => {
    const result = getActiveMembershipLeagueIds([
      { leagueId: "league-1", status: "active" },
      { leagueId: "league-2", status: "pending" },
      { leagueId: "league-3", status: "removed" },
      { leagueId: "league-4", status: "active" },
    ]);

    expect([...result]).toEqual(["league-1", "league-4"]);
  });

  it("returns all leagues while the search query is blank", () => {
    const result = filterLeaguesBySearchQuery(leagues, "   ");

    expect(result.map((league) => league.id)).toEqual([
      "league-1",
      "league-2",
      "league-3",
    ]);
  });

  it("searches by name, location, category, and description without accents", () => {
    expect(
      filterLeaguesBySearchQuery(leagues, "paulista").map((league) => league.id)
    ).toEqual(["league-1"]);

    expect(
      filterLeaguesBySearchQuery(leagues, "florianópolis").map(
        (league) => league.id
      )
    ).toEqual(["league-2"]);

    expect(
      filterLeaguesBySearchQuery(leagues, "veteranos").map(
        (league) => league.id
      )
    ).toEqual(["league-3"]);

    expect(
      filterLeaguesBySearchQuery(leagues, "fim de semana").map(
        (league) => league.id
      )
    ).toEqual(["league-1"]);
  });
});
