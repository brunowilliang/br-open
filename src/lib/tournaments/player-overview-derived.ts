import type { TournamentMatchWithSides } from "./bracket-view";

/**
 * Próximo confronto do jogador na casa do torneio: qualquer partida dele com os
 * DOIS lados definidos e sem desfecho, agendada ou não (a chave pode estar
 * sorteada sem horário: o confronto existe, o card mostra "A definir" e é ali
 * que ele propõe o horário). Ordem: rodada crescente e, dentro dela, a sem data
 * antes da agendada, porque é a que ainda espera ação.
 */
export function selectNextPlayerMatch(input: {
  matches: readonly TournamentMatchWithSides[];
  viewerEntryIds: readonly string[];
}): TournamentMatchWithSides | undefined {
  const viewerEntryIds = new Set(input.viewerEntryIds);

  return input.matches
    .filter(
      (match) =>
        (match.status === "pending" || match.status === "scheduled") &&
        match.winnerEntryId === null &&
        match.entryAId !== null &&
        match.entryBId !== null &&
        (viewerEntryIds.has(match.entryAId) ||
          viewerEntryIds.has(match.entryBId))
    )
    .sort(
      (a, b) =>
        a.round - b.round ||
        (a.matchDate ?? "").localeCompare(b.matchDate ?? "") ||
        (a.startMinute ?? 0) - (b.startMinute ?? 0)
    )[0];
}
