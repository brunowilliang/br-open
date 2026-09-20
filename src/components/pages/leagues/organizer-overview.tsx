import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { buildOrganizerMonthlyMatchesSeries } from "@/lib/leagues/organizer-overview-derived";

/**
 * Casa da liga para o organizador em TEXTO SIMPLES (IBX-0071 plano de
 * conteúdo): receita da liga, inscritos e partidas no mês como linhas de
 * rótulo + valor. WidgetAlerts, TrendChip, KPI card e AreaChart saíram.
 * Receita soma `bySource` da série da organização (query existente)
 * filtrada pelos memberships DESTA liga no cliente — nenhuma query nova.
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
      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Receita da liga
        </Text>
        <Text weight="semibold">{formatCurrencyCents(leagueRevenueCents)}</Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Inscritos
        </Text>
        <Text weight="semibold">
          {maxPlayers === null
            ? String(activeCount)
            : `${activeCount}/${maxPlayers}`}
        </Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Partidas no mês
        </Text>
        <Text weight="semibold">{String(matchesThisMonth)}</Text>
      </View>
    </View>
  );
}
