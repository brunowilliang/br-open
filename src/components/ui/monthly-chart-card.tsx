import { LinearGradient, vec } from "@shopify/react-native-skia";
import { Card } from "heroui-native";
import {
  AreaChart,
  ChartCrosshair,
  ChartIndicator,
  LineChart,
  useThemeColorPro,
} from "heroui-native-pro";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";
import { type ChartBounds, useChartPressState } from "victory-native";

import { Text } from "@/components/core/text";

import { buildCrosshairLabels } from "./monthly-chart-labels";

/** Ponto da série mensal: rótulo do mês já formatado ("set.") e o valor
 * daquele mês. O dado entra PRONTO — o componente não soma nada. */
export type MonthlyChartPoint = {
  label: string;
  value: number;
};

/**
 * Bloco de série mensal no chart aprovado na galeria (IBX-0075): Card de
 * superfície, título e description no `Text` do app e o chart na receita da doc
 * bundled do HeroUI Pro — `AreaChart.Area` com `LinearGradient` do Skia
 * (degradê do accent pra transparente, `area-chart.md` "Gradient fill"),
 * `curveType="monotoneX"` ("Curve type"), `LineChart.Line` por cima da área
 * ("Outline strokes on top of areas") e o press do `useChartPressState` com
 * `ChartIndicator` + `ChartCrosshair` + `ChartCrosshair.Value` ("Chart press
 * overlays" e "ChartCrosshair.Value"). O `wrapperClassName` do chart não leva
 * padding: o Anchor do crosshair mede no mesmo espaço do canvas Skia.
 *
 * O eixo X leva os índices inteiros de `xAxis.tickValues` (doc bundled
 * `bar-chart.md`, "Categorical X-axis tick values") e o `tickCount` com o
 * número de pontos — sem o `tickCount` o victory-native corta um rótulo
 * (`DEFAULT_TICK_COUNT` = 5). O eixo Y sai cru por default e quem tem unidade
 * (dinheiro) passa o `formatAxis`: o rótulo formatado entra na conta da margem
 * do plot (`transformInputData.js:206-241`), então o eixo cresce junto e nada
 * é cortado.
 *
 * O balão do crosshair é montado na UI thread (o `value` do
 * `ChartCrosshair.Value` é um `SharedValue<string>`), e o texto segue uma regra
 * só: a tabela de rótulos do `buildCrosshairLabels` (`monthly-chart-labels.ts`)
 * é lida pelo índice pressado (`state.matchedIndex`) e o campo NASCE com o
 * MAIOR rótulo da série. O rótulo do pacote mede a LARGURA do campo pelo texto
 * do primeiro render e depois escreve o texto por `animatedProps`, fora do
 * layout (`helpers/internal/components/re-text.js:28` e `:41`) — nascendo no
 * maior rótulo, o campo cabe qualquer ponto; nascendo vazio (o que acontecia
 * antes do BUG-0055), ele cortava o valor ("ago · R$"). Quem re-semeia o maior
 * rótulo é o `key` do `ChartCrosshairValue`: o `useSharedValue` ignora o
 * argumento depois do mount, então o `SharedValue` mora DENTRO da subárvore que
 * o `key` remonta, e o remount re-mede o campo com o rótulo NOVO quando a série
 * muda de magnitude (o valor velho ficava no `SharedValue` e o campo seguia
 * dimensionado pelo rótulo antigo).
 */

/**
 * Balão do crosshair com `SharedValue` próprio. O `key` do call site é o que
 * re-semeia o valor: trocar a série remonta esta subárvore e o `useSharedValue`
 * nasce com o maior rótulo ATUAL — é esse texto que o `ReText` mede no primeiro
 * render (`re-text.js:28`). A tabela vem pronta do `buildCrosshairLabels` e o
 * `+ 1` é o deslocamento dela (a posição 0 é o "sem toque", `matchedIndex` -1):
 * o worklet só LÊ a posição, sem chamar função JS na UI thread.
 */
