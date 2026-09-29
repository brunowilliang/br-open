import { brazilDayKey } from "@convex/domains/tournament/window-rules";

const DAY_MS = 24 * 60 * 60 * 1000;
// Meio-dia UTC = 09:00 do Brasil: somar dias inteiros nunca troca o dia do
// calendário brasileiro na borda do fuso.
const SHIFT_ANCHOR_HOUR_UTC = 12;

function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);

  return brazilDayKey(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, SHIFT_ANCHOR_HOUR_UTC) +
      days * DAY_MS
  );
}

/** Fim da janela quando o início muda: o torneio dura PELO MENOS até o dia
 * seguinte ao início, então um fim igual ou anterior vira início + 1. Fim em
 * branco (torneio legado sem teto) segue em branco. */
export function resolveTournamentEndDate(input: {
  endDate: string;
  startDate: string;
}): string {
  if (input.endDate === "" || input.endDate > input.startDate) {
    return input.endDate;
  }

  return shiftDayKey(input.startDate, 1);
}

/** Prazo automático: 3 dias antes do início, nunca no passado (o limite do
 * campo é hoje). Início hoje não tem dia válido — o prazo tem de ser anterior
 * ao início — e o campo fica em branco pro organizador decidir. */
export function buildAutoRegistrationDeadline(input: {
  startDate: string;
  todayDayKey: string;
}): string {
  const threeDaysBefore = shiftDayKey(input.startDate, -3);
  const bounded =
    threeDaysBefore < input.todayDayKey ? input.todayDayKey : threeDaysBefore;

  return bounded >= input.startDate ? "" : bounded;
}

/** Divulgação automática: 2 dias antes do início, nunca no passado. O próprio
 * dia do início vale (a chave abre junto com o torneio); só um início já
 * passado (torneio legado na edição) fica em branco. */
export function buildAutoBracketReleaseDate(input: {
  startDate: string;
  todayDayKey: string;
}): string {
  const twoDaysBefore = shiftDayKey(input.startDate, -2);
  const bounded =
    twoDaysBefore < input.todayDayKey ? input.todayDayKey : twoDaysBefore;

  return bounded > input.startDate ? "" : bounded;
}

/** Campo de data acompanha o início só enquanto ninguém editou à mão: vazio ou
 * ainda igual ao último automático aplicado pelo formulário. */
export function shouldDateFollowStartDate(input: {
  lastAutoValue: string;
  value: string;
}): boolean {
  return input.value === "" || input.value === input.lastAutoValue;
}
