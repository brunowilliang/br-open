/** O balão roda na UI thread: função IMPORTADA não é workletizada pelo
 * `babel-preset-expo` (o módulo sai sem `__workletHash`) e chamá-la de dentro do
 * worklet estoura "Tried to synchronously call a non-worklet function" — por
 * isso a escolha do rótulo sai daqui como tabela pronta. */

export type CrosshairLabels = {
  /** Tabela indexada por `matchedIndex + 1` (ver `buildCrosshairLabels`). */
  byIndex: string[];
  /** Maior rótulo da série: o texto com que o campo do balão NASCE. */
  widest: string;
};

/** Tabela indexada por `matchedIndex + 1` (o press state usa -1 quando o dedo
 * não está no chart): o `widest` (maior rótulo por comprimento, empate com o
 * primeiro) vale as DUAS pontas porque o `ReText` mede a largura pelo texto
 * inicial (`helpers/internal/components/re-text.js:28`) e depois só escreve por
 * `animatedProps` — sem ele o valor do balão sai cortado. */
export function buildCrosshairLabels(pillLabels: string[]): CrosshairLabels {
  const widest = pillLabels.reduce(
    (widestLabel, current) =>
      current.length > widestLabel.length ? current : widestLabel,
    ""
  );

  return { byIndex: [widest, ...pillLabels, widest], widest };
}
