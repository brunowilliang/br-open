import type { ApiOutputs } from "@convex/shared/api";

type PlayerDashboardOverview = ApiOutputs["player"]["dashboard"]["getOverview"];

/** Rótulo curto do mês ("2026-09" → "set.") no calendário local. */
export function formatDashboardMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);

  if (!(year && month)) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(year, month - 1, 1)
  );
}

/** Série V/D por mês com rótulo curto de mês. */
export function buildPlayerResultsChart(
  byMonth: PlayerDashboardOverview["performance"]["byMonth"]
): Array<{ label: string; losses: number; wins: number }> {
  return byMonth.map((bucket) => ({
    label: formatDashboardMonthLabel(bucket.month),
    losses: bucket.losses,
    wins: bucket.wins,
  }));
}
