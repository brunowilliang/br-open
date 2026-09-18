import { Cancel01Icon, CopyIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatMsAsMMSS } from "@/lib/format/time";
import { formatLeaguePriceParts } from "@/lib/leagues/presentation";
import {
  type CheckoutChargeView,
  resolveCheckoutDisplay,
  resolveCountdownRevalidation,
} from "@/lib/payments/checkout-view";
import { Button, Card, Label, Skeleton, useToast } from "heroui-native";

const DANGER_THRESHOLD_MS = 300_000;

/** Fundo do cartão de estado, no padrão dos cartões que já existiam aqui. */
const CARD_BACKGROUND: Record<CheckoutChargeView["severity"], string> = {
  danger: "bg-danger-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
};

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
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { chargeId } = useLocalSearchParams<{
    chargeId: string;
  }>();

  const checkoutQuery = useQuery(
    crpc.payment.charge.getCheckoutContext.staticQueryOptions({ chargeId })
  );
  // `canRegenerate` de "meus pagamentos" é o sinal de cobrabilidade da
  // membership (`canMembershipBeCharged` no servidor) — é o mesmo sinal que o
  // menu "Gerar novo Pix" de settings/player/payments.tsx usa.
  const paymentsQuery = useQuery(
    crpc.payment.charge.listMine.staticQueryOptions()
  );

  const invalidateCheckout = useCallback(async () => {
    await queryClient.invalidateQueries(
      crpc.payment.charge.getCheckoutContext.queryFilter({ chargeId })
    );
    await queryClient.invalidateQueries(
      crpc.payment.charge.listMine.queryFilter()
    );
  }, [chargeId, crpc, queryClient]);

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
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
    onSuccess: async (result) => {
      await invalidateCheckout();

      // Sem cobrança pendente reaproveitável o servidor cria outra, e a tela
      // segue para ela; quando ele devolve a mesma charge, o invalidate
      // acima já atualiza o contexto em tela.
      if (result.chargeId !== chargeId) {
        router.replace({
          params: { chargeId: result.chargeId },
          pathname: "/checkout/[chargeId]",
        });
      }
    },
  });

  const simulatePayment = useMutation({
    mutationFn: crpcClient.payment.charge.simulatePayment.mutate,
    mutationKey: crpc.payment.charge.simulatePayment.mutationKey(),
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
  });

  const checkout = checkoutQuery.data ?? null;
  const isLoading = checkoutQuery.isLoading && !checkout;

  // O item de "meus pagamentos" da charge do link dá o `paidAt` do cartão e
  // cobre o fallback quando a resposta em cache ainda não traz `canRenew`.
  const chargeItem = paymentsQuery.data?.items.find(
    (item) => item.chargeId === chargeId
  );

  // A cobrança VIGENTE manda na tela: a notificação antiga carrega o chargeId
  // de uma charge já terminal, e o PIX que o jogador gerou depois vive em
  // outra charge PENDING do mesmo source (BUG-0025). Sem pendente, a charge do
  // link decide como antes. Nada aqui cria ou reaproveita cobrança.
  const display = checkout
    ? resolveCheckoutDisplay({
        context: checkout,
        now: Date.now(),
        paymentItem: chargeItem,
      })
    : null;

  const remainingMs = useCountdown(display?.charge.expiresAt ?? null);
  const card = display?.card ?? null;
  const charge = display?.charge ?? null;
  const amountCents = display?.charge.amountCents ?? 0;

  // Countdown zerado com o PIX na tela: o aparelho pode estar adiantado e ter
  // zerado um PIX que o servidor considera VIVO, então quem decide o próximo
  // estado é o servidor. UMA leitura por charge exibida (guard por id), sem
  // loop: se o servidor devolver a mesma pendente, a tela segue com ela.
  const revalidatedChargeIdRef = useRef<null | string>(null);

  useEffect(() => {
    const revalidation = resolveCountdownRevalidation({
      displayedChargeId: card ? null : (charge?.chargeId ?? null),
      remainingMs,
      revalidatedChargeId: revalidatedChargeIdRef.current,
    });

    if (!revalidation.shouldRefetch) {
      return;
    }

    revalidatedChargeIdRef.current = revalidation.chargeId;
    invalidateCheckout();
  }, [card, charge?.chargeId, invalidateCheckout, remainingMs]);

  const priceParts = useMemo(
    () =>
      formatLeaguePriceParts({
        amountCents,
        billingInterval: "month",
      }),
    [amountCents]
  );

  async function copyBrCode() {
    const brCode = display?.charge.brCode;
    if (!brCode) {
      return;
    }
    await Clipboard.setStringAsync(brCode);
    toast.show({
      description: "Cole no app do seu banco para concluir o pagamento.",
      id: "copy-brcode",
      label: "Código PIX copiado",
      variant: "success",
    });
  }

  function handleGenerateNewCharge() {
    if (!checkout) {
      return;
    }

    createCharge.mutate({
      sourceId: checkout.sourceId,
      sourceType: checkout.sourceType,
    });
  }

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
        {/* Estado terminal da charge, dirigido pelo estado ATUAL da membership:
            com cobrança possível (atraso, suspensão ou janela de renovação) a
            tela pede o PIX novo em vez de afirmar um pagamento (BUG-0024). */}
        {card ? (
          <View className="flex-1 items-center justify-center gap-3">
            <View
              className={`w-full gap-3 rounded-2xl p-8 ${
                CARD_BACKGROUND[card.severity]
              }`}
            >
              <Text
                className="text-center"
                color={card.severity}
                size="lg"
                weight="semibold"
              >
                {card.title}
              </Text>
              <Text className="text-center" color="muted">
                {card.description}
              </Text>
            </View>
            {card.actionLabel ? (
              <Button
                isDisabled={createCharge.isPending}
                onPress={handleGenerateNewCharge}
              >
                <Button.Label>{card.actionLabel}</Button.Label>
              </Button>
            ) : null}
          </View>
        ) : null}

        {/* Layout de PIX da cobrança VIGENTE (e durante o loading): a charge
            PENDING do source quando ela existe, senão a charge do link.
            Estados terminais caem no cartão acima, então aqui nunca aparece
            QR/"Expira em 00:00" de cobrança que não vale mais.
            While loading, the same structure is rendered with skeletons
            wrapping each element, so there is no layout jump when data
            arrives. */}
        {card ? null : (
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
                {charge?.qrCodeUrl ? (
                  <Image
                    className="size-64 rounded-3xl"
                    fallback="none"
                    source={{
                      uri: charge.qrCodeUrl,
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
                    {charge?.brCode ?? ""}
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
                      onPress={() =>
                        simulatePayment.mutate({
                          chargeId: charge?.chargeId ?? chargeId,
                        })
                      }
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
