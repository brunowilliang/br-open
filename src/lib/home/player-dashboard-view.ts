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

/** O wire dos próximos jogos: o MESMO shape do dash, com o agendamento nulo
 * quando o confronto ainda não tem horário (a chave saiu e o jogo já é dele). */
export type UpcomingMatchWire = Omit<
  PlayerDashboardOverview["upcomingMatches"][number],
  "endMinute" | "matchDate" | "startMinute"
> & {
  endMinute: null | number;
  matchDate: null | string;
  startMinute: null | number;
};

/** Item do card do "Próximos jogos" no molde da agenda do torneio
 * (`lib/tournaments/schedule-items.ts`): o lado do viewer vai em A e o
 * adversário em B, como no "Próximo jogo" da casa do torneio. */
export type UpcomingMatchItem = {
  competitionId: string;
  courtName: string;
  id: string;
  /** Dia do jogo (`YYYY-MM-DD`) ou `null` sem agendamento: o card só desenha o
   * rodapé de horário quando tem data e quadra. */
  matchDate: null | string;
  /** Status do chip do card: `pending` ("A definir") enquanto o confronto não
   * tem horário, `scheduled` depois. */
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
  /** Minuto do início ou `null` sem agendamento (não é lido sem data). */
  startMinute: null | number;
};

export function buildUpcomingMatchItems(input: {
  matches: readonly UpcomingMatchWire[];
  viewer: PlayerDashboardViewer;
}): UpcomingMatchItem[] {
  return input.matches.map((match) => {
    const [firstOpponent, secondOpponent] = match.opponents;
    // A chave saiu: o confronto entra na lista MESMO sem horário (o card desenha
    // os dois lados e a ação de propor horário), só sem a linha de agendamento.
    const isScheduled = match.matchDate !== null && match.startMinute !== null;

    return {
      competitionId: match.competitionId,
      courtName: match.courtName ?? "",
      id: match.id,
      matchDate: match.matchDate,
      matchStatus: isScheduled ? "scheduled" : "pending",
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
