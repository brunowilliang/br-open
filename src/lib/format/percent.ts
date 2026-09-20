/** Aproveitamento (taxa 0..1, ex. `performance.winRate` do dash do jogador e
 * a `rate` do `buildPlayerWinRate`) como porcentagem inteira pra exibição —
 * a MESMA string que os KPIs de desempenho montavam inline antes (IBX-0075):
 * `0` vira "0%", `1` vira "100%", `2/3` vira "67%". */
export function formatRateAsPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
