/** Aproveitamento (taxa 0..1, ex. `performance.winRate` e `buildPlayerWinRate`)
 * como porcentagem inteira: `0` -> "0%", `1` -> "100%", `2/3` -> "67%" — a
 * MESMA string que os KPIs montavam inline, contrato de exibição dos cards. */
export function formatRateAsPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
