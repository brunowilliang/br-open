import { formatDateToUtcKey, formatDayLabel } from "@/lib/format/date";
import { formatMinuteToHHMM as formatScheduleMinute } from "@/lib/format/time";

export { formatDateToUtcKey, formatScheduleMinute };

/** O que a agenda precisa de UM item: o dia e o minuto de início. */
export type ScheduleDayItem = { matchDate: string; startMinute: number };

const MINUTES_PER_HOUR = 60;
const AFTERNOON_START_MINUTE = 12 * MINUTES_PER_HOUR; // 720
const EVENING_START_MINUTE = 18 * MINUTES_PER_HOUR; // 1080

export type ScheduleWindowDays = 7 | 15;

/** Teto dos dias da janela (ano digitado errado no Fim não vira mil tabs): dia
 * com jogo agendado entra sempre, o teto só corta dia vazio. */
const MAX_WINDOW_DAY_TABS = 180;

export type ScheduleDateTab = {
  matchDate: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  isYesterday: boolean;
};

export type ScheduleDayView<TItem extends ScheduleDayItem = ScheduleDayItem> = {
  morning: TItem[];
  afternoon: TItem[];
  evening: TItem[];
};

export type SchedulePeriodKey = keyof ScheduleDayView;

export const SCHEDULE_PERIOD_META: Record<
  SchedulePeriodKey,
  { label: string }
> = {
  afternoon: { label: "Tarde" },
  evening: { label: "Noite" },
  morning: { label: "Manhã" },
};

export const SCHEDULE_WINDOW_OPTIONS: Array<{
  label: string;
  value: ScheduleWindowDays;
}> = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
];

/**
 * Constrói a lista de tabs de data do torneio SEM fim, do "hoje" do CALENDÁRIO
 * DO BRASIL (o dia do torneio, nunca UTC nem o relógio do aparelho) até
 * `windowDays - 1` dias à frente. Cada tab carrega o `matchDate` no formato
 * `YYYY-MM-DD` usado pela API, mais um rótulo amigável.
 */
export function buildScheduleDateTabs(input: {
  todayDayKey: string;
  windowDays: ScheduleWindowDays;
}): ScheduleDateTab[] {
  const tomorrowDayKey = addDaysToDayKey(input.todayDayKey, 1);
  const yesterdayDayKey = addDaysToDayKey(input.todayDayKey, -1);
  const tabs: ScheduleDateTab[] = [];
  let dayKey = input.todayDayKey;

  for (let offset = 0; offset < input.windowDays; offset += 1) {
    tabs.push(
      buildDateTab({
        dayKey,
        todayDayKey: input.todayDayKey,
        tomorrowDayKey,
        yesterdayDayKey,
      })
    );
    dayKey = addDaysToDayKey(dayKey, 1);
  }

  return tabs;
}

/** Uma tab de dia: os relativos do calendário do Brasil ("Hoje", "Amanhã",
 * "Ontem") e, fora deles, o rótulo curto do próprio dia. */
function buildDateTab(input: {
  dayKey: string;
  todayDayKey: string;
  tomorrowDayKey: string;
  yesterdayDayKey: string;
}): ScheduleDateTab {
  const isToday = input.dayKey === input.todayDayKey;
  const isTomorrow = input.dayKey === input.tomorrowDayKey;
  const isYesterday = input.dayKey === input.yesterdayDayKey;

  return {
    isToday,
    isTomorrow,
    isYesterday,
    label: isToday
      ? "Hoje"
      : isTomorrow
        ? "Amanhã"
        : isYesterday
          ? "Ontem"
          : formatDayLabel(new Date(`${input.dayKey}T00:00:00.000Z`)),
    matchDate: input.dayKey,
  };
}

function addDaysToDayKey(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateToUtcKey(date);
}

