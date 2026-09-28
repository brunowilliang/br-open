import type {
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";

import type { ScoreSet } from "@/lib/matches/score-display";
import { buildMatchSides } from "./bracket-view";
import {
  buildMatchSlotKey,
  canReserveUnreadySlot,
} from "./organizer-match-menu";
import {
  formatBracketStage,
  formatEntryPlayerNames,
  walkoverWinnerSide,
} from "./tournament-details-derived";

/** Item do card da agenda do torneio: os dois lados já resolvidos (nome e avatar
 * do jogador e do parceiro) e o estágio nomeado pelo tamanho do quadro. */
export type ScheduledMatchItem = {
  /** Vaga acima da 1ª rodada com as duas filhas na chave: o MENU do organizador
   * é o mesmo do chaveamento (mesmo predicado, mesmo builder). */
  canReserveSlot: boolean;
  courtName: string;
  /** Inscrição de cada lado no wire: só com as duas preenchidas o card da
   * agenda oferece o menu do organizador (mesma regra do nó da chave). */
  entryAId: null | string;
  entryBId: null | string;
  id: string;
  /** Última rodada da categoria: é a final, e o menu DELA leva o "Concluir
   * torneio" (a pendência é do torneio). */
  isFinal: boolean;
  matchDate: string;
  matchStatus: string;
  scoreSets: null | ScoreSet[];
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
  const slotKeys = new Set(
    withSides.map((match) =>
      buildMatchSlotKey({
        categoryId: match.categoryId,
        round: match.round,
        slotInRound: match.slotInRound,
      })
    )
  );

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
        canReserveSlot: canReserveUnreadySlot({
          categoryId: match.categoryId,
          matchRound: match.round,
          slotInRound: match.slotInRound,
          slotKeys,
        }),
        courtName:
          input.courts.find((court) => court.id === match.courtId)?.name ?? "",
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        id: match.id,
        isFinal: match.round === lastRoundByCategory[match.categoryId],
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
