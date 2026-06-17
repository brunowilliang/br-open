import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  DropProvider,
  SortableItem,
  type SortableRenderItemProps,
  useSortableList,
} from "react-native-reanimated-dnd";
import { scheduleOnRN } from "react-native-worklets";

type SortableCardListItem = {
  id: string;
};

type SortableCardListRenderItemProps<TItem extends SortableCardListItem> = {
  dragHandle: (children: ReactNode) => ReactNode;
  index: number;
  isActive: boolean;
  item: TItem;
};

type SortableCardListProps<TItem extends SortableCardListItem> = {
  data: TItem[];
  itemHeight: number;
  onOrderChange: (data: TItem[]) => void;
  renderItem: (props: SortableCardListRenderItemProps<TItem>) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

function buildDragHandle(children: ReactNode) {
  return <SortableItem.Handle>{children}</SortableItem.Handle>;
}

function hasSameOrder<TItem extends SortableCardListItem>(
  currentItems: TItem[],
  nextItems: TItem[]
) {
  return (
    currentItems.length === nextItems.length &&
    nextItems.every((item, index) => item.id === currentItems[index]?.id)
  );
}

function sortByPositions<TItem extends SortableCardListItem>(
  items: TItem[],
  positions: Record<string, number>
) {
  return [...items].sort((itemA, itemB) => {
    const positionA = positions[itemA.id] ?? 0;
    const positionB = positions[itemB.id] ?? 0;

    return positionA - positionB;
  });
}

function buildPositions<TItem extends SortableCardListItem>(items: TItem[]) {
  const positions: Record<string, number> = {};

  for (const [index, item] of items.entries()) {
    positions[item.id] = index;
  }

  return positions;
}

function buildSortableIdentityKey<TItem extends SortableCardListItem>(
  items: TItem[]
) {
  return items
    .map((item) => item.id)
    .sort()
    .join("|");
}

type SortableCardListTransition<TItem extends SortableCardListItem> = {
  enteringItemIds: Set<string>;
  items: TItem[];
  leavingItemIds: Set<string>;
  sourceItems: TItem[];
};

function createListTransition<TItem extends SortableCardListItem>(
  items: TItem[]
): SortableCardListTransition<TItem> {
  return {
    enteringItemIds: new Set(),
    items,
    leavingItemIds: new Set(),
    sourceItems: items,
  };
}

function reconcileListTransition<TItem extends SortableCardListItem>(
  state: SortableCardListTransition<TItem>,
  nextItems: TItem[]
): SortableCardListTransition<TItem> {
  const previousItemIds = new Set(state.sourceItems.map((item) => item.id));
  const nextItemIds = new Set(nextItems.map((item) => item.id));
  const enteringItemIds = new Set(
    nextItems
      .map((item) => item.id)
      .filter((itemId) => !previousItemIds.has(itemId))
  );
  const leavingItemIds = new Set(
    state.sourceItems
      .map((item) => item.id)
      .filter((itemId) => !nextItemIds.has(itemId))
  );

  for (const itemId of state.leavingItemIds) {
    if (!nextItemIds.has(itemId)) {
      leavingItemIds.add(itemId);
    }
  }

  if (leavingItemIds.size === 0) {
    return {
      enteringItemIds,
      items: nextItems,
      leavingItemIds,
      sourceItems: nextItems,
    };
  }

  const nextItemsById = new Map(nextItems.map((item) => [item.id, item]));
  const items = state.items
    .map((item) => nextItemsById.get(item.id) ?? item)
    .filter((item) => nextItemIds.has(item.id) || leavingItemIds.has(item.id));

  return {
    enteringItemIds,
    items,
    leavingItemIds,
    sourceItems: nextItems,
  };
}

function finishListLeavingItem<TItem extends SortableCardListItem>(
  state: SortableCardListTransition<TItem>,
  itemId: string
): SortableCardListTransition<TItem> {
  if (!state.leavingItemIds.has(itemId)) {
    return state;
  }

  const leavingItemIds = new Set(state.leavingItemIds);
  leavingItemIds.delete(itemId);

  return {
    ...state,
    items: state.items.filter((item) => item.id !== itemId),
    leavingItemIds,
  };
}

type SortableCardItemShellProps = {
  children: ReactNode;
  isEntering: boolean;
  isLeaving: boolean;
  itemId: string;
  onExitEnd: (itemId: string) => void;
};

function SortableCardItemShell(props: SortableCardItemShellProps) {
  const { children, itemId, onExitEnd, isEntering, isLeaving } = props;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(
      isLeaving ? 0 : 1,
      {
        duration: 200,
      },
      (finished) => {
        if (finished && isLeaving) {
          scheduleOnRN(onExitEnd, itemId);
        }
      }
    ),
  }));

  return (
    <Animated.View
      entering={isEntering ? FadeIn : undefined}
      pointerEvents={isLeaving ? "none" : "auto"}
      style={{ overflow: "visible" }}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Animated.View>
  );
}