/**
 * Tabs ancoradas na JANELA do torneio: do início ao fim, mais os dias com jogo
 * agendado fora dela (o servidor só barra depois do fim, então um confronto
 * pode ter sobrado de antes do início — nunca esconder jogo da agenda).
 */
export function buildScheduleWindowTabs(input: {
  endDayKey: string;
  extraDayKeys?: readonly string[];
  startDayKey: string;
  todayDayKey: string;
}): ScheduleDateTab[] {
  const dayKeys = new Set<string>(input.extraDayKeys ?? []);
  const tomorrowDayKey = addDaysToDayKey(input.todayDayKey, 1);
  const yesterdayDayKey = addDaysToDayKey(input.todayDayKey, -1);
  let dayKey = input.startDayKey;

  for (
    let index = 0;
    dayKey <= input.endDayKey && index < MAX_WINDOW_DAY_TABS;
    index += 1
  ) {
    dayKeys.add(dayKey);
    dayKey = addDaysToDayKey(dayKey, 1);
  }

  return [...dayKeys].sort().map((matchDate) =>
    buildDateTab({
      dayKey: matchDate,
      todayDayKey: input.todayDayKey,
      tomorrowDayKey,
      yesterdayDayKey,
    })
  );
}

/**
 * Dia aberto ao entrar na agenda: o "hoje" do calendário do Brasil quando ele
 * está na lista ou, se cair num buraco (dia extra antes do início, janela maior
 * que o teto), o PRÓXIMO dia da lista; antes do primeiro o clamp pega o
 * primeiro e depois do último pega o último — a agenda nunca abre num dia fora
 * da lista.
 */
export function resolveInitialScheduleDayKey(input: {
  dayKeys: readonly string[];
  todayDayKey: string;
}): string {
  const dayKeys = [...input.dayKeys].sort();
  const next = dayKeys.find((key) => key >= input.todayDayKey);

  return next ?? dayKeys.at(-1) ?? "";
}

/**
 * Limites do seletor de data do agendamento: o dia de hoje nunca fica atrás e a
 * janela vencida não vira max menor que min (aí o servidor explica pelo toast).
 * Sem fim não existe janela (o servidor não barra nada em torneio legado): o
 * limite é o de sempre, sem olhar o início.
 */
export function resolveScheduleDateBounds(input: {
  endDayKey?: null | string;
  startDayKey?: null | string;
  todayDayKey: string;
}): { maxDayKey: null | string; minDayKey: string } {
  if (!input.endDayKey) {
    return { maxDayKey: null, minDayKey: input.todayDayKey };
  }

  const minDayKey =
    input.startDayKey && input.startDayKey > input.todayDayKey
      ? input.startDayKey
      : input.todayDayKey;
  const maxDayKey = input.endDayKey >= minDayKey ? input.endDayKey : null;

  return { maxDayKey, minDayKey };
}

/**
 * Agrupa os itens de um dia por período (manhã/tarde/noite), cada lista
 * ordenada por `startMinute`. Períodos vazios ficam como array vazio; a UI
 * decide se renderiza ou não.
 */
export function buildScheduleDayView<T extends ScheduleDayItem>(input: {
  challenges: readonly T[];
  matchDate: string;
}): ScheduleDayView<T> {
  const dayChallenges = input.challenges.filter(
    (challenge) => challenge.matchDate === input.matchDate
  );

  const morning: T[] = [];
  const afternoon: T[] = [];
  const evening: T[] = [];

  for (const challenge of dayChallenges) {
    if (challenge.startMinute < AFTERNOON_START_MINUTE) {
      morning.push(challenge);
    } else if (challenge.startMinute < EVENING_START_MINUTE) {
      afternoon.push(challenge);
    } else {
      evening.push(challenge);
    }
  }

  const sortByStartMinute = (a: T, b: T) => a.startMinute - b.startMinute;

  morning.sort(sortByStartMinute);
  afternoon.sort(sortByStartMinute);
  evening.sort(sortByStartMinute);

  return { afternoon, evening, morning };
}
