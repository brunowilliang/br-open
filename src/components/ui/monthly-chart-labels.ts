/**
 * Regra pura do texto do balão do `MonthlyChartCard` (`monthly-chart-card.tsx`),
 * extraída para ser testável sem o grafo do React Native.
 *
 * O texto do balão roda na **UI thread** (`ChartCrosshair.Value` recebe
 * `SharedValue<string>`), e uma função importada NÃO é workletizada pelo
 * `babel-preset-expo` (sonda descartável com o preset do repo: o módulo sai sem
 * `__workletHash`), então chamá-la de dentro do worklet estoura "Tried to
 * synchronously call a non-worklet function on the UI thread". Por isso a
 * escolha do rótulo sai daqui como **tabela pronta**: o worklet só LÊ a posição
 * (`monthly-chart-card.tsx`, `useAnimatedReaction`).
 */

export type CrosshairLabels = {
  /** Tabela indexada por `matchedIndex + 1` (ver `buildCrosshairLabels`). */
  byIndex: string[];
  /** Maior rótulo da série: o texto com que o campo do balão NASCE. */
  widest: string;
};

/**
 * Tabela do balão do crosshair, indexada por `matchedIndex + 1`: a posição 0 é
 * o estado SEM TOQUE (o `matchedIndex` do press state é -1 quando o dedo não
 * está no chart), as posições 1..n são o rótulo do ponto de cada índice e a
 * última posição cobre o índice fora da série.
 *
 * `widest` é o maior rótulo por COMPRIMENTO (o empate fica com o primeiro, a
 * ordem da série) e vale as DUAS pontas da tabela: é o texto com que o campo do
 * balão é medido no primeiro render — o `ReText` do pacote mede a largura por
 * ele (`helpers/internal/components/re-text.js:28` e `:41`) e depois só escreve
 * o texto por `animatedProps`, fora do layout — e é o fallback que impede o
 * corte do valor relatado no BUG-0055.
 */
export function buildCrosshairLabels(pillLabels: string[]): CrosshairLabels {
  const widest = pillLabels.reduce(
    (widestLabel, current) =>
      current.length > widestLabel.length ? current : widestLabel,
    ""
  );

  return { byIndex: [widest, ...pillLabels, widest], widest };
}
