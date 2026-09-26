import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatRateAsPercent } from "@/lib/format/percent";
import { formatCount } from "@/lib/format/pluralize";
import { formatMinuteToHHMM } from "@/lib/format/time";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";
import type { ApiOutputs } from "@convex/shared/api";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

type PlayerDashboardOverview = ApiOutputs["player"]["dashboard"]["getOverview"];

/** "Partidas por mês" é o `MonthlyChartCard` (série real de 6 meses do dash);
 * desempenho e "Suas inscrições" no `KpiCard`, e as pendências vêm do SERVIDOR
 * (`pendings.list` escopo player).
 *
 * É só APRESENTAÇÃO do `data` que a HOME carrega: aqui moram as queries de BLOCO
 * (as pendências do `PendingAlerts`). */
export function PlayerDashboard(props: { data: PlayerDashboardOverview }) {
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
  const upcomingMatches = overview.upcomingMatches;

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

        {upcomingMatches.length > 0 ? (
          <View className="gap-2">
            <Text color="muted" variant="description" weight="medium">
              Próximos jogos
            </Text>
            {upcomingMatches.map((match) => {
              const sides = [
                match.partner ? `Parceiro: ${match.partner.fullName}` : null,
                ...match.opponents.map((opponent) => opponent.fullName),
              ].filter(Boolean);

              return (
                <Button
                  className="h-auto justify-start bg-surface-secondary py-3"
                  key={match.id}
                  onPress={() => {
                    router.navigate({
                      params: { tournamentId: match.competitionId },
                      pathname: "/tournaments/[tournamentId]",
                    });
                  }}
                  variant="secondary"
                >
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text numberOfLines={1} weight="medium">
                      {`${formatMatchMonthDay(match.matchDate)} · ${formatMinuteToHHMM(match.startMinute)} · ${match.competitionName}`}
                    </Text>
                    <Text color="muted" numberOfLines={1} variant="description">
                      {[match.categoryDisplayName, ...sides]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <HugeIcons icon={ArrowRight01Icon} />
                </Button>
              );
            })}
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
