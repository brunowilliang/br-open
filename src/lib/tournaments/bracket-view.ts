import type { ApiOutputs } from "@convex/shared/api";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];

export type TournamentMatchWithSides = TournamentMatch & {
  entryA: TournamentEntryWithPlayers | null;
  entryB: TournamentEntryWithPlayers | null;
};

/** Join client-side: match entryAId/entryBId → entries enriquecidas (fonte única). */
export function buildMatchSides(input: {
  entriesById: Record<string, TournamentEntryWithPlayers>;
  matches: TournamentMatch[];
}): TournamentMatchWithSides[] {
  return input.matches.map((match) => ({
    ...match,
    entryA: match.entryAId ? (input.entriesById[match.entryAId] ?? null) : null,
    entryB: match.entryBId ? (input.entriesById[match.entryBId] ?? null) : null,
  }));
}

/**
 * Swap permitido em partida ainda sem resultado, em QUALQUER rodada — o
 * backend valida os dois slots dentro da MESMA rodada (generalização
 * IBX-0035: entradas diretas podem ocupar lados na rodada >= 2 já no
 * sorteio). Linhas vacant (subárvore podada de um cabeça de chave) nunca
 * são trocáveis: sem lados preenchidos, não há o que mover.
 */
export function canSwapMatch(match: {
  score: unknown;
  status: string;
}): boolean {
  return (
    match.score === null &&
    match.status !== "finished" &&
    match.status !== "vacant"
  );
}

/** Os três campos que definem um confronto agendado (agenda do torneio). */
export type TournamentScheduleFields = {
  courtId: null | string;
  matchDate: null | string;
  startMinute: null | number;
};

/**
 * Existe algum confronto agendado (data, horário e quadra) nas partidas
 * carregadas do torneio — qualquer categoria. O re-sorteio apaga as
 * partidas e reconstrói a chave, então os agendamentos morrem junto: a UI
 * usa isto para avisar o organizador ANTES de disparar o draw.
 */
export function hasScheduledMatch(
  matches: TournamentScheduleFields[]
): boolean {
  return matches.some(
    (match) =>
      match.matchDate !== null &&
      match.startMinute !== null &&
      match.courtId !== null
  );
}
