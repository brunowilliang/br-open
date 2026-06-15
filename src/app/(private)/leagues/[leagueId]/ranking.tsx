import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Description,
  Dialog,
  ListGroup,
  PressableFeedback,
  Separator,
  useToast,
} from "heroui-native";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import type { LeagueDetailsRankingItem } from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

type RankingItem = LeagueDetailsRankingItem;

export default function LeagueRankingRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  return <LeagueRankingRouteContent leagueId={leagueId} />;
}

function LeagueRankingRouteContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManageRanking = useValue(bucket$.derived.canManageLeague);
  const league = useValue(bucket$.data.league);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<RankingItem[]>(rankingItems);
  const [selectedItem, setSelectedItem] = useState<RankingItem | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemovePending, setIsRemovePending] = useState(false);

  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: access.canOpenRanking,
  });

  async function invalidateLeagueContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
    ]);
  }

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
    if (activeItemId) {
      return;
    }

    setLocalItems(rankingItems);
  }, [activeItemId, rankingItems]);

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

  if (bootstrapStatus === "error") {
    return <ErrorState message="Não foi possível carregar a liga." />;
  }

  if (!league) {
    return (
      <Page>
        <Page.ScrollView
          className="flex-1"
          contentContainerClassName="grow px-4 py-6"
        >
          <LoadingState />
        </Page.ScrollView>
      </Page>
    );
  }

  const isRankingDisabled = !canManageRanking || reorderRanking.isPending;
  const listItems = localItems.length > 0 ? localItems : rankingItems;

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
    router.navigate({
      params: { leagueId },
      pathname: "/leagues/[leagueId]/challenges",
    });
  }

  function renderViewerActions(item: RankingItem, isChallengeable: boolean) {
    return (
      <ListGroup.ItemSuffix>
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
      </ListGroup.ItemSuffix>
    );
  }

  function getListItemClassName(isActive: boolean) {
    return isActive ? "opacity-70" : "";
  }

  function getTitleClassName(isViewerItem: boolean) {
    return isViewerItem ? "text-accent" : "";
  }

  function renderManageHandle(
    drag: RenderItemParams<RankingItem>["drag"],
    isActive: boolean
  ) {
    if (!canManageRanking) {
      return null;
    }

    return (
      <Button
        isDisabled={isRankingDisabled || isActive}
        isIconOnly
        onLongPress={isRankingDisabled ? undefined : drag}
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
    return canManageRanking ? (
      <ListGroup.ItemSuffix />
    ) : (
      renderViewerActions(item, isChallengeable)
    );
  }

  function renderItemWrapper(
    itemContent: ReactNode,
    item: RankingItem,
    isActive: boolean
  ) {
    if (!canManageRanking) {
      return itemContent;
    }

    return (
      <PressableFeedback
        animation={false}
        onPress={
          isActive
            ? undefined
            : () => {
                setSelectedItem(item);
              }
        }
      >
        {itemContent}
        <PressableFeedback.Highlight />
      </PressableFeedback>
    );
  }

  function renderListItemContent(input: {
    drag: RenderItemParams<RankingItem>["drag"];
    isActive: boolean;
    isChallengeable: boolean;
    isViewerItem: boolean;
    item: RankingItem;
  }) {
    return (
      <ListGroup.Item className={getListItemClassName(input.isActive)} disabled>
        <ListGroup.ItemPrefix className="centered flex-row">
          {renderManageHandle(input.drag, input.isActive)}
          {renderPlayerMedia(input.item, input.isViewerItem)}
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent>
          <ListGroup.ItemTitle
            className={getTitleClassName(input.isViewerItem)}
          >
            {input.item.name}
          </ListGroup.ItemTitle>
          <ListGroup.ItemDescription>
            {input.item.nickname}
          </ListGroup.ItemDescription>
        </ListGroup.ItemContent>
        {renderItemSuffix(input.item, input.isChallengeable)}
      </ListGroup.Item>
    );
  }

  function renderItem({ drag, isActive, item }: RenderItemParams<RankingItem>) {
    const isViewerItem = item.isViewerItem === true;
    const isChallengeable = item.isChallengeable === true;
    const itemContent = renderListItemContent({
      drag,
      isActive,
      isChallengeable,
      isViewerItem,
      item,
    });

    return (
      <ScaleDecorator activeScale={1.02}>
        {renderItemWrapper(itemContent, item, isActive)}
      </ScaleDecorator>
    );
  }

  function renderItemSeparator({
    leadingItem,
  }: {
    leadingItem?: RankingItem | null;
  }) {
    if (leadingItem?.id === activeItemId) {
      return null;
    }

    return <Separator className="mx-5" />;
  }

  let rankingContent: ReactNode;

  if (membershipOverviewQuery.isPending) {
    rankingContent = <LoadingState />;
  } else if (membershipOverviewQuery.isError) {
    rankingContent = (
      <ErrorState
        error={membershipOverviewQuery.error}
        message="Não foi possível carregar o ranking."
      />
    );
  } else if (listItems.length === 0) {
    rankingContent = (
      <EmptyState
        description="Aprove solicitações para começar a montar a classificação."
        title="Nenhum jogador no ranking"
      />
    );
  } else {
    rankingContent = (
      <>
        <ListGroup className="overflow-hidden">
          <DraggableFlatList
            activationDistance={12}
            data={listItems}
            ItemSeparatorComponent={renderItemSeparator}
            keyExtractor={(item) => item.id}
            onDragBegin={(index) => {
              setActiveItemId(listItems[index]?.id ?? null);
            }}
            onDragEnd={({ data }) => {
              const reorderedItems = data.map((item, index) => ({
                ...item,
                position: index + 1,
              }));

              setLocalItems(reorderedItems);
              setActiveItemId(null);

              if (canManageRanking) {
                reorderRanking.mutate({
                  leagueId,
                  membershipIds: reorderedItems.map((item) => item.id),
                });
              }
            }}
            renderItem={renderItem}
            scrollEnabled
            showsVerticalScrollIndicator={false}
          />
        </ListGroup>

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
                  <ListGroup>
                    <ListGroup.Item className="bg-surface-secondary" disabled>
                      <ListGroup.ItemPrefix className="centered flex-row">
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
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>
                          {selectedItem.name}
                        </ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>
                          {selectedItem.nickname}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                    </ListGroup.Item>
                  </ListGroup>

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
      </>
    );
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Ranking</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.View className="flex-1 bg-background px-4 pb-safe-offset-4">
        {rankingContent}
      </Page.View>
    </Page>
  );
}
