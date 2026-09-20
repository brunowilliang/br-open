import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";
import { formatCount } from "@/lib/format/pluralize";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

/**
 * Home do jogador em TEXTO SIMPLES (IBX-0071 plano de conteúdo): os widgets
 * de KPI e os gráficos saíram; cada linha é rótulo + valor nas classes
 * tipográficas já usadas no app. Componente de KPI/gráfico só volta após
 * definição e aprovação um a um (processo na spec do domínio).
 */
export function PlayerDashboard() {
  const crpc = useCRPC();
  const router = useRouter();
  const overviewQuery = useQuery(
    crpc.player.dashboard.getOverview.staticQueryOptions({ months: 6 })
  );

  if (overviewQuery.isPending) {
    return <LoadingState />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        error={overviewQuery.error}
        message="Não foi possível carregar seu painel."
      />
    );
  }

  const overview = overviewQuery.data;
  const performance = overview.performance;
  const resultsByMonth = buildPlayerResultsChart(performance.byMonth);
  const monthlyText =
    resultsByMonth.length > 0
      ? resultsByMonth
          .map((month) => `${month.label} ${month.wins + month.losses}`)
          .join(" · ")
      : "0";
  const entriesTotal = overview.entryCategories.reduce(
    (total, category) => total + category.entryCount,
    0
  );

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Partidas por mês
        </Text>
        <Text weight="semibold">{monthlyText}</Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Desempenho
        </Text>
        <Text weight="semibold">{`${performance.wins}V · ${performance.losses}D`}</Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Suas inscrições
        </Text>
        <Text weight="semibold">
          {formatCount(entriesTotal, "inscrição", "inscrições")}
        </Text>
      </View>

      {overview.upcomingMatches.length > 0 ? (
        <View className="gap-2">
          <Text color="muted" variant="description" weight="medium">
            Próximos jogos
          </Text>
          {overview.upcomingMatches.map((match) => {
            const isLeague = match.kind === "league_challenge";
            const sides = [
              match.partner ? `Parceiro: ${match.partner.fullName}` : null,
              ...match.opponents.map((opponent) => opponent.fullName),
            ].filter(Boolean);

            return (
              <Button
                className="h-auto justify-start bg-surface-secondary py-3"
                key={match.id}
                onPress={() => {
                  if (isLeague) {
                    router.navigate({
                      params: { leagueId: match.competitionId },
                      pathname: "/leagues/[leagueId]",
                    });
                    return;
                  }

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
    </View>
  );
}
