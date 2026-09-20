import { formatCurrencyCents } from "@/lib/format/currency";
import { formatCount } from "@/lib/format/pluralize";
import { useWithdrawApi } from "@/lib/withdraw/api";
import { buildWithdrawBalanceCard } from "@/lib/withdraw/balance-card";
import type { ApiOutputs } from "@convex/shared/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Skeleton } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

/**
 * Home da organização em TEXTO SIMPLES (IBX-0071 plano de conteúdo): saldo
 * com ação de saque (bloco de ação existente) + recebido/previsto/atraso
 * como linhas de rótulo + valor nas classes tipográficas já usadas no app.
 * A série de receita por mês (`getRevenueSeries`) é renderizada em TEXTO na
 * home (index.tsx). ZERO charts no app até o componente de gráfico ser
 * aprovado; TrendChip, KPI cards e atividade recente saíram.
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
      <View className="centered gap-1 py-5">
        <Text color="muted" variant="description">
          Saldo disponível
        </Text>
        <View className="centered flex-row">
          {/* Molde do Skeleton: checkout [chargeId]/index.tsx:287-301
              (valor 3xl semibold com barra h-10 w-40 rounded-xl). */}
          <Skeleton
            className="h-10 w-35 rounded-xl"
            isLoading={balanceQuery.isPending}
          >
            <Text size="3xl" weight="bold">
              {balanceCard.value ?? "0,00"}
            </Text>
          </Skeleton>
        </View>
        <Button
          className="mt-1"
          onPress={() => {
            router.navigate("/withdraw");
          }}
          size="sm"
          variant="secondary"
        >
          Realizar Saque
        </Button>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Recebido este mês
        </Text>
        <Text weight="semibold">
          {formatCurrencyCents(metrics.receivedThisMonthCents)}
        </Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Previsto/mês
        </Text>
        <Text weight="semibold">
          {formatCurrencyCents(metrics.projectedMonthlyCents)}
        </Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Em atraso
        </Text>
        <Text weight="semibold">
          {formatCount(metrics.overdueCount, "cobrança", "cobranças")}
        </Text>
      </View>
    </View>
  );
}
