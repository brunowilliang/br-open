import type { TournamentMatchWithSides } from "./bracket-view";
import type { PlayerMatch } from "./match-agreement-view";

/**
 * Próximos jogos do jogador na casa do torneio: todo confronto dele com os DOIS
 * lados definidos e sem desfecho, agendado ou não (a chave pode estar sorteada
 * sem horário). A ordem é a da PENDÊNCIA — o que espera ação vem primeiro e o
 * "A definir" (sem nada na mesa) por ÚLTIMO; dentro do mesmo degrau vale a
 * ordem antiga (rodada -> data -> minuto). Sem a leitura do acerto (porta
 * vazia), só a data decide.
 */
export function selectPlayerNextMatches(input: {
  matches: readonly TournamentMatchWithSides[];
  playerMatches: readonly PlayerMatch[];
  viewerEntryIds: readonly string[];
}): TournamentMatchWithSides[] {
  const viewerEntryIds = new Set(input.viewerEntryIds);
  const playerMatchesById = new Map(
    input.playerMatches.map((playerMatch) => [
      playerMatch.match.id,
      playerMatch,
    ])
  );

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
    .slice()
    .sort(
      (a, b) =>
        playerPendencyRank(a, playerMatchesById.get(a.id)) -
          playerPendencyRank(b, playerMatchesById.get(b.id)) ||
        a.round - b.round ||
        (a.matchDate ?? "").localeCompare(b.matchDate ?? "") ||
        (a.startMinute ?? 0) - (b.startMinute ?? 0)
    );
}

/** Degraus da fila: 0 = proposta esperando o MEU aceite (ação do viewer); 1 =
 * pendência em curso (resultado pendente, proposta enviada ou aguardando o
 * outro lado); 2 = agendado sem pendência; 3 = "A definir". A precedência do
 * resultado sobre o horário é a mesma do chip do acerto. */
function playerPendencyRank(
  match: TournamentMatchWithSides,
  playerMatch: PlayerMatch | undefined
): number {
  if (playerMatch) {
    const { schedule, score } = playerMatch.agreements;
    const isFromMySide = (proposedBySide: null | "a" | "b") =>
      proposedBySide !== null && proposedBySide === playerMatch.mySide;

    if (score.proposal !== null) {
      return isFromMySide(score.proposedBySide) ? 1 : 0;
    }

    if (schedule.state === "agreed") {
      return 1;
    }

    if (schedule.proposal !== null) {
      return isFromMySide(schedule.proposedBySide) ? 1 : 0;
    }
  }

  return match.matchDate === null ? 3 : 2;
}
