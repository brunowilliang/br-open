import { formatCurrencyCents, formatTrendPercent } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { PAYMENT_STATUS_META } from "@/lib/payments/status";
import { useWithdrawApi } from "@/lib/withdraw/api";
import { buildWithdrawBalanceCard } from "@/lib/withdraw/balance-card";
import type { ApiOutputs } from "@convex/shared/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Description } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  Clock02Icon,
  Dollar01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

export function OrganizerDashboard(props: { data: DashboardOverview }) {
  const router = useRouter();
  const { metrics, recentCharges } = props.data;
  const { getBalanceQueryOptions } = useWithdrawApi();
  const balanceQuery = useQuery(getBalanceQueryOptions());
  const balanceCard = buildWithdrawBalanceCard({
    balance: balanceQuery.data,
    isError: balanceQuery.isError,
    isPending: balanceQuery.isPending && balanceQuery.data === undefined,
  });

  const trend = useMemo(
    () =>
      formatTrendPercent(
        metrics.receivedThisMonthCents,
        metrics.receivedLastMonthCents
      ),
    [metrics.receivedThisMonthCents, metrics.receivedLastMonthCents]
  );

  const trendIsPositive = useMemo(
    () => metrics.receivedThisMonthCents >= metrics.receivedLastMonthCents,
    [metrics.receivedThisMonthCents, metrics.receivedLastMonthCents]
  );

  return (
    <View className="gap-3">
      {/* Saldo + saque */}
      {/* <KpiCard
        action={
          <Button
            onPress={() => {
              router.navigate("/withdraw");
            }}
            size="sm"
          >
            Sacar
          </Button>
        }
        icon={Wallet01Icon}
        label="Saldo disponível"
        size="md"
        {...balanceCard}
      /> */}

      <View className="centered py-4">
        <Text>Saldo disponível</Text>
        <View className="centered flex-row">
          <Text size="3xl" weight="semibold">
            {balanceCard.value ?? "0,00"}
          </Text>
          {/* <Button isIconOnly size="sm" variant="ghost">
            <HugeIcons
              className="size-5 text-muted"
              icon={InformationCircleIcon}
            />
          </Button> */}
        </View>
        <View className="flex-row gap-2 pt-3">
          <Button
            onPress={() => {
              router.navigate("/withdraw");
            }}
            size="sm"
            variant="secondary"
          >
            Realizar Saque
          </Button>
        </View>
      </View>

      {/* Hero KPI */}
      <KpiCard
        action={
          trend ? (
            <View className="flex-row items-center gap-1">
              <HugeIcons
                className={`size-3.5 ${trendIsPositive ? "text-success" : "text-danger"}`}
                icon={trendIsPositive ? ArrowUp01Icon : ArrowDown01Icon}
              />
              <Text color={trendIsPositive ? "success" : "danger"} size="xs">
                {trend}
              </Text>
            </View>
          ) : undefined
        }
        description="Total líquido recebido no mês (após taxas)."
        label="Recebido este mês"
        size="lg"
        value={formatCurrencyCents(metrics.receivedThisMonthCents)}
      />

      {/* KPI Grid 2×2 */}
      <View className="flex-row gap-2">
        <KpiCard
          icon={CheckmarkCircle02Icon}
          label="Assinaturas"
          value={String(metrics.activeSubscribers)}
        />
        <KpiCard
          icon={Dollar01Icon}
          label="Previsto/mês"
          value={formatCurrencyCents(metrics.projectedMonthlyCents)}
        />
      </View>
      <View className="flex-row gap-2">
        <KpiCard
          icon={Wallet01Icon}
          label="Pagtos/mês"
          value={String(metrics.paymentsThisMonth)}
        />
        <KpiCard
          icon={Clock02Icon}
          label="Em atraso"
          tint={metrics.overdueCount > 0 ? "danger" : "default"}
          value={String(metrics.overdueCount)}
        />
      </View>

      {/* Recent Activity */}
      {recentCharges.length > 0 ? (
        <View className="mt-2 gap-2">
          <Description className="px-2">Atividade recente</Description>
          {recentCharges.map((charge) => {
            const cfg =
              PAYMENT_STATUS_META[charge.status] ??
              PAYMENT_STATUS_META.PENDING!;
            // const feeCents = charge.amountCents - charge.organizerCents;
            return (
              <Card
                className="flex-row items-center justify-between gap-2"
                key={charge.chargeId}
              >
                <View className="flex-1 gap-0.5">
                  <Text numberOfLines={1} size="sm" weight="medium">
                    {charge.playerName ?? "—"}
                  </Text>
                  <Description numberOfLines={1}>
                    {charge.sourceLabel ? `${charge.sourceLabel} · ` : ""}
                    {formatRelativeTime(charge.createdAt)}
                  </Description>
                </View>
                <View className="flex-col gap-0.5">
                  <Chip
                    className="self-end"
                    color={cfg.color}
                    size="sm"
                    variant="soft"
                  >
                    {cfg.label}
                  </Chip>
                  <Text size="sm" weight="medium">
                    {formatCurrencyCents(charge.amountCents)}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
