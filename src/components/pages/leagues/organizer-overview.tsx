import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { KpiCard } from "@/components/ui/kpi-card";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { buildOrganizerMonthlyMatchesSeries } from "@/lib/leagues/organizer-overview-derived";

/**
 * Casa da liga para o organizador: receita da liga, inscritos e partidas no
 * mês no KpiCard da galeria (IBX-0075 r2), com o rótulo+valor do molde
 * texto-simples (WidgetAlerts, TrendChip e AreaChart seguem fora). Receita
 * soma `bySource` da série da organização (query existente) filtrada pelos
 * memberships DESTA liga no cliente — nenhuma query nova.
 */
export function OrganizerOverview() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const challenges = useValue(bucket$.data.challenges);
  const league = useValue(bucket$.data.league);
  const membershipOverview = useValue(bucket$.data.membershipOverview);

  const now = Date.now();
  const monthlySeries = buildOrganizerMonthlyMatchesSeries({
    challenges,
    now,
  });
  const currentMonth = monthlySeries.at(-1);
  const matchesThisMonth = currentMonth ? currentMonth.matches : 0;

  const activeCount = membershipOverview?.ranking.length ?? 0;
  const maxPlayers = league?.maxPlayers ?? null;
  const membershipIds = new Set([
    ...(membershipOverview?.ranking.map((item) => item.id) ?? []),
    ...(membershipOverview?.pendingRequests.map((item) => item.id) ?? []),
  ]);

  const revenueSeriesQuery = useQuery(
    crpc.payment.dashboard.getRevenueSeries.staticQueryOptions({ months: 12 })
  );
  const leagueRevenueCents = revenueSeriesQuery.data
    ? revenueSeriesQuery.data.bySource.reduce(
        (total, source) =>
          source.sourceType === "league_membership" &&
          membershipIds.has(source.sourceId)
            ? total + source.totalCents
            : total,
        0
      )
    : 0;

  return (
    <View className="gap-3">
      {/* KPIs (IBX-0075 r2): os três blocos de número no KpiCard da galeria
          (ui/kpi-card), rótulo+valor idênticos ao texto-simples, emparelhados
          2 por linha na ordem ditada (Receita, Inscritos, Partidas no mês). */}
      <View className="flex-row gap-3">
        <KpiCard
          label="Receita da liga"
          value={formatCurrencyCents(leagueRevenueCents)}
        />
        <KpiCard
          label="Inscritos"
          value={
            maxPlayers === null
              ? String(activeCount)
              : `${activeCount}/${maxPlayers}`
          }
        />
      </View>

      <View className="flex-row gap-3">
        <KpiCard label="Partidas no mês" value={String(matchesThisMonth)} />
      </View>
    </View>
  );
}
