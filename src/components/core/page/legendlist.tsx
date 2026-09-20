import type { LegendListRef } from "@legendapp/list/react-native";
import {
  AnimatedLegendList,
  type AnimatedLegendListProps,
} from "@legendapp/list/reanimated";
import { cn } from "better-styled";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useAnimatedScrollHandler } from "react-native-reanimated";
import { usePageContext } from "./context";

export const PageAnimatedLegendList = <T,>(
  props: AnimatedLegendListProps<T> & { ref?: React.Ref<LegendListRef> }
) => {
  const {
    ListFooterComponent,
    ListHeaderComponent,
    onContentSizeChange,
    onScroll,
    ref,
    ...rest
  } = props;
  const context = usePageContext();

  // Runs on the UI thread (Reanimated worklet) so scroll tracking never blocks
  // the JS thread. AnimatedLegendList forwards `onScroll` to its underlying
  // Reanimated.ScrollView, which accepts worklet handlers at runtime; the cast
  // bridges the wrapper's NativeSyntheticEvent-typed prop to the worklet handler.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      context.scrollY.value = event.contentOffset.y;
      context.contentHeight.value = event.contentSize.height;
      context.viewportHeight.value = event.layoutMeasurement.height;
    },
  });

  function handleContentSizeChange(width: number, height: number) {
    context.contentHeight.value = height;
    onContentSizeChange?.(width, height);
  }

  return (
    <AnimatedLegendList<T>
      ListFooterComponent={
        <>
          <View style={{ height: context.footerHeight }} />
          {ListFooterComponent}
        </>
      }
      ListHeaderComponent={
        <>
          <View style={{ height: context.headerHeight }} />
          {ListHeaderComponent}
        </>
      }
      maintainVisibleContentPosition={false}
      onContentSizeChange={handleContentSizeChange}
      onScroll={
        scrollHandler as unknown as ComponentProps<
          typeof AnimatedLegendList<T>
        >["onScroll"]
      }
      ref={ref}
      {...rest}
      className={cn("bg-background", rest.className)}
      contentContainerClassName={cn("grow", rest.contentContainerClassName)}
    />
  );
};
