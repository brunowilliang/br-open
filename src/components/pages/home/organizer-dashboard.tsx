import { formatCurrencyCents } from "@/lib/format/currency";
import { formatCount } from "@/lib/format/pluralize";
import { useWithdrawApi } from "@/lib/withdraw/api";
import { buildWithdrawBalanceCard } from "@/lib/withdraw/balance-card";
import type { ApiOutputs } from "@convex/shared/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";

import { KpiCard } from "@/components/ui/kpi-card";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

/**
 * Home da organização: saldo, recebido, previsto/mês e em atraso no KpiCard
 * da galeria (IBX-0075 r2), com o botão de saque no slot de ação do card do
 * saldo; rótulo e valor do molde texto-simples. A série de receita por mês
 * (`getRevenueSeries`) segue em TEXTO na home (index.tsx) e os gráficos
 * continuam fora.
 */
export function OrganizerDashboard(props: { data: DashboardOverview }) {
  const router = useRouter();
  const { metrics } = props.data;
  const { getBalanceQueryOptions } = useWithdrawApi();
  const balanceQuery = useQuery(getBalanceQueryOptions());
  const balanceCard = buildWithdrawBalanceCard({
    balance: balanceQuery.data,
    isError: balanceQuery.isError,
    isPending: balanceQuery.isPending && balanceQuery.data === undefined,
  });

  return (
    <View className="gap-3">
      {/* KPIs (IBX-0075 r2): todo bloco de número é o KpiCard da galeria
          (ui/kpi-card.tsx), rótulo+valor idênticos ao texto-simples, com o
          botão de saque no slot de ação do card. */}
      <View className="flex-row gap-3">
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
      </View>

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

      <View className="flex-row gap-3">
        <KpiCard
          label="Em atraso"
          value={formatCount(metrics.overdueCount, "cobrança", "cobranças")}
        />
      </View>
    </View>
  );
}
