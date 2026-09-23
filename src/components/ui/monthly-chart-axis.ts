/** Escala do eixo Y do `MonthlyChartCard`. Sem `domain` explícito o
 * victory-native abre bounds iguais em `[1, -1]` (`getYScaleDomain.ts`:
 * `singleValueYScaleDomain`) e marca fracionada, então o eixo sai daqui ancorado
 * em 0 com passo inteiro.
 *
 * O máximo é tomado por comparação: `NaN` não passa no teste e fica fora do
 * eixo. Valor negativo não derruba a âncora porque as séries do card são
 * contagem de partidas e centavos de receita, nunca negativas. */

export type MonthlyYAxis = {
  domain: [number, number];
  ticks: number[];
};

/** 5 marcas (o 0 mais 4 intervalos) é o `DEFAULT_TICK_COUNT` do victory-native. */
const TICK_INTERVALS = 4;

/** Passos redondos dentro da década. */
const NICE_STEPS = [1, 2, 5];

/** Menor passo redondo (1, 2, 5, 10, 20, 50...) que cobre `minStep`, nunca
 * abaixo de 1: passo inteiro é o ponto do eixo deste card. */
function niceStep(minStep: number): number {
  if (minStep <= 1) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(minStep));
  const leading = NICE_STEPS.find((step) => step * magnitude >= minStep);

  return (leading ?? 10) * magnitude;
}

export function buildMonthlyYAxis(
  points: readonly { value: number }[]
): MonthlyYAxis {
  const max = points.reduce(
    (highest, point) => (point.value > highest ? point.value : highest),
    0
  );
  const step = niceStep(Math.ceil(max) / TICK_INTERVALS);
  // Teto fechado no múltiplo do passo; sem dado nenhum (máximo 0) o eixo ainda
  // tem duas marcas, senão o `domain` degenera em `[0, 0]` e o victory o abre
  // em `[1, -1]` de novo.
  const top = Math.max(Math.ceil(max / step) * step, step);

  return {
    domain: [0, top],
    ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step),
  };
}
