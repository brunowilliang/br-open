import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "@convex/domains/payment/contract";
import {
  Alert02Icon,
  Cancel01Icon,
  CopyIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { CheckoutStatusCard } from "@/components/ui/checkout-status-card";
import { CancelEntryDialog } from "@/components/ui/cancel-entry-dialog";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatPriceParts } from "@/lib/format/competition";
import { formatMsAsMMSS } from "@/lib/format/time";
import { createChargeOnce } from "@/lib/payments/charge-flight";
import { parseCheckoutRoute } from "@/lib/payments/checkout-route";
import {
  type CheckoutChargeView,
  resolveCheckoutDisplay,
  resolveCountdownRevalidation,
} from "@/lib/payments/checkout-view";
import { Button, Card, Chip, Skeleton, useToast } from "heroui-native";

const DANGER_THRESHOLD_MS = 300_000;

/** A criação falhou (não a cobrança): o cartão oferece tentar de novo. */
const CHARGE_CREATION_FAILED_CARD: CheckoutChargeView = {
  action: { kind: "new-charge", label: "Tentar novamente", variant: "primary" },
  description: "Nenhum código foi gerado e nada saiu da conta.",
  icon: Alert02Icon,
  severity: "danger",
  title: "Falha ao gerar PIX",
};

/** `/checkout/new` sem o source: link à mão, sem cobrança a resolver. */
const MISSING_SOURCE_CARD: CheckoutChargeView = {
  action: null,
  description:
    "Este link chegou incompleto. Abra o pagamento pelo torneio ou por Meus pagamentos.",
  icon: Unlink01Icon,
  severity: "danger",
  title: "Cobrança não encontrada",
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
  const {
    chargeId: rawChargeId,
    sourceId,
    sourceType,
  } = useLocalSearchParams<{
    chargeId?: string;
    sourceId?: string;
    sourceType?: string;
  }>();
  const route = parseCheckoutRoute({
    chargeId: rawChargeId,
    sourceId,
    sourceType,
  });
  // A cobrança resolvida vive em ESTADO da tela: trocar o param da rota aqui
  // (`replace`) re-montava o modal fullScreenModal — a tela saía e entrava de
  // novo antes do QR. O endereço real na URL não é preciso: quem depende de
  // deep link usa /checkout/<chargeId> (hub), que segue igual.
  const [resolvedChargeId, setResolvedChargeId] = useState<null | string>(null);
  const chargeId =
    route.kind === "charge" ? route.chargeId : (resolvedChargeId ?? "");
  const [createChargeFailed, setCreateChargeFailed] = useState(false);

  const checkoutQuery = useQuery({
    ...crpc.payment.charge.getCheckoutContext.staticQueryOptions({ chargeId }),
    enabled: chargeId !== "",
  });

  const invalidateCheckout = useCallback(async () => {
    await queryClient.invalidateQueries(
      crpc.payment.charge.getCheckoutContext.queryFilter({ chargeId })
    );
    await queryClient.invalidateQueries(
      crpc.payment.charge.listMine.queryFilter()
    );
  }, [chargeId, crpc, queryClient]);

  const createCharge = useMutation({
    // `createChargeOnce`: uma cobrança por inscrição mesmo com dois toques
    // durante o voo (o reuso do servidor só vê a PENDING após o saveCharge).
    mutationFn: (source: { sourceId: string; sourceType: string }) =>
      createChargeOnce(source, (input) =>
        crpcClient.payment.charge.createCharge.mutate(input)
      ),
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      setCreateChargeFailed(true);
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
      setCreateChargeFailed(false);

      // Sem cobrança pendente reaproveitável o servidor cria outra e a MESMA
      // tela passa a pintá-la; quando ele devolve a mesma charge, o invalidate
      // abaixo já atualiza o contexto em tela.
      setResolvedChargeId(result.chargeId);
      await invalidateCheckout();
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

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Cancelar pelo PIX usa a porta que já existe (`tournament.entries.cancel`),
  // que encerra a inscrição e mata a cobrança no mesmo ato.
  const cancelEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.cancel.mutate,
    mutationKey: crpc.tournament.entries.cancel.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar a inscrição. Tente novamente."
        ),
        id: "checkout-cancel-entry-error",
        label: "Falha ao cancelar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      setIsCancelDialogOpen(false);
      toast.show({
        description:
          "Inscrição cancelada. O PIX deixou de valer e a vaga voltou para a categoria.",
        id: "checkout-cancel-entry-success",
        label: "Inscrição cancelada",
        variant: "success",
      });
      // As listas da casa do torneio e das abas são assinaturas vivas; o hub e
      // as pendências entram por invalidação explícita.
      await queryClient.invalidateQueries(
        crpc.payment.charge.listMine.queryFilter()
      );
      await queryClient.invalidateQueries(
        crpc.pendings.list.list.queryFilter()
      );
      router.back();
    },
  });

  const checkout = checkoutQuery.data ?? null;

  // A cobrança VIGENTE manda na tela: a notificação antiga carrega o chargeId
  // de uma charge já terminal, e o PIX gerado depois vive em outra charge
  // PENDING do mesmo source. Sem pendente, a charge do link decide.
  const display = checkout
    ? resolveCheckoutDisplay({
        context: checkout,
        now: Date.now(),
      })
    : null;

  // A rota de criação não tem cobrança: ou está criando (skeleton), ou falhou
  // (cartão com retry), ou o link veio sem source. O cartão de falha fica só
  // aqui: no checkout de uma charge existente a falha continua só no toast.
  const missingSource = route.kind === "invalid";
  const creatingCard = missingSource
    ? MISSING_SOURCE_CARD
    : route.kind === "create" && createChargeFailed
      ? CHARGE_CREATION_FAILED_CARD
      : null;
  const isLoading =
    chargeId === ""
      ? creatingCard === null
      : checkoutQuery.isLoading && !checkout;

  const remainingMs = useCountdown(display?.charge.expiresAt ?? null);
  const card = creatingCard ?? display?.card ?? null;
  const charge = display?.charge ?? null;
  const amountCents = display?.charge.amountCents ?? 0;

  // Cancelar só existe com o PIX ATIVO de uma inscrição: no expirado a tela já
  // mostra o cartão terminal, cuja ação é gerar um PIX novo.
  const cancelEntryId =
    checkout?.sourceType === SOURCE_TYPE_TOURNAMENT_ENTRY &&
    display?.status === "PENDING"
      ? checkout.sourceId
      : null;

  // Countdown zerado com o PIX na tela: o aparelho pode estar adiantado e ter
  // zerado um PIX que o servidor considera vivo, então quem decide o próximo
  // estado é o servidor. UMA leitura por charge exibida (guard por id).
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

  // Toque em "inscrever e pagar"/Pagar: a navegação chega AQUI sem cobrança e
  // quem cria é esta tela, em paralelo com a transição (o POST à Woovi não
  // pode segurar o toque). O guard por source evita criar de novo no re-render.
  const requestedSourceRef = useRef<null | string>(null);
  const createChargeMutate = createCharge.mutate;
  const createSourceId = route.kind === "create" ? route.sourceId : null;
  const createSourceType = route.kind === "create" ? route.sourceType : null;

  useEffect(() => {
    if (!(createSourceId && createSourceType)) {
      return;
    }

    const key = `${createSourceType}:${createSourceId}`;
    if (requestedSourceRef.current === key) {
      return;
    }

    requestedSourceRef.current = key;
    createChargeMutate({
      sourceId: createSourceId,
      sourceType: createSourceType,
    });
  }, [createSourceId, createSourceType, createChargeMutate]);

  const priceParts = useMemo(
    () =>
      formatPriceParts({
        amountCents,
        billingInterval: "once",
      }),
    [amountCents]
  );

  // O resumo (valor + chip) existe também no loading: sem isso o bloco inteiro
  // nasce depois do QR e empurra a tela. No estado pronto o "Grátis" continua
  // escondendo o resumo.
  const showPriceSummary = isLoading || priceParts.amount !== "Grátis";

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

  function handleCreateCharge() {
    setCreateChargeFailed(false);

    if (createSourceId && createSourceType) {
      createChargeMutate({
        sourceId: createSourceId,
        sourceType: createSourceType,
      });
      return;
    }

    if (checkout) {
      createChargeMutate({
        sourceId: checkout.sourceId,
        sourceType: checkout.sourceType,
      });
    }
  }

  // Cancelar pelo próprio PIX: a inscrição é encerrada junto (a vaga volta),
  // então o aviso vem antes no diálogo. No layout de PIX ele entra NO FLUXO,
  // logo abaixo do aviso do banco (sem âncora de rodapé).
  // const cancelAction = cancelEntryId ? (
  //   <Button
  //     isDisabled={cancelEntry.isPending}
  //     onPress={() => setIsCancelDialogOpen(true)}
  //     variant="danger-soft"
  //   >
  //     <Button.Label>Cancelar inscrição</Button.Label>
  //   </Button>
  // ) : null;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Button
            isIconOnly
            onPress={() => router.back()}
            size="sm"
            variant="ghost"
          >
            <Page.Header.Icon icon={Cancel01Icon} />
          </Button>
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>Confirme a sua inscrição</Page.Header.SubTitle>
          <Skeleton className="h-6 w-35 rounded-xl" isLoading={isLoading}>
            <Page.Header.Title>
              {checkout?.sourceLabel ?? "Pagamento"}
            </Page.Header.Title>
          </Skeleton>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.View className="flex-1 gap-6 px-4">
        {/* Estado terminal da charge: o cartão fala do pagamento da inscrição,
            nunca promete PIX quando não há cobrança possível. */}
        {card ? (
          <View className="flex-1 items-center justify-center gap-3">
            <CheckoutStatusCard
              isActionDisabled={
                card.action?.kind === "new-charge" && createCharge.isPending
              }
              onAction={
                card.action?.kind === "back"
                  ? () => router.back()
                  : handleCreateCharge
              }
              view={card}
            />
          </View>
        ) : null}

        {/* PIX da cobrança VIGENTE (a PENDING do source quando existe, senão a do
            link); estados terminais caem no cartão acima, e no loading a mesma
            estrutura sai com skeletons, sem layout jump. */}
        {card ? null : (
          <>
            {/* Price summary */}
            {showPriceSummary ? (
              <View className="w-full items-center gap-1 pt-2">
                <Text color="muted">Valor da inscrição</Text>
                <Skeleton
                  className="h-10 w-40 rounded-xl"
                  isLoading={isLoading}
                >
                  <View className="h-10 flex-row items-baseline gap-1">
                    <Text size="2xl" weight="semibold">
                      {priceParts.amount}
                    </Text>
                  </View>
                </Skeleton>
                {/* Categoria da inscrição: mesmo molde de chip dos cards de
                    inscrição. O chip vem com `self-center` porque o root dele na
                    lib é `align-self: flex-start` (vence o `items-center` do pai)
                    e ele sairia do eixo central. Placeholder do tamanho real do
                    chip md (28 de altura) para o loading não empurrar a coluna. */}
                {isLoading ? (
                  <Skeleton className="h-7 w-24 rounded-2xl" />
                ) : checkout?.sourceCategory ? (
                  <Chip
                    className="self-center"
                    color="default"
                    size="md"
                    variant="soft"
                  >
                    <Chip.Label>{checkout.sourceCategory}</Chip.Label>
                  </Chip>
                ) : null}
              </View>
            ) : null}

            {/* QR Code */}
            <Skeleton
              className="size-56 self-center rounded-3xl"
              isLoading={isLoading}
            >
              <View className="size-56 items-center justify-center self-center rounded-3xl">
                {charge?.qrCodeUrl ? (
                  <Image
                    className="size-56 rounded-3xl"
                    fallback="none"
                    source={{
                      uri: charge.qrCodeUrl,
                    }}
                  />
                ) : null}
              </View>
            </Skeleton>

            {/* Countdown */}
            <View className="centered flex-row items-center gap-1">
              {isLoading ? (
                <Skeleton className="h-6 w-32 rounded-xl" />
              ) : (
                <>
                  <Text color="muted">Expira em</Text>
                  <Text
                    color={
                      remainingMs < DANGER_THRESHOLD_MS ? "danger" : undefined
                    }
                    weight="semibold"
                  >
                    {formatMsAsMMSS(remainingMs)}
                  </Text>
                </>
              )}
            </View>

            {/* Copia e cola */}
            <View className="w-full gap-3">
              <Text className="-mb-2 pl-2" weight="medium">
                Copia e cola
              </Text>
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
              <Skeleton
                className="h-12 w-full rounded-2xl"
                isLoading={isLoading}
              >
                <Button
                  isDisabled={cancelEntry.isPending}
                  onPress={() => setIsCancelDialogOpen(true)}
                  variant="danger-soft"
                >
                  <Button.Label>Cancelar inscrição</Button.Label>
                </Button>
              </Skeleton>
            </View>
          </>
        )}
      </Page.View>

      <Page.Footer className="px-4 pb-safe-offset-4">
        {/* Help text */}
        <Skeleton className="h-10 flex-1 rounded-2xl" isLoading={isLoading}>
          <Text align="center" className="px-2" color="muted" size="sm">
            Abra o app do seu banco e escaneie o QR code ou cole o código acima
            para pagar.
          </Text>
        </Skeleton>
      </Page.Footer>

      <CancelEntryDialog
        categoryLabel={checkout?.sourceCategory}
        isOpen={isCancelDialogOpen}
        isPending={cancelEntry.isPending}
        onClose={() => {
          setIsCancelDialogOpen(false);
        }}
        onConfirm={() => {
          if (cancelEntryId) {
            cancelEntry.mutate({ entryId: cancelEntryId });
          }
        }}
      />
    </Page>
  );
}
