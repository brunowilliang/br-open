import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";

/** Motivos prontos do cancelamento/bloqueio; o resto vai escrito no campo
 * "Outro". */
export const UNAVAILABILITY_REASON_PRESETS = [
  "Chuva",
  "Calor",
  "Falta de luz",
  "Quadra",
] as const;

export type UnavailabilityReasonPreset =
  (typeof UNAVAILABILITY_REASON_PRESETS)[number];

const MINUTES_PER_DAY = 1440;
const TIME_STEP_MINUTES = 30;

/** Preset marcado pelo motivo: texto fora dos prontos não marca chip nenhum
 * (ele vive no campo "Outro"). */
export function resolveReasonPreset(
  reason: string
): null | UnavailabilityReasonPreset {
  const normalized = reason.trim().toLocaleLowerCase("pt-BR");

  if (normalized.length === 0) {
    return null;
  }

  return (
    UNAVAILABILITY_REASON_PRESETS.find(
      (option) => option.toLocaleLowerCase("pt-BR") === normalized
    ) ?? null
  );
}

/** Toque no chip do motivo: marca o preset e, no mesmo chip de novo, desmarca.
 * O valor fica vazio, então o texto do campo "Outro" também sai. */
export function toggleReasonPreset(input: {
  current: string;
  preset: UnavailabilityReasonPreset;
}): string {
  return resolveReasonPreset(input.current) === input.preset
    ? ""
    : input.preset;
}

export type UnavailabilitySpan = {
  date: string;
  endMinute: number;
  startMinute: number;
};

/**
 * Um bloqueio por DIA a partir dos confrontos cancelados: a faixa vai do
 * primeiro início ao último fim daquele dia, então o resto do dia segue livre.
 */
export function buildUnavailabilitySpans(
  matches: readonly {
    endMinute: number;
    matchDate: string;
    startMinute: number;
  }[]
): UnavailabilitySpan[] {
  const byDate = new Map<string, UnavailabilitySpan>();

  for (const match of matches) {
    const current = byDate.get(match.matchDate);

    byDate.set(match.matchDate, {
      date: match.matchDate,
      endMinute: Math.max(current?.endMinute ?? 0, match.endMinute),
      startMinute: current
        ? Math.min(current.startMinute, match.startMinute)
        : match.startMinute,
    });
  }

  return [...byDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
}

/** "Dia todo" ou "16:00 às 20:00": a faixa do bloqueio no vocabulário do app. */
export function formatUnavailabilityPeriod(input: {
  endMinute: null | number;
  startMinute: null | number;
}): string {
  if (input.startMinute === null || input.endMinute === null) {
    return "Dia todo";
  }

  return `${formatMinuteToHHMM(input.startMinute)} às ${formatMinuteToHHMM(input.endMinute)}`;
}

/** Chip do bloqueio do dia: motivo | quadra | faixa. Sem motivo o rótulo começa
 * na quadra: nunca sobra separador solto. */
export function buildUnavailabilityChipLabel(block: {
  courtName: null | string;
  endMinute: null | number;
  reason: null | string;
  startMinute: null | number;
}): string {
  const reason = block.reason?.trim() ?? "";

  return [
    ...(reason.length > 0 ? [reason] : []),
    block.courtName ?? "Todas as quadras",
    formatUnavailabilityPeriod(block),
  ].join(" | ");
}

type UnavailabilityCoverageInput = {
  courtId: null | string;
  endMinute: null | number;
  startMinute: null | number;
};

/** Abrangência de exibição: quadra contida (a específica cai dentro de "Todas
 * as quadras") e período contido. Igual ao servidor, um bloqueio sem as DUAS
 * horas vale como dia inteiro e cobre qualquer faixa do dia. */
export function coversUnavailability(
  outer: UnavailabilityCoverageInput,
  inner: UnavailabilityCoverageInput
): boolean {
  if (outer.courtId !== null && outer.courtId !== inner.courtId) {
    return false;
  }

  if (outer.startMinute === null || outer.endMinute === null) {
    return true;
  }

  if (inner.startMinute === null || inner.endMinute === null) {
    return false;
  }

  return (
    outer.startMinute <= inner.startMinute && outer.endMinute >= inner.endMinute
  );
}

/**
 * Só os bloqueios MÁXIMOS do dia: um totalmente coberto por outro não vira
 * alerta próprio (ele segue valendo no servidor e reaparece quando o maior é
 * reaberto). Empate = o mais recente fica; o id fecha o desempate, então a
 * lista não pisca entre renders.
 */
export function selectVisibleUnavailabilityBlocks<
  T extends UnavailabilityCoverageInput & {
    createdAt: number;
    date: string;
    id: string;
  },
>(blocks: readonly T[]): T[] {
  return blocks.filter((block, index) =>
    blocks.every((other, otherIndex) => {
      if (
        otherIndex === index ||
        other.id === block.id ||
        other.date !== block.date ||
        !coversUnavailability(other, block)
      ) {
        return true;
      }

      if (!coversUnavailability(block, other)) {
        return false;
      }

      return (
        block.createdAt > other.createdAt ||
        (block.createdAt === other.createdAt && block.id > other.id)
      );
    })
  );
}

/** "13 de out., das 16:00 às 20:00": o que o check do cancelamento vai fechar. */
export function formatUnavailabilitySpanLabel(
  span: UnavailabilitySpan
): string {
  return `${formatMatchMonthDay(span.date)}, das ${formatUnavailabilityPeriod(span)}`;
}

export type UnavailabilityTimeOption = { label: string; value: string };

/** Inícios de bloqueio de 30 em 30 minutos; o fim vem DEPOIS do início. */
export function buildUnavailabilityStartOptions(): UnavailabilityTimeOption[] {
  const options: UnavailabilityTimeOption[] = [];

  for (
    let minute = 0;
    minute + TIME_STEP_MINUTES <= MINUTES_PER_DAY;
    minute += TIME_STEP_MINUTES
  ) {
    options.push({ label: formatMinuteToHHMM(minute), value: String(minute) });
  }

  return options;
}

export function buildUnavailabilityEndOptions(
  startMinute: number
): UnavailabilityTimeOption[] {
  const options: UnavailabilityTimeOption[] = [];

  for (
    let minute = startMinute + TIME_STEP_MINUTES;
    minute <= MINUTES_PER_DAY;
    minute += TIME_STEP_MINUTES
  ) {
    options.push({ label: formatMinuteToHHMM(minute), value: String(minute) });
  }

  return options;
}
