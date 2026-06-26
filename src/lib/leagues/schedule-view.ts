import type { ApiOutputs } from "@convex/shared/api";

type ScheduleItem = ApiOutputs["league"]["challenges"]["listScheduled"][number];

const MINUTES_PER_HOUR = 60;
const AFTERNOON_START_MINUTE = 12 * MINUTES_PER_HOUR; // 720
const EVENING_START_MINUTE = 18 * MINUTES_PER_HOUR; // 1080

export type ScheduleWindowDays = 7 | 15;

export type ScheduleDateTab = {
  matchDate: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
};

export type ScheduleDayView = {
  morning: ScheduleItem[];
  afternoon: ScheduleItem[];
  evening: ScheduleItem[];
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

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  weekday: "short",
});

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

  return DAY_LABEL_FORMATTER.format(
    Date.UTC(
      input.date.getUTCFullYear(),
      input.date.getUTCMonth(),
      input.date.getUTCDate()
    )
  ).replace(".", "");
}

export function formatDateToUtcKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Agrupa os itens de um dia por período (manhã/tarde/noite), cada lista
 * ordenada por `startMinute`. Períodos vazios ficam como array vazio; a UI
 * decide se renderiza ou não.
 */
export function buildScheduleDayView(input: {
  challenges: readonly ScheduleItem[];
  matchDate: string;
}): ScheduleDayView {
  const dayChallenges = input.challenges.filter(
    (challenge) => challenge.matchDate === input.matchDate
  );

  const morning: ScheduleItem[] = [];
  const afternoon: ScheduleItem[] = [];
  const evening: ScheduleItem[] = [];

  for (const challenge of dayChallenges) {
    if (challenge.startMinute < AFTERNOON_START_MINUTE) {
      morning.push(challenge);
    } else if (challenge.startMinute < EVENING_START_MINUTE) {
      afternoon.push(challenge);
    } else {
      evening.push(challenge);
    }
  }

  const sortByStartMinute = (a: ScheduleItem, b: ScheduleItem) =>
    a.startMinute - b.startMinute;

  morning.sort(sortByStartMinute);
  afternoon.sort(sortByStartMinute);
  evening.sort(sortByStartMinute);

  return { afternoon, evening, morning };
}

export function formatScheduleMinute(minute: number): string {
  const hour = Math.floor(minute / MINUTES_PER_HOUR);
  const currentMinute = minute % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}