type SortableCardListContentProps<TItem extends SortableCardListItem> = {
  contentHeight: number;
  data: TItem[];
  itemHeight: number;
  renderItem: (props: SortableRenderItemProps<TItem>) => ReactNode;
};

function SortableCardListContent<TItem extends SortableCardListItem>(
  props: SortableCardListContentProps<TItem>
) {
  const { contentHeight, data, itemHeight, renderItem } = props;
  const {
    dropProviderRef,
    getItemProps,
    handleScroll,
    handleScrollEnd,
    positions,
    scrollViewRef,
  } = useSortableList({
    data,
    itemHeight,
    itemKeyExtractor: (item) => item.id,
  });

  useLayoutEffect(() => {
    positions.value = buildPositions(data);
  }, [data, positions]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DropProvider ref={dropProviderRef}>
        <Animated.ScrollView
          contentContainerStyle={{
            backgroundColor: "transparent",
            height: contentHeight,
            overflow: "visible",
          }}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEnd}
          ref={scrollViewRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={{
            backgroundColor: "transparent",
            flex: 1,
            overflow: "visible",
            position: "relative",
          }}
        >
          {data.map((item, index) =>
            renderItem({
              index,
              item,
              ...getItemProps(item, index),
            })
          )}
        </Animated.ScrollView>
      </DropProvider>
    </GestureHandlerRootView>
  );
}

export function SortableCardList<TItem extends SortableCardListItem>(
  props: SortableCardListProps<TItem>
) {
  const { data, itemHeight, onOrderChange, renderItem, style } = props;
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const transitionRef = useRef(createListTransition(data));
  const sortableIdentityKeyRef = useRef(buildSortableIdentityKey(data));
  const [, rerenderAfterExit] = useState(0);

  if (transitionRef.current.sourceItems !== data) {
    transitionRef.current = reconcileListTransition(
      transitionRef.current,
      data
    );
  }

  const transition = transitionRef.current;
  const listHeight = transition.items.length * itemHeight;

  if (transition.enteringItemIds.size > 0) {
    sortableIdentityKeyRef.current = buildSortableIdentityKey(transition.items);
  }

  const finishLeavingItem = useCallback((itemId: string) => {
    const nextTransition = finishListLeavingItem(transitionRef.current, itemId);

    if (nextTransition === transitionRef.current) {
      return;
    }

    transitionRef.current = nextTransition;
    rerenderAfterExit((version) => version + 1);
  }, []);

  const beginDrag = useCallback((itemId: string) => {
    setActiveItemId(itemId);
  }, []);

  const endDrag = useCallback(() => {
    setActiveItemId(null);
  }, []);

  const handleDrop = useCallback(
    (
      _itemId: string,
      _position: number,
      allPositions?: Record<string, number>
    ) => {
      endDrag();

      if (!allPositions) {
        return;
      }

      const nextData = sortByPositions(data, allPositions);

      if (hasSameOrder(data, nextData)) {
        return;
      }

      onOrderChange(nextData);
    },
    [data, endDrag, onOrderChange]
  );

  const renderSortableItem = useCallback(
    (sortableProps: SortableRenderItemProps<TItem>) => {
      const { id, item, ...sortableItemProps } = sortableProps;
      const isLeaving = transition.leavingItemIds.has(id);

      return (
        <SortableItem
          data={item}
          id={id}
          key={id}
          onDragStart={beginDrag}
          onDrop={handleDrop}
          style={{ height: itemHeight, overflow: "visible" }}
          {...sortableItemProps}
        >
          <SortableCardItemShell
            isEntering={transition.enteringItemIds.has(id)}
            isLeaving={isLeaving}
            itemId={id}
            onExitEnd={finishLeavingItem}
          >
            {renderItem({
              dragHandle: buildDragHandle,
              index: sortableProps.index,
              isActive: activeItemId === id,
              item,
            })}
          </SortableCardItemShell>
        </SortableItem>
      );
    },
    [
      activeItemId,
      beginDrag,
      finishLeavingItem,
      handleDrop,
      itemHeight,
      renderItem,
      transition.enteringItemIds,
      transition.leavingItemIds,
    ]
  );

  return (
    <Animated.View
      layout={LinearTransition}
      style={[{ height: listHeight, overflow: "visible" }, style]}
    >
      <SortableCardListContent
        contentHeight={listHeight}
        data={transition.items}
        itemHeight={itemHeight}
        key={sortableIdentityKeyRef.current}
        renderItem={renderSortableItem}
      />
    </Animated.View>
  );
}
