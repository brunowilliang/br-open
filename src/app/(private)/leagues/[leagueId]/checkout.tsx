import { Cancel01Icon, CopyIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Label, useToast } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatLeaguePriceParts } from "@/lib/leagues/presentation";

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

function formatCountdown(ms: number) {
  if (ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { leagueId, membershipId } = useLocalSearchParams<{
    leagueId: string;
    membershipId: string;
  }>();

  // Tracks the membershipId we've already attempted to charge in this mount,
  // so a transient createCharge error doesn't re-fire forever (the effect
  // below keys off this, not off success). Reset only by the explicit
  // "Gerar novo PIX" button on the expired state.
  const [hasCreatedCharge, setHasCreatedCharge] = useState(false);
  const [attemptedMembershipId, setAttemptedMembershipId] = useState<
    string | null
  >(null);

  const leagueQuery = useQuery(
    crpc.league.discovery.getById.queryOptions({ leagueId })
  );

  // Existing charge is reactive — Convex pushes the PAID transition over the
  // WebSocket as soon as the webhook fires, so no polling is needed.
  const chargeQuery = useQuery({
    ...crpc.payment.charge.getChargeForMembership.queryOptions({
      membershipId,
    }),
    enabled: Boolean(membershipId),
  });

  async function invalidateCheckout() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.payment.charge.getChargeForMembership.queryFilter({ membershipId })
      ),
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
    ]);
  }

  const createCharge = useMutation(
    crpc.payment.charge.createCharge.mutationOptions({
      onSuccess: async () => {
        setHasCreatedCharge(true);
        await invalidateCheckout();
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível gerar o PIX."
          ),
          id: "create-charge-error",
          label: "Erro ao gerar cobrança",
          variant: "danger",
        });
      },
    })
  );

  // Create a charge if none exists yet and the membership is awaiting payment.
  // We gate on `attemptedMembershipId` (not just success) so a failed
  // createCharge doesn't loop forever — it only retries via the explicit
  // "Gerar novo PIX" button, which resets the attempt tracker.
  const charge = chargeQuery.data ?? null;
  const needsNewCharge = !(
    charge ||
    createCharge.isPending ||
    hasCreatedCharge ||
    attemptedMembershipId === membershipId
  );

  useEffect(() => {
    if (!(needsNewCharge && leagueId && membershipId)) {
      return;
    }
    setAttemptedMembershipId(membershipId);
    createCharge.mutate({ leagueId, membershipId });
  }, [needsNewCharge, leagueId, membershipId, createCharge]);

  // Payment confirmation comes from the membership status (active), not the
  // charge row. The charge query only returns the current PENDING PIX; a PAID
  // charge from a previous cycle (e.g. player was removed and re-requested)
  // must not be treated as "paid" for the new request.
  const isPaid = leagueQuery.data?.viewerMembershipStatus === "active";
  const remainingMs = useCountdown(charge?.expiresAt ?? null);
  const isExpired = Boolean(charge) && remainingMs <= 0;
  const isLoading =
    createCharge.isPending || (chargeQuery.isLoading && !charge);

  // Navigate back to the league once payment is confirmed. The success state
  // is rendered below (no toast — the screen itself communicates it).
  // useEffect(() => {
  //   if (!isPaid) {
  //     return;
  //   }
  //   const timeout = setTimeout(() => {
  //     router.replace({
  //       params: { leagueId },
  //       pathname: "/leagues/[leagueId]",
  //     });
  //   }, 2500);
  //   return () => clearTimeout(timeout);
  // }, [isPaid, router, leagueId]);

  const priceParts = useMemo(() => {
    const cents = leagueQuery.data?.monthlyPriceCents ?? 0;
    const interval = leagueQuery.data?.priceBillingInterval ?? "month";
    return formatLeaguePriceParts({
      amountCents: cents,
      billingInterval: interval,
    });
  }, [leagueQuery.data]);

  async function copyBrCode() {
    if (!charge?.brCode) {
      return;
    }
    await Clipboard.setStringAsync(charge.brCode);
    toast.show({
      description: "Código PIX copiado para a área de transferência.",
      id: "copy-brcode",
      label: "Código copiado",
      variant: "success",
    });
  }

  // Resolve the current view state as a simple string so the JSX below can
  // branch without nested ternaries (which the linter rejects).
  let viewState: "expired" | "idle" | "loading" | "paid" | "pending";
  if (isLoading) {
    viewState = "loading";
  } else if (isPaid) {
    viewState = "paid";
  } else if (isExpired) {
    viewState = "expired";
  } else if (charge) {
    viewState = "pending";
  } else {
    viewState = "idle";
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left />
        <Page.Header.Center>
          <Page.Header.Title>Pagamento</Page.Header.Title>
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
        {/* Price summary */}
        {priceParts.amount === "Grátis" ? null : (
          <View className="w-full items-center gap-1 pt-2">
            <Text color="muted" size="sm">
              Valor da inscrição
            </Text>
            <View className="flex-row items-baseline gap-1">
              <Text size="3xl" weight="semibold">
                {priceParts.amount}
              </Text>
              {priceParts.suffix ? (
                <Text color="muted" size="sm">
                  {priceParts.suffix}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {viewState === "loading" ? (
          /* Loading state */
          <View className="flex-1 items-center justify-center gap-2">
            <Text color="muted">Gerando cobrança PIX…</Text>
          </View>
        ) : null}

        {viewState === "paid" ? (
          /* Paid state */
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

        {viewState === "expired" ? (
          /* Expired state */
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
            <Button
              onPress={() => {
                setHasCreatedCharge(false);
                setAttemptedMembershipId(null);
                createCharge.mutate({ leagueId, membershipId });
              }}
              variant="secondary"
            >
              <Button.Label>Gerar novo PIX</Button.Label>
            </Button>
          </View>
        ) : null}

        {viewState === "pending" && charge ? (
          /* Pending — show QR + copia e cola + countdown */
          <>
            {/* Countdown */}
            <View className="w-full items-center">
              <Text color="muted" size="sm">
                Expira em
              </Text>
              <Text
                color={remainingMs < DANGER_THRESHOLD_MS ? "danger" : undefined}
                weight="semibold"
              >
                {formatCountdown(remainingMs)}
              </Text>
            </View>

            {/* QR Code */}
            {charge.brCodeBase64 ? (
              <Image
                className="size-64 self-center rounded-3xl"
                fallback="none"
                source={{
                  uri: charge.brCodeBase64,
                }}
              />
            ) : null}

            {/* Copia e cola */}
            <View className="w-full gap-3">
              <Label className="-mb-2 pl-2">Copia e cola</Label>
              <Card>
                <Text numberOfLines={2} size="sm">
                  {charge.brCode}
                </Text>
              </Card>
              <Button onPress={copyBrCode} variant="tertiary">
                <Button.Label>Copiar código PIX</Button.Label>
                <HugeIcons className="size-4.5" icon={CopyIcon} />
              </Button>
            </View>

            {/* Help text */}
            <Text className="px-2 text-center" color="muted" size="sm">
              Abra o app do seu banco e escaneie o QR code ou cole o código
              acima para pagar.
            </Text>
          </>
        ) : null}
      </Page.View>
    </Page>
  );
}
