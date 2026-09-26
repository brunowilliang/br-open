import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { PressableFeedback } from "heroui-native";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { Text } from "@/components/core/text";
import { KpiCard } from "@/components/ui/kpi-card";
import { MatchCard } from "@/components/ui/match-card";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";
import { formatRateAsPercent } from "@/lib/format/percent";
import { formatCount } from "@/lib/format/pluralize";
import {
  buildPlayerResultsChart,
  buildUpcomingMatchItems,
  type PlayerDashboardViewer,
} from "@/lib/home/player-dashboard-view";
import type { ApiOutputs } from "@convex/shared/api";

type PlayerDashboardOverview = ApiOutputs["player"]["dashboard"]["getOverview"];

/** "Partidas por mês" é o `MonthlyChartCard` (série real de 6 meses do dash);
 * desempenho e "Suas inscrições" no `KpiCard`, e as pendências vêm do SERVIDOR
 * (`pendings.list` escopo player).
 *
 * É só APRESENTAÇÃO do `data` que a HOME carrega: aqui moram as queries de BLOCO
 * (as pendências do `PendingAlerts`). */
export function PlayerDashboard(props: {
  data: PlayerDashboardOverview;
  viewer: PlayerDashboardViewer;
}) {
  const crpc = useCRPC();
  const router = useRouter();
  const pendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({
      scope: "player",
      surface: "home",
    })
  );

  const overview = props.data;
  const performance = overview.performance;
  const resultsByMonth = buildPlayerResultsChart(performance.byMonth);
  // Os MESMOS números do KpiCard de texto (`wins + losses` por mês), agora no
  // shape do chart.
  const monthlyMatches = resultsByMonth.map((month) => ({
    label: month.label,
    value: month.wins + month.losses,
  }));
  const entriesTotal = overview.entryCategories.reduce(
    (total, category) => total + category.entryCount,
    0
  );
  const upcomingMatchItems = buildUpcomingMatchItems({
    matches: overview.upcomingMatches,
    viewer: props.viewer,
  });

  return (
    <Animated.View
      className="gap-3"
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
    >
      <PendingAlerts
        dismissSurface="home"
        isError={pendingsQuery.isError}
        isLoading={pendingsQuery.isPending}
        isSwipeEnabled
        items={pendingsQuery.data?.items ?? []}
        swipeClassNames={{
          action: "pr-4 -ml-1",
          childrenContainer: "mx-4",
          container: "-mx-4",
        }}
      />

      {/* Série real de 6 meses do dash no `MonthlyChartCard`. */}
      <Animated.View
        className="gap-3"
        entering={FadeIn}
        exiting={FadeOut}
        layout={LinearTransition}
      >
        <MonthlyChartCard
          data={monthlyMatches}
          description="Total de partidas por mês nos últimos 6 meses."
          title="Partidas por mês"
        />

        {/* Os três KPIs numa ÚNICA linha: o "%" fica no VALOR. */}
        <View className="flex-row gap-3">
          <KpiCard label="Vitórias" value={String(performance.wins)} />
          <KpiCard label="Derrotas" value={String(performance.losses)} />
          <KpiCard
            label="Aproveitamento"
            value={formatRateAsPercent(performance.winRate)}
          />
        </View>

        <KpiCard
          label="Suas inscrições"
          value={formatCount(entriesTotal, "inscrição", "inscrições")}
        />

        {upcomingMatchItems.length > 0 ? (
          <View className="gap-2">
            <Text color="muted" variant="description" weight="medium">
              Próximos jogos
            </Text>
            <View className="gap-2">
              {upcomingMatchItems.map((item) => (
                <PressableFeedback
                  key={item.id}
                  onPress={() => {
                    router.navigate({
                      params: { tournamentId: item.competitionId },
                      pathname: "/tournaments/[tournamentId]",
                    });
                  }}
                >
                  {/* Card e ordem de props do "Próximo jogo" da casa do torneio
                      (`pages/tournaments/player-overview.tsx`). */}
                  <MatchCard
                    challengedAvatarUrl={item.sideBAvatarUrl}
                    challengedName={item.sideBName}
                    challengedPartnerAvatarUrl={item.sideBPartnerAvatarUrl}
                    challengedPartnerName={item.sideBPartnerName}
                    challengerAvatarUrl={item.sideAAvatarUrl}
                    challengerName={item.sideAName}
                    challengerPartnerAvatarUrl={item.sideAPartnerAvatarUrl}
                    challengerPartnerName={item.sideAPartnerName}
                    courtName={item.courtName}
                    matchDate={item.matchDate}
                    matchStatus={item.matchStatus}
                    stageLabel={item.stageLabel}
                    startMinute={item.startMinute}
                  />
                </PressableFeedback>
              ))}
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
