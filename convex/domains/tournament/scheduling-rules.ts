import { BRAZIL_UTC_OFFSET_MS, MS_PER_DAY } from "../payment/rules";
import type { MatchConfig } from "../match/contract";
import {
  rangesOverlap,
  resolveMatchOccupiedEndMinute,
} from "../match/scheduling";

/** Dia do calendario BRASILEIRO de um instante (offset fixo do repo). */
function brazilDayIndex(ms: number): number {
  return Math.floor((ms + BRAZIL_UTC_OFFSET_MS) / MS_PER_DAY);
}

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
  return brazilDayIndex(input.startDateMs) <= brazilDayIndex(input.nowMs);
}

/**
 * O auto-sorteio roda quando o PRAZO DE INSCRICAO fecha: a fase `drawn` (previa
 * privada do organizador, com ajuste e re-sorteio) passa a existir ANTES do dia
 * de inicio, em vez de nascer e morrer no mesmo tick do start. Sem prazo, ou com
 * prazo depois do dia de inicio, quem resolve e o start — o comportamento de
 * sempre. `drawn` ja tem chave: nunca entra aqui (nao existe re-sorteio
 * automatico).
 */
export function shouldAutoDrawTournament(input: {
  nowMs: number;
  registrationDeadlineMs: number;
  startDateMs: number;
  status: string;
}): boolean {
  if (input.status !== "published") {
    return false;
  }
  if (!Number.isFinite(input.registrationDeadlineMs)) {
    return false;
  }
  if (
    brazilDayIndex(input.registrationDeadlineMs) >
    brazilDayIndex(input.startDateMs)
  ) {
    return false;
  }
  // Mesmo limite do `isRegistrationOpen`: no instante do prazo ja esta fechado.
  return input.registrationDeadlineMs <= input.nowMs;
}

/**
 * A DIVULGACAO agendada chegou: o cron sorteia (se ainda nao houver sorteio) e
 * solta a chave para os jogadores nesse instante. Sem data (ou com data ausente,
 * o torneio legado) nao ha divulgacao agendada — a abertura continua sendo o
 * inicio; ja solto, nunca repete (idempotente por estado, como os passos acima).
 */
export function shouldAutoReleaseTournament(input: {
  bracketReleaseAtMs: null | number | undefined;
  bracketReleasedAtMs: null | number | undefined;
  nowMs: number;
  status: string;
}): boolean {
  if (input.status !== "published" && input.status !== "drawn") {
    return false;
  }
  const releaseAtMs = input.bracketReleaseAtMs ?? null;
  if (releaseAtMs === null || !Number.isFinite(releaseAtMs)) {
    return false;
  }
  if ((input.bracketReleasedAtMs ?? null) !== null) {
    return false;
  }
  return releaseAtMs <= input.nowMs;
}

/**
 * A chave esta DIVULGADA (solta para os jogadores): o cron carimbou
 * `bracketReleasedAt` na data combinada OU o torneio ja comecou. `ongoing` e
 * `finished` contam como divulgado de proposito: torneio legado, sem os campos
 * novos, mantem o comportamento de sempre (chave publica so no inicio). Ate a
 * divulgacao o quadro inteiro e privado do organizador.
 */
export function isBracketReleased(input: {
  bracketReleasedAt: Date | null | undefined;
  status: string;
}): boolean {
  if (input.status === "ongoing" || input.status === "finished") {
    return true;
  }
  return (input.bracketReleasedAt ?? null) !== null;
}

/** Ação automática do cron para um torneio elegível (`null` deixa quieto). */
export function resolveTournamentAutoAction(input: {
  bracketReleaseAtMs: null | number | undefined;
  bracketReleasedAtMs: null | number | undefined;
  nowMs: number;
  registrationDeadlineMs: number;
  startDateMs: number;
  status: string;
}): "draw" | "release" | "start" | null {
  if (shouldAutoStartTournament(input)) {
    return "start";
  }
  if (shouldAutoReleaseTournament(input)) {
    return "release";
  }
  return shouldAutoDrawTournament(input) ? "draw" : null;
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
  matchConfig: MatchConfig;
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

/** Confronto que o cancelamento PULA: decidido (publicado ou vaga morta) ou sem nada a tirar. */
export function shouldSkipMatchCancel(match: {
  matchDate: null | string | undefined;
  publishedAt: Date | null | undefined;
  status: string;
}): boolean {
  if (match.publishedAt) {
    return true;
  }
  if (match.status === "vacant") {
    return true;
  }
  return typeof match.matchDate !== "string";
}

/**
 * Plano do cancelamento em LOTE: quem perde a agenda e quem e apenas contado
 * como pulado. Resultado publicado e vaga vazia nao se tocam; confronto sem
 * data nao tem o que tirar.
 */
export function resolveBulkCancelPlan<
  T extends {
    matchDate: null | string | undefined;
    publishedAt: Date | null | undefined;
    status: string;
  },
>(matches: readonly T[]): { cancels: T[]; skipped: number } {
  const cancels: T[] = [];
  let skipped = 0;
  for (const match of matches) {
    if (shouldSkipMatchCancel(match)) {
      skipped += 1;
      continue;
    }
    cancels.push(match);
  }
  return { cancels, skipped };
}

/**
 * Vaga vazia ou sem os dois lados so o ORGANIZADOR reserva, e SO acima da 1a
 * rodada: semi/final espera os vencedores dos confrontos de baixo. A 1a rodada
 * espera a inscricao e continua exigindo os dois lados.
 */
export function canReserveUnreadySlot(input: {
  actor: "organizer" | "player";
  feederMatchesExist: boolean;
  round: number;
}): boolean {
  return (
    input.actor === "organizer" && input.round > 1 && input.feederMatchesExist
  );
}
