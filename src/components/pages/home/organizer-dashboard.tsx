import type { ApiOutputs } from "@convex/shared/api";
import { formatCurrencyCents, formatTrendPercent } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { PAYMENT_STATUS_META } from "@/lib/payments/status";
import { Description } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  Clock02Icon,
  Dollar01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { Card, Chip } from "heroui-native";

type DashboardOverview = ApiOutputs["payment"]["dashboard"]["getOverview"];

function KpiCard(props: {
  icon: React.ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  tint?: "danger" | "default" | "warning";
  value: string;
}) {
  return (
    <Card className="flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <HugeIcons
          className={`size-4 ${props.tint === "danger" ? "text-danger" : "text-muted"}`}
          icon={props.icon}
        />
        <Description className="flex-1" numberOfLines={1}>
          {props.label}
        </Description>
      </View>
      <Text
        color={props.tint === "danger" ? "danger" : undefined}
        size="xl"
        weight="semibold"
      >
        {props.value}
      </Text>
    </Card>
  );
}

export function OrganizerDashboard(props: { data: DashboardOverview }) {
  const { metrics, recentCharges } = props.data;

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
      {/* Hero KPI */}
      <Card className="gap-2">
        <Description>Recebido este mês</Description>
        <Text size="3xl" weight="semibold">
          {formatCurrencyCents(metrics.receivedThisMonthCents, { whole: true })}
        </Text>
        {trend ? (
          <View className="absolute top-4 right-4 flex-row items-center gap-1">
            <HugeIcons
              className={`size-3.5 ${trendIsPositive ? "text-success" : "text-danger"}`}
              icon={trendIsPositive ? ArrowUp01Icon : ArrowDown01Icon}
            />
            <Text color={trendIsPositive ? "success" : "danger"} size="xs">
              {trend}
            </Text>
          </View>
        ) : null}
        <Description>
          Você recebe automaticamente via PIX em cada pagamento.
        </Description>
      </Card>

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
          value={formatCurrencyCents(metrics.projectedMonthlyCents, {
            whole: true,
          })}
        />
      </View>
      <View className="flex-row gap-2">
        <KpiCard
          icon={Wallet01Icon}
          label="Pagamentos no mês"
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
                <View className="flex-col items-end gap-1">
                  <Chip color={cfg.color} size="sm" variant="soft">
                    {cfg.label}
                  </Chip>
                  <Text size="sm" weight="medium">
                    {formatCurrencyCents(charge.amountCents, { whole: true })}
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
