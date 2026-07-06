import type { ApiOutputs } from "@convex/shared/api";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  Description,
  Dialog,
  useToast,
} from "heroui-native";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  formatLeagueAvailabilityBadge,
  formatLeaguePriceParts,
  hasLeagueAvailableSpots,
} from "@/lib/leagues/presentation";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type ViewerMembershipStatus = LeagueOverview["viewerMembershipStatus"];

function getJoinSuccessToast(status: ViewerMembershipStatus): {
  description: string;
  label: string;
} {
  if (status === "active") {
    return {
      description: "Você entrou como jogador na liga.",
      label: "Entrada confirmada",
    };
  }
  if (status === "awaiting_payment") {
    return {
      description: "Você será redirecionado para o pagamento via PIX.",
      label: "Quase lá!",
    };
  }
  return {
    description: "Solicitação enviada para aprovação.",
    label: "Solicitação enviada",
  };
}

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

export function LeagueJoinFooter(props: { leagueId: string }) {
  const { leagueId } = props;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const canRequestJoin = useValue(bucket$.derived.canRequestJoin);
  const canResumeCheckout = useValue(bucket$.derived.canResumeCheckout);
  const league = useValue(bucket$.data.league);
  const membershipId = useValue(bucket$.viewer.membershipId);
  const membershipStatus = useValue(bucket$.viewer.membershipStatus);
  const joinActionLabel = useValue(bucket$.derived.joinActionLabel);
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

  const requestJoin = useMutation(
    crpc.league.membership.requestJoin.mutationOptions({
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
            description: "Sua solicitação foi cancelada.",
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

        // Paid leagues route straight to checkout after requesting to join.
        if (membership.status === "awaiting_payment") {
          router.navigate({
            params: { leagueId, membershipId: membership.id },
            pathname: "/leagues/[leagueId]/checkout",
          });
        }
      },
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
              ? "Não foi possível cancelar a solicitação."
              : "Não foi possível solicitar entrada."
          ),
          id: isCancelAction
            ? "cancel-join-request-error"
            : "request-join-error",
          label: isCancelAction
            ? "Erro ao cancelar"
            : "Erro ao solicitar entrada",
          variant: "danger",
        });
      },
    })
  );

  if (!league) {
    return null;
  }

  const isJoinRequestPending =
    membershipStatus === "pending" || membershipStatus === "awaiting_payment";
  const hasAvailableSpots = hasLeagueAvailableSpots({
    activePlayerCount: league.activePlayerCount,
    maxPlayers: league.maxPlayers,
  });
  const availabilityLabel = formatLeagueAvailabilityBadge({
    activePlayerCount: league.activePlayerCount,
    maxPlayers: league.maxPlayers,
  });
  const joinFooterActionLabel = getJoinFooterActionLabel({
    hasAvailableSpots,
    isJoinRequestPending,
    joinActionLabel,
  });
  const priceParts = formatLeaguePriceParts({
    amountCents: league.monthlyPriceCents,
    billingInterval: league.priceBillingInterval,
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
      // Paid leagues always go straight to checkout (the approval gate, if
      // any, happens AFTER payment in the manual flow). Free leagues queue.
      const isPaidLeague = (league?.monthlyPriceCents ?? 0) > 0;
      optimisticStatus = isPaidLeague ? "awaiting_payment" : "pending";
    }
    bucket$.actions.setViewerMembership({
      // Keep the existing membershipId during optimistic updates; the real id
      // is reconciled when the mutation resolves.
      membershipId,
      status: optimisticStatus,
    });
    requestJoin.mutate({ leagueId });
  }

  return (
    <>
      <Page.Footer className="flex-col px-8 pb-safe-offset-3">
        {availabilityLabel ? (
          <Chip className="self-center" color="success" variant="soft">
            {availabilityLabel}
          </Chip>
        ) : null}
        <Card
          className="centered flex-1 flex-row justify-between"
          variant="tertiary"
        >
          <View className="flex-1">
            <Text>Preço</Text>
            <View className="flex-row items-baseline">
              <Text size="xl" weight="medium">
                {priceParts.amount}
              </Text>
              {priceParts.suffix ? (
                <Text
                  className="flex-1"
                  color="muted"
                  numberOfLines={1}
                  size="sm"
                  weight="medium"
                >
                  {priceParts.suffix}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {canResumeCheckout && membershipId ? (
              <Button
                isDisabled={requestJoin.isPending}
                onPress={() => {
                  router.navigate({
                    params: { leagueId, membershipId },
                    pathname: "/leagues/[leagueId]/checkout",
                  });
                }}
              >
                <Button.Label>{joinFooterActionLabel}</Button.Label>
              </Button>
            ) : (
              <Button
                isDisabled={
                  requestJoin.isPending || !canRequestJoin || !hasAvailableSpots
                }
                onPress={() => {
                  mutateJoinRequest("request");
                }}
              >
                <Button.Label>{joinFooterActionLabel}</Button.Label>
              </Button>
            )}
            {isJoinRequestPending ? (
              <Button
                isDisabled={requestJoin.isPending}
                isIconOnly
                onPress={() => {
                  setIsCancelRequestDialogOpen(true);
                }}
                variant="danger-soft"
              >
                <HugeIcons className="text-danger" icon={Cancel01Icon} />
              </Button>
            ) : null}
          </View>
        </Card>
      </Page.Footer>

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
              <Dialog.Close className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Cancelar solicitação</Dialog.Title>
            <Description>
              Você poderá solicitar entrada nessa liga novamente depois.
            </Description>

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
    </>
  );
}
