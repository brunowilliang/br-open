import { MS_PER_DAY } from "../payment/rules";

// Plano puro da AGENDA do plantio de duplas: `functions/seed.ts` escreve no
// banco, a escolha de dia, quadra e horario de cada confronto vive aqui.

/** Duplas ativas por categoria para a chave fechar em 4 slots, sem bye. */
export const DOUBLES_SEED_AGENDA_ACTIVE_TARGET = 4;

/** Duas quadras: as duas categorias jogam no mesmo horario, sem conflito. */
export const DOUBLES_SEED_COURTS = [
  { id: "seed-doubles-court-1", name: "Quadra Central" },
  { id: "seed-doubles-court-2", name: "Quadra 2" },
] as const;

/**
 * Dias da agenda, na ORDEM dos confrontos da PRIMEIRA rodada da chave: o
 * primeiro e hoje e o segundo amanhã. Os dois horarios caem na janela da noite
 * (o card separa manha/tarde/noite por `startMinute`).
 */
export const DOUBLES_SEED_AGENDA_DAYS = [
  { offsetDays: 0, startMinute: 19 * 60 },
  { offsetDays: 1, startMinute: 20 * 60 },
] as const;

export type DoublesSeedAgendaSlot = {
  courtId: string;
  courtName: string;
  matchDate: string;
  startMinute: number;
};

/**
 * Dia, quadra e horario do enesimo confronto da PRIMEIRA rodada da chave de uma
 * categoria: o dia sai do INDICE do confronto e a quadra da ORDEM da categoria —
 * assim as duas categorias jogam nos dois dias, em quadras diferentes, e a mesma
 * execucao no mesmo dia devolve o mesmo plano.
 */
export function resolveDoublesSeedAgendaSlot(input: {
  categoryIndex: number;
  matchIndex: number;
  nowMs: number;
}): DoublesSeedAgendaSlot | null {
  const day = DOUBLES_SEED_AGENDA_DAYS[input.matchIndex];
  const court =
    DOUBLES_SEED_COURTS[input.categoryIndex % DOUBLES_SEED_COURTS.length];

  if (!(day && court)) {
    return null;
  }

  return {
    courtId: court.id,
    courtName: court.name,
    // Mesma convencao do app: a data e a CHAVE UTC do dia (`formatDateToUtcKey`).
    matchDate: new Date(input.nowMs + day.offsetDays * MS_PER_DAY)
      .toISOString()
      .slice(0, 10),
    startMinute: day.startMinute,
  };
}
