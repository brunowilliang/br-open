import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlyMatchesCard } from "@/components/ui/monthly-matches-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatRateAsPercent } from "@/lib/format/percent";
import { formatMinuteToHHMM } from "@/lib/format/time";
import { formatCount } from "@/lib/format/pluralize";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

/**
 * Home do jogador (IBX-0075): "Partidas por mês" é o chart aprovado na
 * galeria (`MonthlyMatchesCard`, série real de 6 meses do dash); o desempenho
 * em três cards ("Vitórias", "Derrotas" e "Aproveitamento") e "Suas
 * inscrições" seguem no KpiCard. "Próximos jogos" continua como está (lista
 * com navegação pra competição) e as pendências/alertas seguem GAP de dado.
 */
export function PlayerDashboard() {
  const crpc = useCRPC();
  const router = useRouter();
  const overviewQuery = useQuery(
    crpc.player.dashboard.getOverview.staticQueryOptions({ months: 6 })
  );
  const pendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "player" })
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
  // Série do bloco "Partidas por mês" (IBX-0075 r4): os MESMOS números que o
  // texto do KpiCard já mostrava (`wins + losses` por mês), agora no shape do
  // chart aprovado na galeria.
  const monthlyMatches = resultsByMonth.map((month) => ({
    label: month.label,
    matches: month.wins + month.losses,
  }));
  const entriesTotal = overview.entryCategories.reduce(
    (total, category) => total + category.entryCount,
    0
  );

  return (
    <View className="gap-3">
      {/* Bloco 1 (IBX-0076 / PLN-0008): as pendências vêm do SERVIDOR
          (`pendings.list` do escopo player, ordenado por severidade → prazo) e
          o renderer único monta os alertas. Era o GAP declarado da home. */}
      <PendingAlerts
        isError={pendingsQuery.isError}
        isLoading={pendingsQuery.isPending}
        items={pendingsQuery.data?.items ?? []}
      />

      {/* Bloco 2 (ordem do usuário): o chart aprovado na galeria, com a série
          real de 6 meses do dash. O antigo KpiCard de texto saiu (IBX-0075 r4). */}
      <MonthlyMatchesCard data={monthlyMatches} />

      {/* Desempenho = três KPIs numa ÚNICA linha (IBX-0075 r2, ordem do
          usuário), labels literais do pedido. O "%" fica no VALOR: o rótulo
          é "Aproveitamento" (ordem literal do usuário). */}
      <View className="flex-row gap-3">
        <KpiCard label="Vitórias" value={String(performance.wins)} />
        <KpiCard label="Derrotas" value={String(performance.losses)} />
        <KpiCard
          label="Aproveitamento"
          value={formatRateAsPercent(performance.winRate)}
        />
      </View>

      <View className="flex-row gap-3">
        <KpiCard
          label="Suas inscrições"
          value={formatCount(entriesTotal, "inscrição", "inscrições")}
        />
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
