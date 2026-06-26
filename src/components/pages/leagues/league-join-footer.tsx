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
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const canRequestJoin = useValue(bucket$.derived.canRequestJoin);
  const league = useValue(bucket$.data.league);
  const membershipStatus = useValue(bucket$.viewer.membershipStatus);
  const joinActionLabel = useValue(bucket$.derived.joinActionLabel);
  const joinMutationIntentRef = useRef<"cancel" | "request">("request");
  const previousMembershipStatusRef = useRef<{
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

        bucket$.actions.setViewerMembershipStatus(membership.status);

        if (intent === "cancel") {
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

        toast.show({
          description:
            membership.status === "active"
              ? "Você entrou como jogador na liga."
              : "Solicitação enviada para aprovação.",
          id: "request-join-success",
          label:
            membership.status === "active"
              ? "Entrada confirmada"
              : "Solicitação enviada",
          variant: "success",
        });

        await invalidateLeagueContext();
      },
      onError: (error) => {
        const intent = joinMutationIntentRef.current;
        joinMutationIntentRef.current = "request";
        const previousMembershipStatus = previousMembershipStatusRef.current;
        previousMembershipStatusRef.current = null;
        const isCancelAction = intent === "cancel";

        if (previousMembershipStatus) {
          bucket$.actions.setViewerMembershipStatus(
            previousMembershipStatus.status
          );
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

  const isJoinRequestPending = membershipStatus === "pending";
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
    previousMembershipStatusRef.current = { status: membershipStatus };
    bucket$.actions.setViewerMembershipStatus(
      intent === "cancel" ? "left" : "pending"
    );
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
