import { BRAZIL_UTC_OFFSET_MS, MS_PER_DAY } from "../payment/rules";
import {
  rangesOverlap,
  resolveMatchOccupiedEndMinute,
} from "../league/challenge-scheduling-rules";
import type { LeagueMatchConfig } from "../league/contract";

/**
 * A data de início chegou (no calendário BRASILEIRO, convenção do repo) e o
 * torneio começa SOZINHO, sem o organizador tocar em Iniciar. Compara o DIA
 * dos dois instantes, não uma janela de 24h — um startDate em qualquer hora
 * do dia D dispara durante D. `drawn` começa direto; `published` sorteia
 * primeiro e depois começa. Idempotente por status: uma vez `ongoing`, nunca
 * dispara de novo.
 */
export function shouldAutoStartTournament(input: {
  nowMs: number;
  startDateMs: number;
  status: string;
}): boolean {
  if (input.status !== "drawn" && input.status !== "published") {
    return false;
  }
  return (
    Math.floor((input.startDateMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY) <=
    Math.floor((input.nowMs + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY)
  );
}

/**
 * Campos de agendamento que a checagem de conflito de quadra precisa. Chaves
 * ausentes são modeladas explicitamente: o Convex omite chaves não gravadas,
 * então o runtime entrega undefined mesmo onde o tipo diz `| null`.
 */
export type TournamentScheduledMatch = {
  courtId: string | null | undefined;
  id: string;
  matchDate: string | null | undefined;
  startMinute: number | null | undefined;
};

export function isScheduledTournamentMatch(
  match: TournamentScheduledMatch
): match is TournamentScheduledMatch & {
  courtId: string;
  matchDate: string;
  startMinute: number;
} {
  return (
    typeof match.courtId === "string" &&
    typeof match.matchDate === "string" &&
    typeof match.startMinute === "number"
  );
}

/**
 * Primeira partida agendada que ocupa [start, start + duração padrão) na
 * mesma quadra e data, ou null. A ocupação é derivada da duração padrão dos
 * DOIS lados, então um endMinute vindo do cliente não encurta uma reserva já
 * feita. A partida sendo reagendada ignora a si mesma. W.O. continua ocupando
 * a quadra: a reserva foi feita.
 */
export function findCourtSlotConflict(input: {
  courtId: string;
  endMinute: number;
  ignoredMatchId?: string;
  matchConfig: LeagueMatchConfig;
  matchDate: string;
  scheduledMatches: TournamentScheduledMatch[];
  startMinute: number;
}): TournamentScheduledMatch | null {
  for (const match of input.scheduledMatches) {
    if (match.id === input.ignoredMatchId) {
      continue;
    }
    if (
      match.courtId !== input.courtId ||
      match.matchDate !== input.matchDate ||
      typeof match.startMinute !== "number"
    ) {
      continue;
    }

    const occupiedEndMinute = resolveMatchOccupiedEndMinute({
      matchConfig: input.matchConfig,
      startMinute: match.startMinute,
    });

    if (
      rangesOverlap({
        leftEndMinute: input.endMinute,
        leftStartMinute: input.startMinute,
        rightEndMinute: occupiedEndMinute,
        rightStartMinute: match.startMinute,
      })
    ) {
      return match;
    }
  }

  return null;
}
