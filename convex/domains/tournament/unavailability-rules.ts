import { formatMatchMinute, formatMatchMonthDay } from "../match/labels";
import { rangesOverlap } from "../match/scheduling";

/**
 * Regras puras da INDISPONIBILIDADE da agenda (chuva, luz, quadra fechada):
 * dia inteiro, pedaco do dia ou quadra especifica. Campos ausentes sao
 * explicitos — o Convex omite chave nao gravada: sem `startMinute`/`endMinute`
 * o bloqueio cobre o dia inteiro; sem `courtId`, todas as quadras.
 */
export type TournamentUnavailability = {
  courtId?: null | string;
  date: string;
  endMinute?: null | number;
  id: string;
  reason: null | string;
  startMinute?: null | number;
};

/**
 * Primeiro bloqueio que cobre o horario pedido. A ocupacao ja vem derivada da
 * duracao padrao, como na checagem de conflito de quadra; quadra bloqueada so
 * barra a MESMA quadra (bloqueio sem quadra barra todas).
 */
export function findUnavailabilityConflict(input: {
  blocks: readonly TournamentUnavailability[];
  courtId: null | string;
  dayKey: string;
  endMinute: number;
  startMinute: number;
}): null | TournamentUnavailability {
  for (const block of input.blocks) {
    if (block.date !== input.dayKey) {
      continue;
    }
    if (typeof block.courtId === "string" && block.courtId !== input.courtId) {
      continue;
    }
    if (
      typeof block.startMinute === "number" &&
      typeof block.endMinute === "number"
    ) {
      if (
        rangesOverlap({
          leftEndMinute: input.endMinute,
          leftStartMinute: input.startMinute,
          rightEndMinute: block.endMinute,
          rightStartMinute: block.startMinute,
        })
      ) {
        return block;
      }
      continue;
    }
    return block;
  }
  return null;
}

export function formatUnavailabilityConflict(input: {
  block: TournamentUnavailability;
  courtName: null | string;
}): string {
  const { block } = input;
  const day = formatMatchMonthDay(block.date);
  const range =
    typeof block.startMinute === "number" && typeof block.endMinute === "number"
      ? ` das ${formatMatchMinute(block.startMinute)} às ${formatMatchMinute(block.endMinute)}`
      : "";
  const reason = block.reason?.trim() ?? "";
  const reasonTail = reason ? ` (${reason})` : "";

  if (typeof block.courtId === "string") {
    return `${input.courtName ?? "A quadra"} está indisponível em ${day}${range}${reasonTail}.`;
  }
  if (range) {
    return `O período de ${day}${range} está indisponível${reasonTail}.`;
  }
  return `O dia ${day} está indisponível${reasonTail}.`;
}

/** Mesma chave natural do `set`: setar o mesmo bloqueio de novo so troca o motivo. */
export function findDuplicateUnavailability(input: {
  blocks: readonly TournamentUnavailability[];
  courtId: null | string;
  date: string;
  endMinute: null | number;
  startMinute: null | number;
}): null | TournamentUnavailability {
  const endMinute = input.endMinute ?? null;
  const startMinute = input.startMinute ?? null;
  return (
    input.blocks.find(
      (block) =>
        block.date === input.date &&
        (block.courtId ?? null) === input.courtId &&
        (block.endMinute ?? null) === endMinute &&
        (block.startMinute ?? null) === startMinute
    ) ?? null
  );
}
