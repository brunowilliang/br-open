import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatCurrencyCents } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";
import {
  getPaymentStatusColor,
  formatPaymentStatus,
} from "@/lib/payments/status";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  PressableFeedback,
  useToast,
} from "heroui-native";
import { useState } from "react";
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
  sourceType: string;
  status: PaymentChargeStatus;
};

function PaymentCard(props: {
  item: PaymentItem;
  onPress?: (item: PaymentItem) => void;
  onGenerateNew?: (item: PaymentItem) => void;
  isGenerating?: boolean;
}) {
  const { item } = props;
  const dateLabel =
    formatPaymentDate(item.paidAt) ?? formatPaymentDate(item.expiresAt);
  const showGenerateNew = item.status === "EXPIRED" && props.onGenerateNew;

  const content = (
    <Card className="flex-row items-start gap-3">
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text numberOfLines={1} variant="title">
            {item.sourceLabel ?? "Pagamento"}
          </Text>
          <Chip
            color={getPaymentStatusColor(item.status)}
            size="sm"
            variant="soft"
          >
            <Chip.Label>{formatPaymentStatus(item.status)}</Chip.Label>
          </Chip>
        </View>
        <Text weight="medium">{formatCurrencyCents(item.amountCents)}</Text>
        {dateLabel ? (
          <Text color="muted" size="xs">
            {dateLabel}
          </Text>
        ) : null}
        {showGenerateNew ? (
          <Button
            className="mt-1 self-start"
            isDisabled={props.isGenerating}
            onPress={() => props.onGenerateNew?.(item)}
            size="sm"
            variant="tertiary"
          >
            <Button.Label>Gerar novo PIX</Button.Label>
          </Button>
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
  const { toast } = useToast();
  const paymentsQuery = useQuery(crpc.payment.charge.listMine.queryOptions());

  const [generatingSourceId, setGeneratingSourceId] = useState<null | string>(
    null
  );

  const createCharge = useMutation(
    crpc.payment.charge.createCharge.mutationOptions({
      onSuccess: async (data) => {
        setGeneratingSourceId(null);
        await paymentsQuery.refetch();
        router.navigate({
          params: { chargeId: data.chargeId },
          pathname: "/checkout/[chargeId]",
        });
      },
      onError: (error) => {
        setGeneratingSourceId(null);
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível gerar o PIX."
          ),
          id: "generate-new-charge-error",
          label: "Erro ao gerar PIX",
          variant: "danger",
        });
      },
    })
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

  function handleGenerateNew(item: PaymentItem) {
    setGeneratingSourceId(item.sourceId);
    createCharge.mutate({
      sourceId: item.sourceId,
      sourceType: item.sourceType,
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
                <PaymentCard
                  isGenerating={
                    createCharge.isPending &&
                    generatingSourceId === item.sourceId
                  }
                  item={item}
                  key={item.chargeId}
                  onGenerateNew={handleGenerateNew}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Page.ScrollView>
    </Page>
  );
}
