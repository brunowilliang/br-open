const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const mediumDateUtcFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const dateTimeShortFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  weekday: "short",
});

const monthDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date);
}

export function formatMediumDateUtc(date: Date): string {
  return mediumDateUtcFormatter.format(date);
}

export function formatDateTimeShort(date: Date): string {
  return dateTimeShortFormatter.format(date);
}

export function formatDayLabel(date: Date): string {
  return dayLabelFormatter
    .format(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
    .replace(".", "");
}

export function formatMonthDay(date: Date): string {
  return monthDayFormatter.format(date);
}

export function formatDateToUtcKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthStartMs(now: number): number {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.getTime();
}

export function getMonthStartDate(now: number): Date {
  return new Date(getMonthStartMs(now));
}

export function formatMatchDate(matchDate: string): string {
  const [year, month, day] = matchDate.split("-").map(Number);

  if (!(year && month && day)) {
    return matchDate;
  }

  return formatMediumDateUtc(new Date(Date.UTC(year, month - 1, day)));
}
