import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

import type { TournamentMatchWithSides } from "./bracket-view";

// ----- KPI cards -----

export type TournamentEntriesKpi = { confirmedCount: number };

export type TournamentMatchesKpi = {
  finishedCount: number;
  total: number;
};

export function buildTournamentEntriesKpi(input: {
  entries: TournamentEntryWithPlayers[];
}): TournamentEntriesKpi {
  return {
    confirmedCount: input.entries.filter((entry) => entry.status === "active")
      .length,
  };
}

/** KPI de partidas — `null` enquanto não há chave (antes do sorteio).
 * Linhas vacant (subárvore podada de um cabeça, IBX-0035) não contam:
 * nunca são jogadas, inflariam o total. */
export function buildTournamentMatchesKpi(input: {
  matches: TournamentMatchWithSides[];
}): TournamentMatchesKpi | null {
  const playable = input.matches.filter((match) => match.status !== "vacant");

  if (playable.length === 0) {
    return null;
  }

  return {
    finishedCount: playable.filter((match) => match.status === "finished")
      .length,
    total: playable.length,
  };
}
