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
import { useDerivedValue } from "react-native-reanimated";
import { type ChartBounds, useChartPressState } from "victory-native";

import { Text } from "@/components/core/text";

/** Ponto da série mensal: rótulo do mês já formatado ("set.") e o total de
 * partidas daquele mês. O dado entra PRONTO — o componente não soma nada. */
export type MonthlyMatchesPoint = {
  label: string;
  matches: number;
};

/**
 * Bloco "Partidas por mês" aprovado na galeria (IBX-0075): Card de superfície,
 * título e description no `Text` do app e o chart na receita da doc bundled do
 * HeroUI Pro — `AreaChart.Area` com `LinearGradient` do Skia (degradê do accent
 * pra transparente, `area-chart.md` "Gradient fill"), `curveType="monotoneX"`
 * ("Curve type"), `LineChart.Line` por cima da área ("Outline strokes on top of
 * areas") e o press do `useChartPressState` com `ChartIndicator` +
 * `ChartCrosshair` + `ChartCrosshair.Value` ("Chart press overlays" e
 * "ChartCrosshair.Value"). O `wrapperClassName` do chart não leva padding: o
 * Anchor do crosshair mede no mesmo espaço do canvas Skia.
 *
 * O eixo X leva os índices inteiros de `xAxis.tickValues` (doc bundled
 * `bar-chart.md`, "Categorical X-axis tick values") e o `tickCount` com o
 * número de pontos — sem o `tickCount` o victory-native corta um rótulo
 * (`DEFAULT_TICK_COUNT` = 5).
 */
export function MonthlyMatchesCard(props: { data: MonthlyMatchesPoint[] }) {
  const { state, isActive } = useChartPressState({
    x: "" as string,
    y: { matches: 0 },
  });
  const [chartBounds, setChartBounds] = useState<ChartBounds | null>(null);
  // `chart-3` é o token do accent no ramp de charts do pacote
  // (`--chart-3: var(--accent)`, theme.css do Pro) — o hook resolve a cor em
  // JS pro degradê do Skia.
  const accentColor = useThemeColorPro("chart-3");
  const label = useDerivedValue(
    () => `${state.x.value.get()} · ${state.y.matches.value.get()}`
  );
  const tickValues = useMemo(
    () => Array.from({ length: props.data.length }, (_, index) => index),
    [props.data.length]
  );

  return (
    <Card>
      <Card.Body className="gap-3">
        <View className="gap-1">
          <Text size="base" weight="semibold">
            Partidas por mês
          </Text>
          <Text
            className="flex-1"
            color="muted"
            numberOfLines={1}
            variant="description"
          >
            Total de partidas por mês nos últimos 6 meses.
          </Text>
        </View>
        <ChartCrosshair.Anchor
          chartBounds={chartBounds ?? undefined}
          isActive={state.isActive}
          x={state.x.position}
        >
          <AreaChart
            chartPressState={state}
            data={props.data}
            onChartBoundsChange={setChartBounds}
            wrapperClassName="h-48"
            xAxis={{ tickCount: tickValues.length, tickValues }}
            xKey="label"
            yKeys={["matches"]}
          >
            {({ chartBounds: bounds, points }) => (
              <>
                <AreaChart.Area
                  colorClassName="accent-chart-3"
                  curveType="monotoneX"
                  opacity={0.35}
                  points={points.matches}
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
                  points={points.matches}
                />
                {isActive ? (
                  <>
                    <ChartIndicator
                      x={state.x.position}
                      y={state.y.matches.position}
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
          <ChartCrosshair.Value className="min-w-20 px-2" value={label} />
        </ChartCrosshair.Anchor>
      </Card.Body>
    </Card>
  );
}
