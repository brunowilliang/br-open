import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

import { formatShortDate } from "@/lib/format/date";

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

/** Linhas `vacant` de subárvore podada não contam: nunca são jogadas. */
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

// ----- Janela do torneio -----

/** Os dois campos são epoch ms em meia-noite LOCAL de quem criou o dado (o dia
 * do DatePicker), então o formatador LOCAL devolve o MESMO dia; em UTC só
 * quebraria num fuso a leste de Greenwich. Ausente (0) sai da linha. */
export function buildTournamentDatesSummary(input: {
  registrationDeadlineAt: number;
  startDate: number;
}): null | string {
  const parts: string[] = [];

  if (input.startDate > 0) {
    parts.push(`Início ${formatShortDate(new Date(input.startDate))}`);
  }

  if (input.registrationDeadlineAt > 0) {
    parts.push(
      `Inscrições até ${formatShortDate(new Date(input.registrationDeadlineAt))}`
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
