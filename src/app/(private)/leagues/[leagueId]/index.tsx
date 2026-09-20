import type { ApiOutputs } from "@convex/shared/api";
import {
  BookOpenCheckIcon,
  Calendar03Icon,
  Cancel01Icon,
  Edit02Icon,
  Location06Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, Dialog, Menu, useToast } from "heroui-native";
import { useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { usePageContext } from "@/components/core/page/context";
import { Text } from "@/components/core/text";
import { GuestOverview } from "@/components/pages/leagues/guest-overview";
import { OrganizerOverview } from "@/components/pages/leagues/organizer-overview";
import { PlayerOverview } from "@/components/pages/leagues/player-overview";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { JoinFooter } from "@/components/ui/join-footer";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  formatLeagueAvailabilityBadge,
  formatLeagueMeta,
  formatLeaguePriceParts,
  hasLeagueAvailableSpots,
} from "@/lib/leagues/presentation";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type ViewerMembershipStatus = LeagueOverview["viewerMembershipStatus"];

/** Toast de sucesso do requestJoin por status resultante (ex-LeagueJoinFooter). */
function getJoinSuccessToast(status: ViewerMembershipStatus): {
  description: string;
  label: string;
} {
  if (status === "active") {
    return {
      description: "Você já pode participar dos desafios desta liga.",
      label: "Inscrição confirmada",
    };
  }
  if (status === "awaiting_payment") {
    return {
      description: "Agora é só pagar o PIX para confirmar sua inscrição.",
      label: "Quase lá!",
    };
  }
  if (status === "payment_due") {
    return {
      description:
        "Sua inscrição está em atraso. Regularize para evitar suspensão.",
      label: "Pagamento em atraso",
    };
  }
  if (status === "suspended") {
    return {
      description: "Renove sua inscrição para voltar a participar da liga.",
      label: "Inscrição suspensa",
    };
  }
  return {
    description: "O organizador vai avaliar sua entrada. Você será notificado.",
    label: "Solicitação enviada",
  };
}

/** Rótulo do CTA do rodapé guest (ex-LeagueJoinFooter): derivada ou "Sem vagas". */
function getJoinFooterActionLabel(input: {
  hasAvailableSpots: boolean;
  isJoinRequestPending: boolean;
  joinActionLabel: string;
}) {
  if (input.hasAvailableSpots || input.isJoinRequestPending) {
    return input.joinActionLabel;
  }

  return "Sem vagas";
}

/**
 * Stretch banner. Reads the page scroll offset (a SharedValue
 * updated on the UI thread by PageKeyboardAwareScrollView) and reacts without
 * touching the JS thread.
 *
 * - Normal scroll up (scrollY >= 0): no transform applied — the banner
 *   scrolls away with the content, driven by the scrollview itself.
 * - Pull down at top / overscroll (scrollY < 0): scales up to 2x and
 *   translates up → "stretch to zoom" refresh effect.
 */
