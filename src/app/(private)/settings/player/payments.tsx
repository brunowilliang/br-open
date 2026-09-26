import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";
import {
  formatPaymentStatus,
  getPaymentStatusColor,
} from "@/lib/payments/status";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Card, Chip, PressableFeedback } from "heroui-native";
import { View } from "react-native";

import type { PaymentChargeStatus } from "@convex/domains/payment/contract";

function formatPaymentDate(iso: null | string) {
  if (!iso) {
    return null;
  }
  return formatShortDate(new Date(iso));
}

type PaymentItem = {
  amountCents: number;
  chargeId: string;
  expiresAt: null | string;
  paidAt: null | string;
  sourceId: string;
  sourceLabel: null | string;
  status: PaymentChargeStatus;
};

function PaymentCard(props: {
  item: PaymentItem;
  onPress?: (item: PaymentItem) => void;
}) {
  const { item } = props;
  const dateLabel =
    formatPaymentDate(item.paidAt) ?? formatPaymentDate(item.expiresAt);
  return (
    <PressableFeedback
      animation={false}
      onPress={props.onPress ? () => props.onPress?.(item) : undefined}
    >
      <Card className="relative gap-2">
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 gap-1.5">
            <Text weight="medium">{item.sourceLabel ?? "Pagamento"}</Text>
            <View className="flex-row items-center gap-1">
              <Text color="muted" variant="description">
                {formatCurrencyCents(item.amountCents)}
              </Text>
              <Chip
                color={getPaymentStatusColor(item.status)}
                size="sm"
                variant="soft"
              >
                <Chip.Label>{formatPaymentStatus(item.status)}</Chip.Label>
              </Chip>
            </View>
          </View>
          {dateLabel ? (
            <Text color="muted" variant="description">
              {dateLabel}
            </Text>
          ) : null}
        </View>
        {props.onPress ? <PressableFeedback.Highlight /> : null}
      </Card>
    </PressableFeedback>
  );
}

export default function PlayerPaymentsSettings() {
  const crpc = useCRPC();
  const paymentsQuery = useQuery(
    crpc.payment.charge.listMine.staticQueryOptions()
  );

  const items = paymentsQuery.data?.items ?? [];
  const pending = items.filter((item) => item.status === "PENDING");
  const history = items.filter((item) => item.status !== "PENDING");
  const hasItems = items.length > 0;
  const isLoading = paymentsQuery.isPending;
  const isError = paymentsQuery.isError;
  const isEmpty = !(isLoading || isError || hasItems);

  function handleOpenCheckout(item: PaymentItem) {
    router.navigate({
      params: {
        chargeId: item.chargeId,
      },
      pathname: "/checkout/[chargeId]",
    });
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Meus pagamentos</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        <View className="gap-2">
          {isLoading && <LoadingState />}
          {isError && (
            <ErrorState
              error={paymentsQuery.error}
              message="Não foi possível carregar seus pagamentos."
            />
          )}
          {isEmpty && (
            <EmptyState
              description="Quando você se inscrever em um torneio pago, as cobranças aparecem aqui."
              icon={Wallet01Icon}
              title="Nenhum pagamento"
            />
          )}

          {hasItems && pending.length > 0 ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text color="muted" variant="description">
                  Pendentes
                </Text>
                <Chip color="warning" size="sm" variant="soft">
                  <Chip.Label>{pending.length}</Chip.Label>
                </Chip>
              </View>
              {pending.map((item) => (
                <PaymentCard
                  item={item}
                  key={item.chargeId}
                  onPress={handleOpenCheckout}
                />
              ))}
            </View>
          ) : null}

          {hasItems && history.length > 0 ? (
            <View className="gap-2">
              <Text color="muted" variant="description">
                Histórico
              </Text>
              {history.map((item) => (
                <PaymentCard item={item} key={item.chargeId} />
              ))}
            </View>
          ) : null}
        </View>
      </Page.ScrollView>
    </Page>
  );
}