function ChartCrosshairValue(props: {
  matchedIndex: SharedValue<number>;
  pillLabelTable: string[];
  widestPillLabel: string;
}) {
  const { matchedIndex, pillLabelTable, widestPillLabel } = props;
  const label = useSharedValue(widestPillLabel);

  useAnimatedReaction(
    () => matchedIndex.get(),
    (index) => {
      label.set(pillLabelTable[index + 1]);
    }
  );

  return (
    <ChartCrosshair.Value className="bg-accent px-4 pb-2" value={label}>
      <ChartCrosshair.ValueLabel className="text-sm" />
    </ChartCrosshair.Value>
  );
}

export function MonthlyChartCard(props: {
  data: MonthlyChartPoint[];
  description: string;
  /** Rótulo do eixo Y (valores da série); sem ele o eixo mostra o número cru. */
  formatAxis?: (value: number) => string;
  formatValue?: (value: number) => string;
  title: string;
}) {
  const { data, description, formatAxis, formatValue = String, title } = props;
  const { state, isActive } = useChartPressState({
    x: "" as string,
    y: { value: 0 },
  });
  const [chartBounds, setChartBounds] = useState<ChartBounds | null>(null);
  // `chart-3` é o token do accent no ramp de charts do pacote
  // (`--chart-3: var(--accent)`, theme.css do Pro) — o hook resolve a cor em
  // JS pro degradê do Skia.
  const accentColor = useThemeColorPro("chart-3");
  const pillLabels = useMemo(
    () => data.map((point) => `${point.label} · ${formatValue(point.value)}`),
    [data, formatValue]
  );
  // Rótulos e fallback saem da regra pura (`monthly-chart-labels.ts`): o texto
  // do balão segue o toque pela UI thread e `matchedIndex` é a API pública do
  // press state (`useChartPressState.js:34`), que escolhe o ponto pelo ÍNDICE —
  // os rótulos de mês repetem depois de 12 meses (`getRevenueSeries` aceita até
  // 24), então casar por texto pegaria sempre a primeira ocorrência.
  const { byIndex: pillLabelTable, widest: widestPillLabel } = useMemo(
    () => buildCrosshairLabels(pillLabels),
    [pillLabels]
  );
  const tickValues = useMemo(
    () => Array.from({ length: data.length }, (_, index) => index),
    [data.length]
  );
  const yAxis = useMemo(
    () =>
      formatAxis
        ? [
            {
              formatYLabel: (value: number | string) =>
                formatAxis(Number(value)),
            },
          ]
        : undefined,
    [formatAxis]
  );

  return (
    <Card>
      <Card.Body className="gap-3">
        <View className="gap-1">
          <Text size="base" weight="semibold">
            {title}
          </Text>
          <Text
            className="flex-1"
            color="muted"
            numberOfLines={1}
            variant="description"
          >
            {description}
          </Text>
        </View>
        <ChartCrosshair.Anchor
          chartBounds={chartBounds ?? undefined}
          isActive={state.isActive}
          x={state.x.position}
        >
          <AreaChart
            chartPressState={state}
            data={data}
            onChartBoundsChange={setChartBounds}
            wrapperClassName="h-48"
            xAxis={{ tickCount: tickValues.length, tickValues }}
            xKey="label"
            yAxis={yAxis}
            yKeys={["value"]}
          >
            {({ chartBounds: bounds, points }) => (
              <>
                <AreaChart.Area
                  colorClassName="accent-chart-3"
                  curveType="monotoneX"
                  opacity={0.35}
                  points={points.value}
                  y0={bounds.bottom}
                >
                  <LinearGradient
                    colors={[accentColor, "transparent"]}
                    end={vec(0, bounds.bottom)}
                    start={vec(0, bounds.top)}
                  />
                </AreaChart.Area>
                <LineChart.Line
                  colorClassName="accent-chart-3"
                  curveType="monotoneX"
                  points={points.value}
                />
                {isActive ? (
                  <>
                    <ChartIndicator
                      x={state.x.position}
                      y={state.y.value.position}
                    />
                    <ChartCrosshair
                      bottom={bounds.bottom}
                      top={bounds.top}
                      x={state.x.position}
                    />
                  </>
                ) : null}
              </>
            )}
          </AreaChart>
          <ChartCrosshairValue
            key={widestPillLabel}
            matchedIndex={state.matchedIndex}
            pillLabelTable={pillLabelTable}
            widestPillLabel={widestPillLabel}
          />
        </ChartCrosshair.Anchor>
      </Card.Body>
    </Card>
  );
}
