import { Cancel01Icon, CopyIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatMsAsMMSS } from "@/lib/format/time";
import { formatLeaguePriceParts } from "@/lib/leagues/presentation";
import { Button, Card, Label, Skeleton, useToast } from "heroui-native";

const DANGER_THRESHOLD_MS = 300_000;

function useCountdown(expiresAt: string | null) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!expiresAt) {
      return 0;
    }
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  });

  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      setRemainingMs(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remainingMs;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { chargeId } = useLocalSearchParams<{
    chargeId: string;
  }>();

  const checkoutQuery = useQuery(
    crpc.payment.charge.getCheckoutContext.queryOptions({ chargeId })
  );

  async function invalidateCheckout() {
    await queryClient.invalidateQueries(
      crpc.payment.charge.getCheckoutContext.queryFilter({ chargeId })
    );
    await queryClient.invalidateQueries(
      crpc.payment.charge.listMine.queryFilter()
    );
  }

  const simulatePayment = useMutation(
    crpc.payment.charge.simulatePayment.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível simular o pagamento. Tente novamente."
          ),
          id: "simulate-payment-error",
          label: "Simulação falhou",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateCheckout();
      },
    })
  );

  const checkout = checkoutQuery.data ?? null;
  const remainingMs = useCountdown(checkout?.expiresAt ?? null);
  const isLoading = checkoutQuery.isLoading && !checkout;
  const isExpired =
    Boolean(checkout) && checkout?.status !== "PAID" && remainingMs <= 0;

  const priceParts = useMemo(() => {
    const cents = checkout?.amountCents ?? 0;
    return formatLeaguePriceParts({
      amountCents: cents,
      billingInterval: "month",
    });
  }, [checkout]);

  async function copyBrCode() {
    if (!checkout?.brCode) {
      return;
    }
    await Clipboard.setStringAsync(checkout.brCode);
    toast.show({
      description: "Cole no app do seu banco para concluir o pagamento.",
      id: "copy-brcode",
      label: "Código PIX copiado",
      variant: "success",
    });
  }

  // Resolve the current view state. While loading we still render the pending
  // layout with skeletons wrapping each element (Skeleton isLoading), so the
  // transition into the loaded state preserves shape/position.
  const isPaid = checkout?.status === "PAID";
  const isPendingExpired = isExpired || checkout?.status === "EXPIRED";

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left />
        <Page.Header.Center>
          <Skeleton className="h-6 w-35 rounded-xl" isLoading={isLoading}>
            <Page.Header.Title>
              {checkout?.sourceLabel ?? "Pagamento"}
            </Page.Header.Title>
          </Skeleton>
          <Page.Header.SubTitle>Confirme a sua inscrição</Page.Header.SubTitle>
        </Page.Header.Center>
        <Page.Header.Right>
          <Button
            isIconOnly
            onPress={() => router.back()}
            size="sm"
            variant="ghost"
          >
            <Page.Header.Icon icon={Cancel01Icon} />
          </Button>
        </Page.Header.Right>
      </Page.Header>

      <Page.View className="flex-1 gap-6 px-4">
        {/* Paid state */}
        {isPaid ? (
          <View className="flex-1 items-center justify-center gap-3">
            <View className="w-full gap-3 rounded-2xl bg-success-soft p-8">
              <Text
                className="text-center"
                color="success"
                size="lg"
                weight="semibold"
              >
                Pagamento confirmado!
              </Text>
              <Text className="text-center" color="muted">
                Confirmamos o seu pagamento. Você já pode acessar a liga e
                começar a jogar!
              </Text>
            </View>
          </View>
        ) : null}

        {/* Expired state */}
        {isPendingExpired ? (
          <View className="flex-1 items-center justify-center gap-4">
            <View className="w-full gap-3 rounded-2xl bg-warning-soft p-8">
              <Text
                className="text-center"
                color="warning"
                size="lg"
                weight="semibold"
              >
                PIX expirado
              </Text>
              <Text className="text-center" color="muted">
                O tempo para pagamento esgotou. Gere um novo PIX para continuar.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Pending / loading layout.
            While loading, the same structure is rendered with skeletons
            wrapping each element, so there is no layout jump when data
            arrives. */}
        {isPaid || isPendingExpired ? null : (
          <>
            {/* Price summary */}
            {priceParts.amount === "Grátis" ? null : (
              <View className="w-full items-center gap-1 pt-2">
                <Text color="muted" size="sm">
                  Valor da inscrição
                </Text>
                <Skeleton
                  className="h-10 w-40 rounded-xl"
                  isLoading={isLoading}
                >
                  <View className="h-10 flex-row items-baseline gap-1">
                    <Text size="3xl" weight="semibold">
                      {priceParts.amount}
                    </Text>
                    {priceParts.suffix ? (
                      <Text color="muted" size="sm">
                        {priceParts.suffix}
                      </Text>
                    ) : null}
                  </View>
                </Skeleton>
              </View>
            )}

            {/* Countdown */}
            <View className="w-full items-center gap-1">
              <Text color="muted" size="sm">
                Expira em
              </Text>
              <Skeleton className="h-6 w-20 rounded-xl" isLoading={isLoading}>
                <Text
                  color={
                    remainingMs < DANGER_THRESHOLD_MS ? "danger" : undefined
                  }
                  weight="semibold"
                >
                  {formatMsAsMMSS(remainingMs)}
                </Text>
              </Skeleton>
            </View>

            {/* QR Code */}
            <Skeleton
              className="size-64 self-center rounded-3xl"
              isLoading={isLoading}
            >
              <View className="size-64 items-center justify-center self-center rounded-3xl">
                {checkout?.qrCodeUrl ? (
                  <Image
                    className="size-64 rounded-3xl"
                    fallback="none"
                    source={{
                      uri: checkout.qrCodeUrl,
                    }}
                  />
                ) : null}
              </View>
            </Skeleton>

            {/* Copia e cola */}
            <View className="w-full gap-3">
              <Label className="-mb-2 pl-2">Copia e cola</Label>
              <Skeleton
                className="h-18 w-full rounded-3xl"
                isLoading={isLoading}
              >
                <Card>
                  <Text numberOfLines={2} size="sm">
                    {checkout?.brCode ?? ""}
                  </Text>
                </Card>
              </Skeleton>
              <Skeleton
                className="h-12 w-full rounded-2xl"
                isLoading={isLoading}
              >
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    onPress={copyBrCode}
                    variant="tertiary"
                  >
                    <Button.Label>Copiar código PIX</Button.Label>
                    <HugeIcons className="size-4.5" icon={CopyIcon} />
                  </Button>
                  {/* DEV ONLY: __DEV__ is false on release builds (including the
                      dev profile on TestFlight), so we gate on EXPO_PUBLIC_IS_DEV
                      which is set for the development EAS env. */}
                  {process.env.EXPO_PUBLIC_IS_DEV === "true" ? (
                    <Button
                      className="flex-1"
                      isDisabled={simulatePayment.isPending}
                      onPress={() => simulatePayment.mutate({ chargeId })}
                      variant="secondary"
                    >
                      <Button.Label>
                        {simulatePayment.isPending
                          ? "Simulando..."
                          : "Simular pagamento"}
                      </Button.Label>
                    </Button>
                  ) : null}
                </View>
              </Skeleton>
            </View>

            {/* Help text */}
            <Skeleton className="mx-6 h-10 rounded-md" isLoading={isLoading}>
              <Text className="px-2 text-center" color="muted" size="sm">
                Abra o app do seu banco e escaneie o QR code ou cole o código
                acima para pagar.
              </Text>
            </Skeleton>
          </>
        )}
      </Page.View>
    </Page>
  );
}
