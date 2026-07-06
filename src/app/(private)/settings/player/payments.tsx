import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Card, Chip, Description, PressableFeedback } from "heroui-native";
import { View } from "react-native";

import type { PaymentChargeStatus } from "@convex/domains/payment/contract";

const PAYMENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatPaymentStatus(status: PaymentChargeStatus) {
  switch (status) {
    case "PAID":
      return "Pago";
    case "PENDING":
      return "Pendente";
    case "EXPIRED":
      return "Expirado";
    case "REFUNDED":
      return "Reembolsado";
    default:
      return "Falhou";
  }
}

function getPaymentStatusColor(status: PaymentChargeStatus) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "EXPIRED":
    case "FAILED":
    case "REFUNDED":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatCurrency(valueCents: number) {
  return (valueCents / 100).toLocaleString("pt-BR", {
    currency: "BRL",
    style: "currency",
  });
}

function formatPaymentDate(iso: null | string) {
  if (!iso) {
    return null;
  }
  return PAYMENT_DATE_FORMATTER.format(new Date(iso));
}

type PaymentItem = {
  amountCents: number;
  chargeId: string;
  expiresAt: null | string;
  leagueId: string;
  leagueName: null | string;
  membershipId: string;
  paidAt: null | string;
  status: PaymentChargeStatus;
};

function PaymentCard(props: {
  item: PaymentItem;
  onPress?: (item: PaymentItem) => void;
}) {
  const { item } = props;
  const dateLabel =
    formatPaymentDate(item.paidAt) ?? formatPaymentDate(item.expiresAt);

  const content = (
    <Card className="flex-row items-start gap-3">
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text numberOfLines={1} variant="title">
            {item.leagueName ?? "Liga"}
          </Text>
          <Chip
            color={getPaymentStatusColor(item.status)}
            size="sm"
            variant="soft"
          >
            <Chip.Label>{formatPaymentStatus(item.status)}</Chip.Label>
          </Chip>
        </View>
        <Text weight="medium">{formatCurrency(item.amountCents)}</Text>
        {dateLabel ? (
          <Text color="muted" size="xs">
            {dateLabel}
          </Text>
        ) : null}
      </View>
      {props.onPress ? <PressableFeedback.Highlight /> : null}
    </Card>
  );

  // Pending charges open the checkout; historical (paid/expired/refunded)
  // charges are informational only — no tap target.
  if (!props.onPress) {
    return content;
  }

  return (
    <PressableFeedback animation={false} onPress={() => props.onPress?.(item)}>
      {content}
    </PressableFeedback>
  );
}

export default function PlayerPaymentsSettings() {
  const crpc = useCRPC();
  const paymentsQuery = useQuery(crpc.payment.charge.listMine.queryOptions());

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
        leagueId: item.leagueId,
        membershipId: item.membershipId,
      },
      pathname: "/leagues/[leagueId]/checkout",
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
              description="Quando você entrar em uma liga paga, suas cobranças aparecem aqui."
              icon={Wallet01Icon}
              title="Nenhum pagamento"
            />
          )}

          {hasItems && pending.length > 0 ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Description>Pendentes</Description>
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
              <Description>Histórico</Description>
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
