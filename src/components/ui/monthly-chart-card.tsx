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

/** Rótulo do mês já formatado; o dado entra PRONTO, o componente não soma nada. */
export type MonthlyChartPoint = {
  label: string;
  value: number;
};

/** Chart na receita da doc bundled do HeroUI Pro: `AreaChart.Area` com
 * `LinearGradient` do Skia, `LineChart.Line` por cima e o press do
 * `useChartPressState` com Indicator/Crosshair. O `wrapperClassName` não leva
 * padding porque o Anchor do crosshair mede no mesmo espaço do canvas Skia, e o
 * eixo X leva os índices de `tickValues` com `tickCount` igual ao número de
 * pontos — sem o `tickCount` o victory-native corta um rótulo
 * (`DEFAULT_TICK_COUNT` = 5). O eixo Y sai cru por default; com `formatAxis` o
 * rótulo formatado entra na conta da margem do plot
 * (`transformInputData.js:206-241`), então o eixo cresce junto e nada é
 * cortado. */

/** `useSharedValue` ignora o argumento depois do mount: é o `key` do call site
 * que remonta esta subárvore pra re-semear o valor com o maior rótulo ATUAL — é
 * esse texto que o `ReText` mede no primeiro render (`re-text.js:28`). O `+ 1`
 * é o deslocamento da tabela (a posição 0 é o "sem toque") e o worklet só LÊ a
 * posição, sem chamar função JS na UI thread. */
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
  // `--chart-3: var(--accent)` (theme.css do Pro): o hook resolve a cor em JS
  // pro degradê do Skia.
  const accentColor = useThemeColorPro("chart-3");
  const pillLabels = useMemo(
    () => data.map((point) => `${point.label} · ${formatValue(point.value)}`),
    [data, formatValue]
  );
  // O `matchedIndex` é a API pública do press state (`useChartPressState.js:34`)
  // e escolhe o ponto pelo ÍNDICE: os rótulos de mês repetem depois de 12 meses
  // (`getRevenueSeries` aceita até 24), então casar por texto erraria o ponto.
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
