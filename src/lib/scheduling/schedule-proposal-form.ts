/** Valor do diálogo de horário: sem quadra cadastrada no torneio o `courtId`
 * vai nulo e o acerto fica em data + horário. */
export type ScheduleProposalFormValue = {
  courtId: null | string;
  endMinute: number;
  matchDate: string;
  startMinute: number;
};

/**
 * Gate do envio do diálogo de horário. A quadra só é exigida quando o torneio
 * tem quadra cadastrada (`isCourtRequired`): sem quadra o contrato do acerto
 * aceita `courtId` nulo e o servidor ignora conflito de quadra.
 */
export function resolveScheduleProposalForm(input: {
  courtId: null | string;
  defaultDurationMinutes: number;
  isCourtRequired: boolean;
  matchDate?: string;
  startMinute?: string;
}):
  | { error: null; value: ScheduleProposalFormValue }
  | { error: string; value: null } {
  const {
    courtId,
    defaultDurationMinutes,
    isCourtRequired,
    matchDate,
    startMinute,
  } = input;

  if (
    !matchDate ||
    startMinute === undefined ||
    (isCourtRequired && !courtId)
  ) {
    return {
      error: isCourtRequired
        ? "Preencha data, quadra e horário."
        : "Preencha data e horário.",
      value: null,
    };
  }

  return {
    error: null,
    value: {
      courtId: courtId ?? null,
      // Derived from the start minute + the match duration; consumers treat it
      // as an opaque field (the tournament UI has no duration input).
      endMinute: Number(startMinute) + defaultDurationMinutes,
      matchDate,
      startMinute: Number(startMinute),
    },
  };
}
