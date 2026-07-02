import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Card,
  Description,
  Dialog,
  PressableFeedback,
  useToast,
} from "heroui-native";
import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { SortableCardList } from "@/components/ui/sortable-card-list";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getCreateChallengeErrorToast } from "@/lib/leagues/challenge-feedback";
import type { LeagueDetailsRankingItem } from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  getRankingOrderIds,
  hasRankingOrderChanged,
  shouldSyncRankingLocalItems,
} from "@/lib/leagues/ranking-local-order";

type RankingItem = LeagueDetailsRankingItem;

export default function LeagueRankingRoute() {
  const { leagueId } = useLocalSearchParams<{
    leagueId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManageRanking = useValue(bucket$.derived.canManageLeague);
  const createTarget = useValue(bucket$.ui.challengeCreateTarget);
  const league = useValue(bucket$.data.league);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const [localItems, setLocalItems] = useState<RankingItem[]>(rankingItems);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | null>(null);
  const [selectedItem, setSelectedItem] = useState<RankingItem | null>(null);
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemovePending, setIsRemovePending] = useState(false);

  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: access.canOpenRanking,
  });
  const occupiedSlotsQuery = useQuery({
    ...crpc.league.challenges.listOccupiedSlots.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
  });

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

  const createChallenge = useMutation(
    crpc.league.challenges.create.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Desafio enviado com sucesso.",
          id: "create-challenge-success",
          label: "Desafio criado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show(
          getCreateChallengeErrorToast(
            getToastErrorMessage(error, "Não foi possível criar o desafio.")
          )
        );
      },
    })
  );

  const removeMembership = useMutation(
    crpc.league.membership.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Jogador removido com sucesso.",
          id: "remove-membership-success",
          label: "Jogador removido",
          variant: "success",
        });
      },
      onError: (error) => {
        setPendingOrderIds(null);
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível remover o jogador."
          ),
          id: "remove-membership-error",
          label: "Erro ao remover jogador",
          variant: "danger",
        });
      },
    })
  );

  const reorderRanking = useMutation(
    crpc.league.membership.reorderRanking.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Ranking atualizado com sucesso.",
          id: "reorder-ranking-success",
          label: "Ranking atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar o ranking."
          ),
          id: "reorder-ranking-error",
          label: "Erro ao atualizar ranking",
          variant: "danger",
        });
      },
    })
  );

  useEffect(() => {
    bucket$.actions.setActiveRoute("ranking");
  }, [bucket$]);

  useEffect(() => {
    if (membershipOverviewQuery.data) {
      bucket$.actions.hydrateMembershipOverview(membershipOverviewQuery.data);
    }
  }, [bucket$, membershipOverviewQuery.data]);

  useEffect(() => {
    if (
      !shouldSyncRankingLocalItems({
        activeItemId: activeDragItemId,
        pendingOrderIds,
        rankingItems,
      })
    ) {
      return;
    }

    if (pendingOrderIds) {
      setPendingOrderIds(null);
    }

    setLocalItems(rankingItems);
  }, [activeDragItemId, pendingOrderIds, rankingItems]);

  useEffect(() => {
    if (bootstrapStatus !== "ready") {
      return;
    }

    if (!access.canOpenRanking) {
      router.replace({
        params: { leagueId },
        pathname: "/leagues/[leagueId]",
      });
    }
  }, [access.canOpenRanking, bootstrapStatus, leagueId, router]);

  const isRankingDisabled = !canManageRanking || reorderRanking.isPending;
  const isContentLoading =
    bootstrapStatus !== "ready" || !league || membershipOverviewQuery.isPending;
  const isCreateChallengePending =
    createChallenge.isPending || occupiedSlotsQuery.isPending;
  const listItems = localItems.length > 0 ? localItems : rankingItems;
  const shouldRenderSortableRanking =
    canManageRanking &&
    !isContentLoading &&
    !membershipOverviewQuery.isError &&
    listItems.length > 0;
  const courts = league?.courts ?? [];
  const defaultDurationMinutes =
    league?.ruleConfig.matchConfig.defaultDurationMinutes ?? 0;
  const occupiedSlots = occupiedSlotsQuery.data ?? [];

  function closeDetailsDialog() {
    if (isRemovePending) {
      return;
    }

    setSelectedItem(null);
    setIsRemoveDialogOpen(false);
  }

  async function handleConfirmRemove() {
    if (!selectedItem) {
      return;
    }

    try {
      setIsRemovePending(true);
      await removeMembership.mutateAsync({
        leagueId,
        membershipId: selectedItem.id,
      });
      setIsRemoveDialogOpen(false);
      setSelectedItem(null);
    } catch {
      // Keep the confirmation dialog open so the user can retry after toast feedback.
    } finally {
      setIsRemovePending(false);
    }
  }

  function openChallenge(item: RankingItem) {
    if (!item.isChallengeable) {
      return;
    }

    bucket$.actions.setChallengeCreateTarget({
      membershipId: item.id,
      name: item.name,
    });
  }

  function renderViewerActions(item: RankingItem, isChallengeable: boolean) {
    return (
      <View className="items-end gap-2">
        <View className="flex-row gap-1">
          {[0, 1, 2, 3, 4].map((indicator) => (
            <View
              className="size-2.5 rounded-full bg-border"
              key={`${item.id}-indicator-${indicator}`}
            />
          ))}
        </View>
        {isChallengeable ? (
          <Button
            className="h-7.5"
            onPress={() => {
              openChallenge(item);
            }}
            size="sm"
            variant="secondary"
          >
            <Button.Label>Desafiar</Button.Label>
          </Button>
        ) : null}
      </View>
    );
  }

  function renderManageHandle(input: {
    dragHandle: (children: ReactNode) => ReactNode;
    isActive: boolean;
  }) {
    if (!canManageRanking) {
      return null;
    }

    return input.dragHandle(
      <Button
        isDisabled={isRankingDisabled || input.isActive}
        isIconOnly
        size="sm"
        variant="ghost"
      >
        <HugeIcons className="text-muted" icon={DragDropVerticalIcon} />
      </Button>
    );
  }

  function renderPlayerMedia(item: RankingItem, isViewerItem: boolean) {
    return (
      <View>
        <Image
          alt={item.name}
          className={cn(
            "size-12 rounded-full",
            isViewerItem ? "border-2 border-accent" : ""
          )}
          source={item.avatarUrl}
        />
        <View
          className={cn(
            "centered absolute -top-1 -left-1 size-5.5 rounded-full border bg-surface-secondary",
            isViewerItem
              ? "border-accent bg-accent"
              : "border-separator bg-surface-secondary"
          )}
        >
          <Text
            className={cn(
              "font-bold text-xs",
              isViewerItem
                ? "text-accent-foreground"
                : "text-surface-tertiary-foreground"
            )}
          >
            {item.position}
          </Text>
        </View>
      </View>
    );
  }

  function renderItemSuffix(item: RankingItem, isChallengeable: boolean) {
    return canManageRanking ? null : renderViewerActions(item, isChallengeable);
  }

  function renderRankingCardContent(input: {
    dragHandle: (children: ReactNode) => ReactNode;
    isActive: boolean;
    isChallengeable: boolean;
    isViewerItem: boolean;
    item: RankingItem;
  }) {
    const card = (
      <Card className={cn("w-full p-3", input.isActive ? "opacity-70" : "")}>
        <View className="flex-row items-center gap-3">
          <View className="centered flex-row gap-2">
            {renderManageHandle({
              dragHandle: input.dragHandle,
              isActive: input.isActive,
            })}
            {renderPlayerMedia(input.item, input.isViewerItem)}
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              className={cn(
                "text-base",
                input.isViewerItem ? "text-accent" : ""
              )}
              numberOfLines={1}
              weight="semibold"
            >
              {input.item.name}
            </Text>
            <Text color="muted" numberOfLines={1} variant="description">
              {input.item.nickname}
            </Text>
          </View>
          {renderItemSuffix(input.item, input.isChallengeable)}
        </View>
        {canManageRanking ? <PressableFeedback.Highlight /> : null}
      </Card>
    );

    if (!canManageRanking) {
      return card;
    }

    return (
      <PressableFeedback
        animation={false}
        className="w-full"
        onPress={
          input.isActive
            ? undefined
            : () => {
                setSelectedItem(input.item);
              }
        }
      >
        {card}
      </PressableFeedback>
    );
  }

  function renderItem(props: {
    dragHandle: (children: ReactNode) => ReactNode;
    isActive: boolean;
    item: RankingItem;
  }) {
    const { dragHandle, isActive, item } = props;
    const isViewerItem = item.isViewerItem === true;
    const isChallengeable = item.isChallengeable === true;

    return renderRankingCardContent({
      dragHandle,
      isActive,
      isChallengeable,
      isViewerItem,
      item,
    });
  }

  function handleOrderChange(reorderedItems: RankingItem[]) {
    const nextItems = reorderedItems.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
    const currentMembershipIds = getRankingOrderIds(listItems);
    const nextMembershipIds = getRankingOrderIds(nextItems);

    setLocalItems(nextItems);

    if (
      !hasRankingOrderChanged({
        currentOrderIds: currentMembershipIds,
        nextOrderIds: nextMembershipIds,
      })
    ) {
      return;
    }

    if (canManageRanking) {
      setPendingOrderIds(nextMembershipIds);
      reorderRanking.mutate({
        leagueId,
        membershipIds: nextMembershipIds,
      });
    }
  }

  const isBootstrapError = bootstrapStatus === "error";
  const isRankingError = membershipOverviewQuery.isError;
  const isEmpty = listItems.length === 0;
  const showStatusState =
    isBootstrapError || isContentLoading || isRankingError || isEmpty;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left />
        <Page.Header.Center>
          <Page.Header.Title>Ranking</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      {shouldRenderSortableRanking ? (
        <Page.View className="flex-1 bg-background px-4 pb-floating-tab-bar-offset-4">
          <SortableCardList
            data={listItems}
            fillAvailableHeight
            itemGap={8}
            onDragStateChange={setActiveDragItemId}
            onOrderChange={handleOrderChange}
            renderItem={renderItem}
          />
        </Page.View>
      ) : (
        <Page.ScrollView contentContainerClassName="grow gap-2 px-4 pb-floating-tab-bar-offset-4">
          {isBootstrapError && (
            <ErrorState message="Não foi possível carregar a liga." />
          )}
          {isContentLoading && <LoadingState />}
          {isRankingError && (
            <ErrorState
              error={membershipOverviewQuery.error}
              message="Não foi possível carregar o ranking."
            />
          )}
          {isEmpty && (
            <EmptyState
              description="Aprove solicitações para começar a montar a classificação."
              title="Nenhum jogador no ranking"
            />
          )}
          {!showStatusState && (
            <View className="gap-2">
              {listItems.map((item) => (
                <View key={item.id}>
                  {renderRankingCardContent({
                    dragHandle: (children) => children,
                    isActive: false,
                    isChallengeable: item.isChallengeable === true,
                    isViewerItem: item.isViewerItem === true,
                    item,
                  })}
                </View>
              ))}
            </View>
          )}
        </Page.ScrollView>
      )}
      <Dialog
        isOpen={Boolean(selectedItem) && !isRemoveDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDetailsDialog();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            {isRemovePending ? null : (
              <Dialog.Close className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Detalhes do jogador</Dialog.Title>

            {selectedItem ? (
              <>
                <Card className="p-3" variant="secondary">
                  <View className="flex-row items-center gap-3">
                    <View>
                      <Image
                        alt={selectedItem.name}
                        className="size-10 rounded-full"
                        fallback="green"
                        source={selectedItem.avatarUrl ?? undefined}
                      />
                      <View className="centered absolute -top-1 -left-1 size-5.5 rounded-full border border-separator bg-surface-tertiary">
                        <Text className="font-bold text-surface-tertiary-foreground text-xs">
                          {selectedItem.position}
                        </Text>
                      </View>
                    </View>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text numberOfLines={1} weight="semibold">
                        {selectedItem.name}
                      </Text>
                      <Text
                        color="muted"
                        numberOfLines={1}
                        variant="description"
                      >
                        {selectedItem.nickname}
                      </Text>
                    </View>
                  </View>
                </Card>

                <View className="self-end">
                  <Button
                    isDisabled={isRemovePending}
                    onPress={() => {
                      setIsRemoveDialogOpen(true);
                    }}
                    size="sm"
                    variant="danger-soft"
                  >
                    <Button.Label>Remover</Button.Label>
                    <HugeIcons className="text-danger" icon={Cancel01Icon} />
                  </Button>
                </View>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog
        isOpen={isRemoveDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isRemovePending) {
            return;
          }

          setIsRemoveDialogOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            {isRemovePending ? null : (
              <Dialog.Close className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Remover jogador</Dialog.Title>
            <Description>
              Tem certeza que deseja remover{" "}
              <Text weight="semibold">
                {selectedItem?.name ?? "este jogador"}
              </Text>{" "}
              da liga?
            </Description>

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={isRemovePending}
                onPress={() => {
                  setIsRemoveDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                isDisabled={isRemovePending}
                onPress={() => {
                  handleConfirmRemove().catch(() => undefined);
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Remover</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {createTarget ? (
        <ChallengeProposalDialog
          actionLabel="Enviar desafio"
          courts={courts}
          defaultDurationMinutes={defaultDurationMinutes}
          isOpen
          isPending={isCreateChallengePending}
          occupiedSlots={occupiedSlots}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              bucket$.actions.setChallengeCreateTarget(null);
            }
          }}
          onSubmit={async (value) => {
            await createChallenge.mutateAsync({
              challengedMembershipId: createTarget.membershipId,
              leagueId,
              ...value,
            });
            bucket$.actions.setChallengeCreateTarget(null);
            router.navigate({
              params: { leagueId },
              pathname: "/leagues/[leagueId]/challenges",
            });
          }}
          opponentName={createTarget.name}
          title="Novo desafio"
        />
      ) : null}
      <Page.Footer className="pb-floating-tab-bar-offset-4" />
    </Page>
  );
}
