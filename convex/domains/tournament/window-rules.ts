import { formatMatchMonthDay } from "../match/labels";
import { BRAZIL_UTC_OFFSET_MS } from "../payment/rules";

/**
 * Regras puras da JANELA de datas do torneio: um intervalo de DIAS (nunca
 * instantes), no calendario brasileiro — a mesma convencao de `matchDate`.
 */

/** Dia do calendario BRASILEIRO de um instante, na chave `YYYY-MM-DD`. */
export function brazilDayKey(ms: number): string {
  const shifted = new Date(ms + BRAZIL_UTC_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/** Janela do torneio: `endDayKey` nulo e o torneio de sempre, sem teto. */
export type TournamentWindow = {
  endDayKey: string | null;
  startDayKey: string;
};

export function resolveTournamentWindow(input: {
  endDateMs?: null | number;
  startDateMs: number;
}): TournamentWindow {
  return {
    endDayKey:
      input.endDateMs === null || input.endDateMs === undefined
        ? null
        : brazilDayKey(input.endDateMs),
    startDayKey: brazilDayKey(input.startDateMs),
  };
}

/**
 * Agendar fora da janela nao passa: com fim definido, os DOIS limites valem
 * (inicio e fim); sem fim o comportamento e o de sempre, sem teto. Devolve a
 * mensagem da recusa ou `null` quando o dia esta dentro.
 */
export function validateMatchDayInWindow(input: {
  dayKey: string;
  window: TournamentWindow;
}): string | null {
  const { endDayKey, startDayKey } = input.window;
  if (endDayKey === null) {
    return null;
  }
  if (input.dayKey >= startDayKey && input.dayKey <= endDayKey) {
    return null;
  }
  return `O torneio vai de ${formatMatchMonthDay(startDayKey)} a ${formatMatchMonthDay(endDayKey)}. Estenda a janela no Editar torneio para agendar fora dela.`;
}

/**
 * Confrontos JA agendados depois do novo fim que ainda dao pra REMARCAR:
 * encurtar nao pode orfanar agenda. Resultado publicado nao volta pra agenda
 * (nem o reagendamento nem o cancelamento em lote o tocam), entao contar esse
 * confronto so daria instrucao impossivel.
 */
export function findScheduledMatchesBeyondWindowEnd(input: {
  endDayKey: string;
  matches: readonly {
    id: string;
    matchDate: null | string | undefined;
    publishedAt: Date | null | undefined;
  }[];
}): { count: number } | null {
  const beyond = input.matches.filter(
    (match) =>
      !match.publishedAt &&
      typeof match.matchDate === "string" &&
      match.matchDate > input.endDayKey
  );
  return beyond.length > 0 ? { count: beyond.length } : null;
}

export function formatShortenWindowError(input: {
  count: number;
  endDayKey: string;
}): string {
  const scheduled =
    input.count === 1
      ? "1 confronto agendado"
      : `${input.count} confrontos agendados`;
  return `Há ${scheduled} depois de ${formatMatchMonthDay(input.endDayKey)} e ainda sem resultado. Remarque esses jogos antes de encurtar o fim do torneio.`;
}

/**
 * Confronto que ainda PEDE horario: bye ja nasceu decidido, vaga morta nao
 * joga e resultado publicado ja aconteceu.
 */
export function matchNeedsSchedule(match: {
  matchDate: null | string | undefined;
  publishedAt: Date | null | undefined;
  status: string;
}): boolean {
  if (match.publishedAt) {
    return false;
  }
  if (match.status === "vacant" || match.status === "walkover") {
    return false;
  }
  return typeof match.matchDate !== "string";
}

/**
 * Aviso ao organizador quando a janela venceu com confronto sem horario: no
 * dia do fim e de novo a cada dia enquanto persistir, nunca encerrando nada.
 * O marcador por dia (`windowNoticeSentAt`) segura a repeticao do cron horario.
 */
export function shouldNotifyWindowOverflow(input: {
  lastNotifiedDayKey: string | null;
  nowMs: number;
  status: string;
  unscheduledMatchCount: number;
  window: TournamentWindow;
}): boolean {
  if (input.status !== "drawn" && input.status !== "ongoing") {
    return false;
  }
  if (input.window.endDayKey === null) {
    return false;
  }
  if (input.unscheduledMatchCount <= 0) {
    return false;
  }
  return (
    brazilDayKey(input.nowMs) >= input.window.endDayKey &&
    input.lastNotifiedDayKey !== brazilDayKey(input.nowMs)
  );
}
