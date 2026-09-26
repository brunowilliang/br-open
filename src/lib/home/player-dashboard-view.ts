import {
  formatPlayerCardName,
  UNDEFINED_PLAYER_NAME,
} from "@/lib/matches/match-display";
import { formatBracketStage } from "@/lib/tournaments/tournament-details-derived";
import type { ApiOutputs } from "@convex/shared/api";

type PlayerDashboardOverview = ApiOutputs["player"]["dashboard"]["getOverview"];

/** Rótulo curto do mês ("2026-09" → "set.") no calendário local. */
export function formatDashboardMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);

  if (!(year && month)) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(year, month - 1, 1)
  );
}

/** Série V/D por mês com rótulo curto de mês. */
export function buildPlayerResultsChart(
  byMonth: PlayerDashboardOverview["performance"]["byMonth"]
): Array<{ label: string; losses: number; wins: number }> {
  return byMonth.map((bucket) => ({
    label: formatDashboardMonthLabel(bucket.month),
    losses: bucket.losses,
    wins: bucket.wins,
  }));
}

/** Identidade do viewer no card: o wire dos próximos jogos não traz o próprio
 * lado (vêm só o parceiro e os adversários), então nome, apelido e avatar saem
 * do perfil que a home já carrega. */
export type PlayerDashboardViewer = {
  avatarUrl: null | string;
  fullName: string;
  nickname: null | string;
};

/** Item do card do "Próximos jogos" no molde da agenda do torneio
 * (`lib/tournaments/schedule-items.ts`): o lado do viewer vai em A e o
 * adversário em B, como no "Próximo jogo" da casa do torneio. */
export type UpcomingMatchItem = {
  competitionId: string;
  courtName: string;
  id: string;
  matchDate: string;
  /** A query só emite partida `scheduled`: é o status do chip do card. */
  matchStatus: string;
  sideAAvatarUrl: null | string;
  sideAName: string;
  sideAPartnerAvatarUrl: null | string;
  sideAPartnerName: null | string;
  sideBAvatarUrl: null | string;
  sideBName: string;
  sideBPartnerAvatarUrl: null | string;
  sideBPartnerName: null | string;
  /** Fase do quadro (`formatBracketStage`), como no torneio; `null` quando a
   * partida não traz o tamanho do quadro e o card fica sem o chip. */
  stageLabel: null | string;
  startMinute: number;
};

export function buildUpcomingMatchItems(input: {
  matches: PlayerDashboardOverview["upcomingMatches"];
  viewer: PlayerDashboardViewer;
}): UpcomingMatchItem[] {
  return input.matches.map((match) => {
    const [firstOpponent, secondOpponent] = match.opponents;

    return {
      competitionId: match.competitionId,
      courtName: match.courtName ?? "",
      id: match.id,
      matchDate: match.matchDate,
      matchStatus: "scheduled",
      sideAAvatarUrl: input.viewer.avatarUrl,
      sideAName: formatPlayerCardName(input.viewer),
      sideAPartnerAvatarUrl: match.partner?.avatarUrl ?? null,
      sideAPartnerName: match.partner
        ? formatPlayerCardName(match.partner)
        : null,
      sideBAvatarUrl: firstOpponent?.avatarUrl ?? null,
      // Lado sem inscrição: a sentinela do card, como no torneio
      // (`formatEntryPlayerNames`), nunca um texto novo.
      sideBName: firstOpponent
        ? formatPlayerCardName(firstOpponent)
        : UNDEFINED_PLAYER_NAME,
      sideBPartnerAvatarUrl: secondOpponent?.avatarUrl ?? null,
      sideBPartnerName: secondOpponent
        ? formatPlayerCardName(secondOpponent)
        : null,
      // Payload antigo (ou cache anterior ao campo) não pode virar rodada
      // inventada: sem os dois inteiros, o card sai sem o chip de fase.
      stageLabel:
        Number.isInteger(match.round) && Number.isInteger(match.totalRounds)
          ? formatBracketStage(match.round, match.totalRounds)
          : null,
      startMinute: match.startMinute,
    };
  });
}
