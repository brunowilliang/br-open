import type {
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";

import type { BracketScoreSet } from "./bracket-score-display";
import { buildMatchSides } from "./bracket-view";
import {
  formatBracketStage,
  formatEntryPlayerNames,
  walkoverWinnerSide,
} from "./tournament-details-derived";

/** Item do card da agenda do torneio: os dois lados já resolvidos (nome e avatar
 * do jogador e do parceiro) e o estágio nomeado pelo tamanho do quadro. */
export type ScheduledMatchItem = {
  courtName: string;
  id: string;
  matchDate: string;
  matchStatus: string;
  scoreSets: null | BracketScoreSet[];
  sideAAvatarUrl: null | string;
  sideAName: string;
  sideAPartnerAvatarUrl: null | string;
  sideAPartnerName: null | string;
  sideBAvatarUrl: null | string;
  sideBName: string;
  sideBPartnerAvatarUrl: null | string;
  sideBPartnerName: null | string;
  stageLabel: string;
  startMinute: number;
  /** Lado vencedor do W.O. jogado (`null` nas partidas jogadas). */
  walkoverWinner: "a" | "b" | null;
};

/** Só entra na agenda a partida com dia, hora e quadra resolvidos; o estágio
 * sai da ÚLTIMA rodada da categoria (o quadro tem uma coluna por rodada). */
export function buildScheduledMatchItems(input: {
  courts: { id: string; name: string }[];
  entriesById: Record<string, TournamentEntryWithPlayers>;
  matches: TournamentMatch[];
}): ScheduledMatchItem[] {
  const withSides = buildMatchSides(input);
  const lastRoundByCategory: Record<string, number> = {};

  for (const match of withSides) {
    const lastRound = lastRoundByCategory[match.categoryId] ?? 0;
    lastRoundByCategory[match.categoryId] = Math.max(lastRound, match.round);
  }

  return withSides
    .filter(
      (match) =>
        match.matchDate !== null &&
        match.startMinute !== null &&
        match.courtId !== null
    )
    .map((match) => {
      const sideANames = formatEntryPlayerNames(match.entryA);
      const sideBNames = formatEntryPlayerNames(match.entryB);

      return {
        courtName:
          input.courts.find((court) => court.id === match.courtId)?.name ?? "",
        id: match.id,
        matchDate: match.matchDate ?? "",
        matchStatus: match.status,
        scoreSets: match.score?.sets ?? null,
        sideAAvatarUrl: match.entryA?.playerA?.avatarUrl ?? null,
        sideAName: sideANames[0],
        sideAPartnerAvatarUrl: match.entryA?.playerB?.avatarUrl ?? null,
        sideAPartnerName: sideANames[1] ?? null,
        sideBAvatarUrl: match.entryB?.playerA?.avatarUrl ?? null,
        sideBName: sideBNames[0],
        sideBPartnerAvatarUrl: match.entryB?.playerB?.avatarUrl ?? null,
        sideBPartnerName: sideBNames[1] ?? null,
        stageLabel: formatBracketStage(
          match.round,
          lastRoundByCategory[match.categoryId] ?? match.round
        ),
        startMinute: match.startMinute ?? 0,
        walkoverWinner: walkoverWinnerSide(match),
      };
    });
}
