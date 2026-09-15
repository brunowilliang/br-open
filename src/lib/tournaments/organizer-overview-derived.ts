import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

import type { TournamentMatchWithSides } from "./bracket-view";

// ----- Alerts (molde organizer-overview-derived da liga) -----

export type TournamentPendingApprovalAlert = { total: number };

export type TournamentAwaitingPaymentAlert = { total: number };

export function buildTournamentPendingApprovalAlert(input: {
  entries: TournamentEntryWithPlayers[];
}): TournamentPendingApprovalAlert | null {
  const total = input.entries.filter(
    (entry) => entry.status === "pending_approval"
  ).length;

  return total > 0 ? { total } : null;
}

export function buildTournamentAwaitingPaymentAlert(input: {
  entries: TournamentEntryWithPlayers[];
}): TournamentAwaitingPaymentAlert | null {
  const total = input.entries.filter(
    (entry) => entry.status === "awaiting_payment"
  ).length;

  return total > 0 ? { total } : null;
}

// ----- KPI cards -----

export type TournamentEntriesKpi = { confirmedCount: number };

export type TournamentPendingKpi = { pendingCount: number };

export type TournamentCategoriesKpi = { activeCount: number };

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

export function buildTournamentPendingKpi(input: {
  entries: TournamentEntryWithPlayers[];
}): TournamentPendingKpi {
  return {
    pendingCount: input.entries.filter(
      (entry) =>
        entry.status === "pending_approval" ||
        entry.status === "pending_partner" ||
        entry.status === "awaiting_payment"
    ).length,
  };
}

export function buildTournamentCategoriesKpi(input: {
  categories: Array<{ id: string }>;
}): TournamentCategoriesKpi {
  return { activeCount: input.categories.length };
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