function LeagueBanner(props: { league: LeagueOverview }) {
  const { league } = props;
  const context = usePageContext();
  const bannerHeight = useSharedValue(0);
  const [overlayHeight, setOverlayHeight] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    bannerHeight.value = event.nativeEvent.layout.height;
  };

  const handleOverlayLayout = (event: LayoutChangeEvent) => {
    setOverlayHeight(event.nativeEvent.layout.height);
  };

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    const height = bannerHeight.value;

    if (height === 0) {
      return {};
    }

    const scrollY = context.scrollY.value;

    // Natural scroll: return identity so the banner follows the scrollview's
    // own movement. Any positive translateY here would push it back down and
    // let the content scroll over it.
    if (scrollY >= 0) {
      return {};
    }

    return {
      transform: [
        {
          translateY: interpolate(
            scrollY,
            [-height, 0],
            [-height / 2, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            scrollY,
            [-height, 0],
            [2, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <>
      <Animated.View
        className="h-90"
        onLayout={handleLayout}
        style={bannerAnimatedStyle}
      >
        <Image
          className="absolute h-full w-full"
          contentFit="cover"
          fallback="blue"
          source={league.coverUrl ?? undefined}
          transition={250}
        />
        <View className="absolute h-full w-full bg-linear-to-t from-0 from-background" />
      </Animated.View>

      <View
        className="flex-row items-center gap-2 px-4"
        onLayout={handleOverlayLayout}
        style={{ marginTop: -overlayHeight }}
      >
        <Image
          className="size-28 rounded-3xl border-2 border-white/80 bg-surface"
          fallback="green"
          source={league.avatarUrl ?? undefined}
        />
        <View className="flex-1 gap-1.5">
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>Liga</Chip.Label>
          </Chip>
          <Text numberOfLines={2} variant="title">
            {league.name}
          </Text>
          <Chip color="accent" size="sm" variant="soft">
            <HugeIcons className="size-3 text-accent" icon={Location06Icon} />
            <Chip.Label>
              {formatLeagueMeta(league.city, league.state)}
            </Chip.Label>
          </Chip>
        </View>
      </View>
    </>
  );
}

export default function LeagueOverviewRoute() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManageLeague = useValue(bucket$.derived.canManageLeague);
  const league = useValue(bucket$.data.league);
  const role = useValue(bucket$.viewer.role);

  // Rodapé guest (JoinFooter modo liga, cutover do LeagueJoinFooter): todo o
  // fluxo de entrada — join, cancelamento, pagamento — é wiring da página.
  const canRequestJoin = useValue(bucket$.derived.canRequestJoin);
  const canResumeCheckout = useValue(bucket$.derived.canResumeCheckout);
  const joinActionLabel = useValue(bucket$.derived.joinActionLabel);
  const membershipId = useValue(bucket$.viewer.membershipId);
  const membershipStatus = useValue(bucket$.viewer.membershipStatus);
  const pendingChargeQuery = useQuery({
    ...crpc.payment.charge.getPendingCharge.staticQueryOptions({
      sourceId: membershipId ?? "",
      sourceType: "league_membership",
    }),
    enabled:
      Boolean(membershipId) &&
      (membershipStatus === "awaiting_payment" ||
        membershipStatus === "payment_due" ||
        membershipStatus === "suspended"),
  });
  const pendingChargeId = pendingChargeQuery.data?.chargeId ?? null;
  const joinMutationIntentRef = useRef<"cancel" | "request">("request");
  const previousMembershipStatusRef = useRef<{
    membershipId: null | string;
    status: ViewerMembershipStatus;
  } | null>(null);
  const [isCancelRequestDialogOpen, setIsCancelRequestDialogOpen] =
    useState(false);

  async function invalidateLeagueContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listForLeague.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
      ),
    ]);
  }

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível gerar o código de pagamento. Tente novamente."
        ),
        id: "create-charge-error",
        label: "Falha ao gerar PIX",
        variant: "danger",
      });
    },
    onSuccess: (result) => {
      router.navigate({
        params: { chargeId: result.chargeId },
        pathname: "/checkout/[chargeId]",
      });
    },
  });

  function handlePayPress() {
    if (!membershipId) {
      return;
    }
    // Caminho rápido: charge pendente válida já existe — navega direto (sem
    // round-trip do provider; mesma velocidade de "meus pagamentos").
    if (pendingChargeId) {
      router.navigate({
        params: { chargeId: pendingChargeId },
        pathname: "/checkout/[chargeId]",
      });
      return;
    }
    // Caminho lento: cria a charge e navega.
    createCharge.mutate({
      sourceId: membershipId,
      sourceType: "league_membership",
    });
  }

  const requestJoin = useMutation({
    mutationFn: crpcClient.league.membership.requestJoin.mutate,
    mutationKey: crpc.league.membership.requestJoin.mutationKey(),
    onError: (error) => {
      const intent = joinMutationIntentRef.current;
      joinMutationIntentRef.current = "request";
      const previousMembershipStatus = previousMembershipStatusRef.current;
      previousMembershipStatusRef.current = null;
      const isCancelAction = intent === "cancel";

      if (previousMembershipStatus) {
        bucket$.actions.setViewerMembership({
          membershipId: previousMembershipStatus.membershipId,
          status: previousMembershipStatus.status,
        });
      }

      toast.show({
        description: getToastErrorMessage(
          error,
          isCancelAction
            ? "Não foi possível cancelar sua solicitação. Tente novamente."
            : "Não foi possível enviar sua solicitação. Tente novamente."
        ),
        id: isCancelAction ? "cancel-join-request-error" : "request-join-error",
        label: isCancelAction
          ? "Falha ao cancelar"
          : "Falha ao solicitar entrada",
        variant: "danger",
      });
    },
    onSuccess: async (membership) => {
      const intent = joinMutationIntentRef.current;
      joinMutationIntentRef.current = "request";
      previousMembershipStatusRef.current = null;

      if (intent === "cancel") {
        bucket$.actions.setViewerMembership({
          membershipId: membership.status === "left" ? null : membership.id,
          status: membership.status,
        });

        setIsCancelRequestDialogOpen(false);

        toast.show({
          description: "Você pode solicitar entrada novamente quando quiser.",
          id: "cancel-join-request-success",
          label: "Solicitação cancelada",
          variant: "success",
        });

        await invalidateLeagueContext();
        return;
      }

      bucket$.actions.setViewerMembership({
        membershipId: membership.id,
        status: membership.status,
      });

      const joinToast = getJoinSuccessToast(membership.status);
      toast.show({
        description: joinToast.description,
        id: "request-join-success",
        label: joinToast.label,
        variant: "success",
      });

      await invalidateLeagueContext();

      // Ligas pagas vão direto pro checkout após o request (createCharge tem
      // early-return pra charge PENDING existente).
      if (membership.status === "awaiting_payment") {
        createCharge.mutate({
          sourceId: membership.id,
          sourceType: "league_membership",
        });
      }
    },
  });

  function mutateJoinRequest(intent: "cancel" | "request") {
    joinMutationIntentRef.current = intent;
    previousMembershipStatusRef.current = {
      membershipId,
      status: membershipStatus,
    };
    let optimisticStatus: ViewerMembershipStatus;
    if (intent === "cancel") {
      optimisticStatus = "left";
    } else {
      // Ligas pagas vão direto pro checkout (o gate de aprovação, se houver,
      // vem DEPOIS do pagamento no fluxo manual). Ligas grátis ficam na fila.
      const isPaidLeague = (league?.monthlyPriceCents ?? 0) > 0;
      optimisticStatus = isPaidLeague ? "awaiting_payment" : "pending";
    }
    bucket$.actions.setViewerMembership({
      // Mantém o membershipId existente nos updates otimistas; o id real é
      // reconciliado quando a mutation resolve.
      membershipId,
      status: optimisticStatus,
    });
    requestJoin.mutate({ leagueId });
  }

  const isJoinRequestPending =
    membershipStatus === "pending" || membershipStatus === "awaiting_payment";
  const isFooterActionPending =
    requestJoin.isPending ||
    createCharge.isPending ||
    pendingChargeQuery.isLoading;
  const isResumeCheckoutPath = canResumeCheckout && Boolean(membershipId);

  const isError = bootstrapStatus === "error";
  const isLoading = !league;
  const showStatusState = isError || isLoading;
  const canOpenLeagueMenu =
    access.canOpenRules || access.canOpenSchedule || canManageLeague;

  // Valores do rodapé guest (só existem com league carregada).
  const hasAvailableSpots = league
    ? hasLeagueAvailableSpots({
        activePlayerCount: league.activePlayerCount,
        maxPlayers: league.maxPlayers,
      })
    : false;
  const guestFooter = league
    ? {
        actionLabel: getJoinFooterActionLabel({
          hasAvailableSpots,
          isJoinRequestPending,
          joinActionLabel,
        }),
        availabilityLabel: formatLeagueAvailabilityBadge({
          activePlayerCount: league.activePlayerCount,
          maxPlayers: league.maxPlayers,
        }),
        price: formatLeaguePriceParts({
          amountCents: league.monthlyPriceCents,
          billingInterval: league.priceBillingInterval,
        }),
      }
    : null;

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton variant="secondary" />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right>
          {league && canOpenLeagueMenu ? (
            <Menu>
              <Menu.Trigger asChild>
                <Button isIconOnly size="sm" variant="secondary">
                  <HugeIcons icon={MoreVerticalIcon} />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Overlay className="bg-backdrop" />
                <Menu.Content presentation="popover" width={240}>
                  {access.canOpenRules ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/rules",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Regras</Menu.ItemTitle>
                      <HugeIcons icon={BookOpenCheckIcon} />
                    </Menu.Item>
                  ) : null}
                  {access.canOpenSchedule ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/schedule",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Agenda</Menu.ItemTitle>
                      <HugeIcons icon={Calendar03Icon} />
                    </Menu.Item>
                  ) : null}
                  {canManageLeague ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId, mode: "edit" },
                          pathname: "/settings/leagues/[mode]",
                        });
                      }}
                    >
                      <Menu.ItemTitle>Editar</Menu.ItemTitle>
                      <HugeIcons icon={Edit02Icon} />
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu>
          ) : null}
        </Page.Header.Right>
      </Page.Header>
      <Page.ScrollView
        contentContainerClassName={cn(
          "grow",
          showStatusState && "centered gap-4 px-4"
        )}
      >
        {isError && <ErrorState message="Não foi possível carregar a liga." />}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && league && (
          <>
            <LeagueBanner league={league} />
            <View className="gap-4 px-4 pt-4 pb-floating-tab-bar-4">
              {role === "organizer" && <OrganizerOverview />}
              {role === "player" && <PlayerOverview league={league} />}
              {role === "guest" && <GuestOverview league={league} />}
            </View>
          </>
        )}
      </Page.ScrollView>

      {role === "guest" && guestFooter && !showStatusState ? (
        <JoinFooter
          actionLabel={guestFooter.actionLabel}
          actionTrailing={
            isJoinRequestPending ? (
              <Button
                isDisabled={requestJoin.isPending}
                isIconOnly
                onPress={() => {
                  setIsCancelRequestDialogOpen(true);
                }}
                size="sm"
                variant="danger-soft"
              >
                <HugeIcons className="text-danger" icon={Cancel01Icon} />
              </Button>
            ) : null
          }
          availabilityLabel={guestFooter.availabilityLabel}
          isActionDisabled={
            isResumeCheckoutPath
              ? false
              : !(canRequestJoin && hasAvailableSpots)
          }
          isActionPending={isFooterActionPending}
          onAction={() => {
            if (isResumeCheckoutPath) {
              handlePayPress();
              return;
            }
            mutateJoinRequest("request");
          }}
          price={guestFooter.price}
          title="Preço"
        />
      ) : null}

      <Dialog
        isOpen={isCancelRequestDialogOpen}
        onOpenChange={(nextOpen) => {
          if (requestJoin.isPending) {
            return;
          }

          setIsCancelRequestDialogOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            {requestJoin.isPending ? null : (
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Cancelar solicitação</Dialog.Title>
            <Text color="muted" variant="description">
              Você poderá solicitar entrada nessa liga novamente depois.
            </Text>

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={requestJoin.isPending}
                onPress={() => {
                  setIsCancelRequestDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={requestJoin.isPending}
                onPress={() => {
                  mutateJoinRequest("cancel");
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Cancelar solicitação</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}
