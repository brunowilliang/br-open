import { formatCurrencyCents } from "@/lib/format/currency";
import { formatCount } from "@/lib/format/pluralize";
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

/**
 * Home da organização: saldo, recebido, previsto/mês e em atraso no KpiCard
 * da galeria (IBX-0075 r2), com o botão de saque no slot de ação do card do
 * saldo; rótulo e valor do molde texto-simples. A série de receita por mês
 * (`getRevenueSeries`) é o `MonthlyChartCard` DESTE painel (IBX-0078; morava
 * solta em `(tabs)/index.tsx` e desceu pra cá no IBX-0081, junto da query). O
 * "Total da janela", que ficava em texto logo abaixo do painel, foi REMOVIDO a
 * pedido do usuário (21-09-2026, decisão direta no chat) — o chart fica igual.
 */
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

      {/* KPIs (IBX-0075 r2): todo bloco de número é o KpiCard da galeria
          (ui/kpi-card.tsx), rótulo+valor idênticos ao texto-simples, com o
          botão de saque no slot de ação do card. */}
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

        <View className="flex-row gap-3">
          <KpiCard
            label="Recebido este mês"
            value={formatCurrencyCents(metrics.receivedThisMonthCents)}
          />
          <KpiCard
            label="Previsto/mês"
            value={formatCurrencyCents(metrics.projectedMonthlyCents)}
          />
        </View>

        <KpiCard
          label="Em atraso"
          value={formatCount(metrics.overdueCount, "cobrança", "cobranças")}
        />

        {/* Bloco do chart (IBX-0078; desceu pra cá no IBX-0081): a MESMA série de
          `getRevenueSeries` que o texto mostrava (mês + centavos recebidos,
          `receivedCents`), no `MonthlyChartCard` aprovado na galeria; o balão do
          crosshair mostra o mesmo valor formatado pelo `formatCurrencyCents` de
          antes. É bloco do painel como os outros — a query mora aqui e o chart
          não aparece quando o painel está em loading/erro/vazio. */}
        {revenueSeriesQuery.data ? (
          <MonthlyChartCard
            data={revenueSeriesQuery.data.series.map((point) => ({
              label: formatDashboardMonthLabel(point.month),
              value: point.receivedCents,
            }))}
            description="Total de receita por mês nos últimos 6 meses."
            /* Eixo em REAIS, sem centavos (BUG-0055): o valor da série é em
               centavos, então o rótulo do eixo sai pelo MESMO
               `formatCurrencyCents` com `whole` (formato curto do repo) — os
               ticks lidos de hoje ("1000 / 800 / 600 / 400 / 200 / 0", centavos
               crus) viram "R$ 10 / R$ 8 / R$ 6 / R$ 4 / R$ 2 / R$ 0". */
            formatAxis={(cents) => formatCurrencyCents(cents, { whole: true })}
            formatValue={formatCurrencyCents}
            title="Receita por mês"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
