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
 * Constrói a lista de tabs de data, de "Hoje" até `windowDays - 1` dias à
 * frente. Cada tab carrega o `matchDate` no formato `YYYY-MM-DD` (UTC) usado
 * pela API, mais um rótulo amigável.
 */
export function buildScheduleDateTabs(input: {
  today: Date;
  windowDays: ScheduleWindowDays;
}): ScheduleDateTab[] {
  const tabs: ScheduleDateTab[] = [];

  for (let offset = 0; offset < input.windowDays; offset += 1) {
    const date = new Date(input.today);
    date.setUTCDate(date.getUTCDate() + offset);

    const isToday = offset === 0;
    const isTomorrow = offset === 1;

    tabs.push({
      isToday,
      isTomorrow,
      label: buildDateTabLabel({ date, isToday, isTomorrow }),
      matchDate: formatDateToUtcKey(date),
    });
  }

  return tabs;
}

function buildDateTabLabel(input: {
  date: Date;
  isToday: boolean;
  isTomorrow: boolean;
}): string {
  if (input.isToday) {
    return "Hoje";
  }

  if (input.isTomorrow) {
    return "Amanhã";
  }

  return formatDayLabel(input.date);
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
  let dayKey = input.startDayKey;

  for (
    let index = 0;
    dayKey <= input.endDayKey && index < MAX_WINDOW_DAY_TABS;
    index += 1
  ) {
    dayKeys.add(dayKey);
    dayKey = addDaysToDayKey(dayKey, 1);
  }

  return [...dayKeys].sort().map((matchDate) => ({
    isToday: matchDate === input.todayDayKey,
    isTomorrow: matchDate === tomorrowDayKey,
    label:
      matchDate === input.todayDayKey
        ? "Hoje"
        : matchDate === tomorrowDayKey
          ? "Amanhã"
          : formatDayLabel(new Date(`${matchDate}T00:00:00.000Z`)),
    matchDate,
  }));
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
