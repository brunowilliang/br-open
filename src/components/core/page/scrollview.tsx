import { cn } from "better-styled";
import type { ComponentProps } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import {
  type KeyboardAwareScrollViewProps,
  KeyboardAwareScrollView as RNKeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import { useAnimatedScrollHandler } from "react-native-reanimated";
import { usePageContext } from "./context";
import { DEFAULT_SCROLL_EVENT_THROTTLE } from "./constants";

export function buildPageInsetStyle(input: {
  footerHeight: number;
  headerHeight: number;
}) {
  const style: {
    paddingBottom?: number;
    paddingTop?: number;
  } = {};

  if (input.headerHeight > 0) {
    style.paddingTop = input.headerHeight;
  }

  if (input.footerHeight > 0) {
    style.paddingBottom = input.footerHeight;
  }

  return style;
}

export const PageKeyboardAwareScrollView = (
  props: KeyboardAwareScrollViewProps
) => {
  const context = usePageContext();

  // Runs on the UI thread (Reanimated worklet) so scroll tracking never blocks
  // the JS thread. The KeyboardAwareScrollView forwards `onScroll` to its inner
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
    props.onContentSizeChange?.(width, height);
  }

  function handleLayout(event: LayoutChangeEvent) {
    context.viewportHeight.value = event.nativeEvent.layout.height;
    props.onLayout?.(event);
  }

  return (
    <RNKeyboardAwareScrollView
      {...props}
      bottomOffset={props.bottomOffset ?? 20}
      className={cn("bg-background", props.className)}
      contentContainerClassName={cn("grow", props.contentContainerClassName)}
      contentContainerStyle={[
        buildPageInsetStyle(context),
        props.contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      onScroll={
        scrollHandler as unknown as ComponentProps<
          typeof RNKeyboardAwareScrollView
        >["onScroll"]
      }
      scrollEventThrottle={
        props.scrollEventThrottle ?? DEFAULT_SCROLL_EVENT_THROTTLE
      }
    />
  );
};

export const PageView = (props: ComponentProps<typeof View>) => {
  const context = usePageContext();

  return (
    <View {...props} style={[buildPageInsetStyle(context), props.style]}>
      {props.children}
    </View>
  );
};
