import { HugeIcons } from "@/components/ui/huge-icons";
import { Text } from "@/components/ui/text";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import {
  Avatar,
  Button,
  ListGroup,
  PressableFeedback,
  Separator,
} from "heroui-native";
import { EmptyState } from "heroui-native-pro";
import { useEffect, useState } from "react";
import { View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

export type ClassificationItem = {
  avatarUrl?: string | null;
  id: string;
  name: string;
  nickname: string;
  position: number;
};

type ClassificationProps = {
  isDisabled?: boolean;
  items: ClassificationItem[];
  onChange?: (items: ClassificationItem[]) => void;
};

export const Classification = (props: ClassificationProps) => {
  const { isDisabled, items, onChange } = props;
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  function renderItem({
    drag,
    isActive,
    item,
  }: RenderItemParams<ClassificationItem>) {
    return (
      <ScaleDecorator activeScale={1.02}>
        <PressableFeedback animation={false}>
          <ListGroup.Item
            className={isActive ? "opacity-80" : undefined}
            disabled
          >
            <ListGroup.ItemPrefix className="centered flex-row">
              <Button
                isDisabled={isDisabled || isActive}
                isIconOnly
                onLongPress={isDisabled ? undefined : drag}
                size="sm"
                variant="ghost"
              >
                <HugeIcons className="text-muted" icon={DragDropVerticalIcon} />
              </Button>
              <View>
                <Avatar alt={item.name}>
                  {item.avatarUrl ? (
                    <Avatar.Image source={{ uri: item.avatarUrl }} />
                  ) : null}
                  <Avatar.Fallback>
                    {item.name.slice(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar>
                <View className="centered absolute -top-1 -left-1 size-5.5 rounded-full border border-separator bg-surface-tertiary">
                  <Text className="font-bold text-surface-tertiary-foreground text-xs">
                    {item.position}
                  </Text>
                </View>
              </View>
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{item.name}</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                {item.nickname}
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </ScaleDecorator>
    );
  }

  function renderItemSeparator({
    leadingItem,
  }: {
    leadingItem?: ClassificationItem | null;
  }) {
    if (leadingItem?.id === activeItemId) {
      return null;
    }

    return <Separator className="mx-5" />;
  }

  if (localItems.length === 0) {
    return (
      <EmptyState className="gap-3.5 p-2">
        <View>
          <EmptyState.Title>Nenhum jogador no ranking</EmptyState.Title>
          <EmptyState.Description>
            Aprove solicitações para começar a montar a classificação.
          </EmptyState.Description>
        </View>
      </EmptyState>
    );
  }

  return (
    <ListGroup className="overflow-hidden">
      <DraggableFlatList
        activationDistance={12}
        data={localItems}
        ItemSeparatorComponent={renderItemSeparator}
        keyExtractor={(item) => item.id}
        onDragBegin={(index) => {
          setActiveItemId(localItems[index]?.id ?? null);
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
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </ListGroup>
  );
};
