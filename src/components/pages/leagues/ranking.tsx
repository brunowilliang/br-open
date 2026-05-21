import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import {
  Button,
  Description,
  Dialog,
  ListGroup,
  PressableFeedback,
  Separator,
} from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

export type RankingItem = {
  avatarUrl?: string | null;
  id: string;
  name: string;
  nickname: string;
  position: number;
  userId?: string;
};

type RankingProps = {
  canManage?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  items: RankingItem[];
  maxChallengeDistance?: number;
  onChange?: (items: RankingItem[]) => void;
  onRemove?: (membershipId: string) => Promise<void>;
  viewerPosition?: number | null;
  viewerUserId?: string | null;
};

export const Ranking = (props: RankingProps) => {
  const {
    canManage,
    errorMessage,
    isDisabled,
    isLoading,
    items,
    maxChallengeDistance,
    onChange,
    onRemove,
    viewerPosition,
    viewerUserId,
  } = props;
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<RankingItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<RankingItem | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemovePending, setIsRemovePending] = useState(false);
  const listItems = localItems.length === items.length ? localItems : items;

  function closeDetailsDialog() {
    if (isRemovePending) {
      return;
    }

    setSelectedItem(null);
    setIsRemoveDialogOpen(false);
  }

  async function handleConfirmRemove() {
    if (!(onRemove && selectedItem)) {
      return;
    }

    try {
      setIsRemovePending(true);
      await onRemove(selectedItem.id);
      setIsRemoveDialogOpen(false);
      setSelectedItem(null);
    } catch {
      // Keep the confirmation dialog open so the user can retry after toast feedback.
    } finally {
      setIsRemovePending(false);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (errorMessage) {
    return <ErrorState message={errorMessage} />;
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
              onPress={() => undefined}
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

  function isViewerChallengeable(item: RankingItem) {
    return (
      !canManage &&
      typeof maxChallengeDistance === "number" &&
      typeof viewerPosition === "number" &&
      item.userId !== viewerUserId &&
      item.position < viewerPosition &&
      viewerPosition - item.position <= maxChallengeDistance
    );
  }

  function isViewerOwnItem(item: RankingItem) {
    return !canManage && item.userId === viewerUserId;
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
    if (!canManage) {
      return null;
    }

    return (
      <Button
        isDisabled={isDisabled || isActive}
        isIconOnly
        onLongPress={isDisabled ? undefined : drag}
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
    return canManage ? (
      <ListGroup.ItemSuffix />
    ) : (
      renderViewerActions(item, isChallengeable)
    );
  }

  function renderItemWrapper(
    itemContent: React.ReactNode,
    item: RankingItem,
    isActive: boolean
  ) {
    if (!canManage) {
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
    const isViewerItem = isViewerOwnItem(item);
    const isChallengeable = isViewerChallengeable(item);
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

  if (listItems.length === 0) {
    return (
      <EmptyState
        description="Aprove solicitações para começar a montar a classificação."
        title="Nenhum jogador no ranking"
      />
    );
  }

  return (
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
            onChange?.(reorderedItems);
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
                    isDisabled={!onRemove || isRemovePending}
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
                isDisabled={!onRemove || isRemovePending}
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
};
