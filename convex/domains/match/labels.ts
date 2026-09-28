// ---------------------------------------------------------------------------
// Rotulos de confronto para a COPY do servidor
// ---------------------------------------------------------------------------
// Pendencia e notificacao montam o texto no servidor: sem um rotulo unico, a
// data e o placar sairiam em dois formatos diferentes. Mesmo formato dos cards
// do app (`formatMinuteToHHMM` + mes/dia), sem Intl e sem fuso: `matchDate` ja e
// a data local do torneio.

/** "28/09" a partir do `matchDate` cru; entrada fora do formato volta como veio. */
export function formatMatchMonthDay(matchDate: string): string {
  const [year, month, day] = matchDate.split("-").map(Number);

  if (!(year && month && day)) {
    return matchDate;
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** "08:00" a partir do minuto do dia. */
export function formatMatchMinute(startMinute: number): string {
  const hour = Math.floor(startMinute / 60);
  const minute = startMinute % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "28/09 às 08:00": data e hora do confronto em uma etiqueta so. */
export function formatMatchSlotLabel(input: {
  matchDate: string;
  startMinute: number;
}): string {
  return `${formatMatchMonthDay(input.matchDate)} às ${formatMatchMinute(
    input.startMinute
  )}`;
}

/** "6-3, 6-2": uma linha por set, na ordem jogada (o mini-placar do tie-break
 * fica de fora: o placar da copy e o dos games). */
export function formatMatchScoreLabel(
  sets: readonly { aGames: number; bGames: number }[]
): string {
  return sets.map((set) => `${set.aGames}-${set.bGames}`).join(", ");
}
