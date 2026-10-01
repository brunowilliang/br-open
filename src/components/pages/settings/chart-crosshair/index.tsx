import { View } from "react-native";

import { Text } from "@/components/core/text";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";

/**
 * Série de exemplo no shape que a home do jogador consome
 * (`performance.byMonth`), pelo mesmo builder.
 */
const galleryResultsByMonth = [
  { losses: 1, month: "2026-04", wins: 2 },
  { losses: 2, month: "2026-05", wins: 1 },
  { losses: 0, month: "2026-06", wins: 3 },
  { losses: 1, month: "2026-07", wins: 2 },
  { losses: 2, month: "2026-08", wins: 3 },
  { losses: 1, month: "2026-09", wins: 4 },
];

const galleryMatchesByMonth = buildPlayerResultsChart(
  galleryResultsByMonth
).map((month) => ({
  label: month.label,
  value: month.wins + month.losses,
}));

export function ChartCrosshairGallerySection() {
  return (
    <View className="gap-4">
      <Text color="muted" variant="description">
        Série de exemplo no mesmo shape da home do jogador (lá entra a série
        real de 6 meses). Toque e arraste no gráfico para ver o crosshair.
      </Text>
      <MonthlyChartCard
        data={galleryMatchesByMonth}
        description="Total de partidas por mês nos últimos 6 meses."
        title="Partidas por mês"
      />
    </View>
  );
}
