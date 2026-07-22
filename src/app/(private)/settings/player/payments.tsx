import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatCurrencyCents } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";
import {
  formatPaymentStatus,
  getPaymentStatusColor,
} from "@/lib/payments/status";
import { MoreVerticalIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  Menu,
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
    <Card className="relative gap-1">
      {showGenerateNew ? (
        <View className="absolute top-2 right-2 z-10">
          <Menu>
            <Menu.Trigger asChild>
              <Button
                className="size-7"
                isDisabled={props.isGenerating}
                isIconOnly
                size="sm"
                variant="tertiary"
              >
                <HugeIcons className="size-4.5" icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay className="bg-backdrop" />
              <Menu.Content presentation="popover">
                <Menu.Item onPress={() => props.onGenerateNew?.(item)}>
                  <Menu.ItemTitle className="flex-none">
                    Gerar novo Pix
                  </Menu.ItemTitle>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </View>
      ) : null}
      <Chip color={getPaymentStatusColor(item.status)} size="sm" variant="soft">
        <Chip.Label>{formatPaymentStatus(item.status)}</Chip.Label>
      </Chip>
      <Text numberOfLines={1} weight="semibold">
        {item.sourceLabel ?? "Pagamento"}
      </Text>
      <View className="flex-row items-center justify-between">
        <Text weight="semibold">{formatCurrencyCents(item.amountCents)}</Text>
        {dateLabel ? (
          <Text color="muted" variant="description">
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
  const { toast } = useToast();
  const paymentsQuery = useQuery(crpc.payment.charge.listMine.queryOptions());

  const [generatingSourceId, setGeneratingSourceId] = useState<null | string>(
    null
  );

  const createCharge = useMutation(
    crpc.payment.charge.createCharge.mutationOptions({
      onError: (error) => {
        setGeneratingSourceId(null);
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível gerar um novo código PIX. Tente novamente."
          ),
          id: "generate-new-charge-error",
          label: "Falha ao gerar PIX",
          variant: "danger",
        });
      },
      onSuccess: async (data) => {
        setGeneratingSourceId(null);
        await paymentsQuery.refetch();
        router.navigate({
          params: { chargeId: data.chargeId },
          pathname: "/checkout/[chargeId]",
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
