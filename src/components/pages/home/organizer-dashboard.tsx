import { formatCurrencyCents } from "@/lib/format/currency";
import { formatDashboardMonthLabel } from "@/lib/home/player-dashboard-view";
import { useWithdrawApi } from "@/lib/withdraw/api";
import { buildWithdrawBalanceCard } from "@/lib/withdraw/balance-card";
import type { ApiOutputs } from "@convex/shared/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

/** Saldo (com o saque no slot de ação), recebido, previsto/mês e em atraso em
 * `KpiCard`, e a série de receita por mês (`getRevenueSeries`, query DESTE
 * painel) no `MonthlyChartCard`. */
export function OrganizerDashboard(props: { data: DashboardOverview }) {
  const router = useRouter();
  const crpc = useCRPC();
  const { metrics } = props.data;
  const { getBalanceQueryOptions } = useWithdrawApi();
  const pendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({
      scope: "organization",
      surface: "home",
    })
  );
  const revenueSeriesQuery = useQuery(
    crpc.payment.dashboard.getRevenueSeries.staticQueryOptions({ months: 6 })
  );
  const balanceQuery = useQuery(getBalanceQueryOptions());
  const balanceCard = buildWithdrawBalanceCard({
    balance: balanceQuery.data,
    isError: balanceQuery.isError,
    isPending: balanceQuery.isPending && balanceQuery.data === undefined,
  });

  return (
    <View className="gap-3">
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

      {/* Todo bloco de número é o KpiCard da galeria (ui/kpi-card.tsx), com o
          botão de saque no slot de ação do card do saldo. */}
      <Animated.View
        className="gap-3"
        entering={FadeIn}
        exiting={FadeOut}
        layout={LinearTransition}
      >
        <KpiCard
          action={
            <Button
              onPress={() => {
                router.navigate("/withdraw");
              }}
              size="sm"
              variant="secondary"
            >
              Realizar Saque
            </Button>
          }
          isLoading={balanceQuery.isPending}
          label="Saldo disponível"
          value={balanceCard.value ?? "0,00"}
        />

        <KpiCard
          label="Recebido este mês"
          value={formatCurrencyCents(metrics.receivedThisMonthCents)}
        />

        {/* A MESMA série de `getRevenueSeries` que o texto mostrava
          (`receivedCents`), no `MonthlyChartCard`: a query mora aqui e o bloco
          some em loading/erro/vazio. */}
        {revenueSeriesQuery.data ? (
          <MonthlyChartCard
            data={revenueSeriesQuery.data.series.map((point) => ({
              label: formatDashboardMonthLabel(point.month),
              value: point.receivedCents,
            }))}
            description="Total de receita por mês nos últimos 6 meses."
            /* Eixo em REAIS, sem centavos: o valor da série é em centavos, então o
               rótulo sai pelo MESMO `formatCurrencyCents` com `whole` (formato
               curto do repo) — "1000" vira "R$ 10". */
            formatAxis={(cents) => formatCurrencyCents(cents, { whole: true })}
            formatValue={formatCurrencyCents}
            title="Receita por mês"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
