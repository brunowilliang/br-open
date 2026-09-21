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
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

/**
 * Home da organização: saldo, recebido, previsto/mês e em atraso no KpiCard
 * da galeria (IBX-0075 r2), com o botão de saque no slot de ação do card do
 * saldo; rótulo e valor do molde texto-simples. A série de receita por mês
 * (`getRevenueSeries`) é o `MonthlyChartCard` na home (index.tsx, IBX-0078).
 */
export function OrganizerDashboard(props: { data: DashboardOverview }) {
  const router = useRouter();
  const crpc = useCRPC();
  const { metrics } = props.data;
  const { getBalanceQueryOptions } = useWithdrawApi();
  const pendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "organization" })
  );
  const balanceQuery = useQuery(getBalanceQueryOptions());
  const balanceCard = buildWithdrawBalanceCard({
    balance: balanceQuery.data,
    isError: balanceQuery.isError,
    isPending: balanceQuery.isPending && balanceQuery.data === undefined,
  });

  return (
    <View className="gap-3">
      {/* Bloco 1 (IBX-0076 / PLN-0008): as pendências vêm do SERVIDOR
          (`pendings.list` do escopo organization, ordenado por severidade →
          prazo) e o renderer único monta os alertas. Era o GAP declarado da
          home da organização. */}
      <PendingAlerts
        isError={pendingsQuery.isError}
        isLoading={pendingsQuery.isPending}
        items={pendingsQuery.data?.items ?? []}
      />

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
