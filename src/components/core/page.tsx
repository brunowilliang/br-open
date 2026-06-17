import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { cn, withSlots } from "better-styled";
import { router } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { colorKit } from "heroui-native/utils";
import type { ComponentProps } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import {
  type KeyboardAwareScrollViewProps,
  KeyboardAwareScrollView as RNKeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";
import { Header } from "./header";

const DEFAULT_SCROLL_EVENT_THROTTLE = 16;
const DEFAULT_HEADER_BLUR_DISTANCE = 64;
const DEFAULT_FOOTER_BLUR_DISTANCE = 64;

const PageProgressiveBlurView = withUniwind(ProgressiveBlurView);

type PageContextValue = {
  contentHeight: SharedValue<number>;
  footerHeight: number;
  headerHeight: number;
  scrollY: SharedValue<number>;
  setFooterHeight: (height: number) => void;
  setHeaderHeight: (height: number) => void;
  viewportHeight: SharedValue<number>;
};

const PageContext = createContext<PageContextValue | null>(null);

function usePageContext() {
  const context = useContext(PageContext);

  if (context === null) {
    throw new Error("Core Page components must be rendered inside <Page>.");
  }

  return context;
}

type PageRootProps = {
  children: React.ReactNode;
};

const PageRoot = (props: PageRootProps) => {
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const value = useMemo(
    () => ({
      contentHeight,
      footerHeight,
      headerHeight,
      scrollY,
      setFooterHeight,
      setHeaderHeight,
      viewportHeight,
    }),
    [contentHeight, footerHeight, headerHeight, scrollY, viewportHeight]
  );

  return (
    <PageContext.Provider value={value}>{props.children}</PageContext.Provider>
  );
};

function buildPageInsetStyle(input: {
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

type PageHeaderProps = ComponentProps<typeof Header>;

const PageHeader = (props: PageHeaderProps) => {
  const context = usePageContext();
  const fallbackColor = useThemeColor("background");
  const overlayColor = colorKit.setAlpha(fallbackColor, 0).hex();

  useEffect(
    () => () => {
      context.setHeaderHeight(0);
    },
    [context.setHeaderHeight]
  );

  const handleLayout = (
    event: Parameters<NonNullable<typeof props.onLayout>>[0]
  ) => {
    context.setHeaderHeight(event.nativeEvent.layout.height);
    props.onLayout?.(event);
  };

  const blurAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      context.scrollY.value,
      [0, DEFAULT_HEADER_BLUR_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Header
      {...props}
      className={cn("absolute z-50 pt-safe-offset-4", props.className)}
      onLayout={handleLayout}
      transparent={props.transparent ?? true}
    >
      <Animated.View
        className="absolute inset-0"
        pointerEvents="none"
        style={[blurAnimatedStyle]}
      >
        <PageProgressiveBlurView
          blurAmount={10}
          blurType="systemChromeMaterial"
          className="absolute inset-0"
          direction="blurredTopClearBottom"
          overlayColor={overlayColor}
          reducedTransparencyFallbackColor={fallbackColor}
        />
      </Animated.View>

      {props.children}
    </Header>
  );
};

const PageKeyboardAwareScrollView = (props: KeyboardAwareScrollViewProps) => {
  const context = usePageContext();

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    context.scrollY.value = event.nativeEvent.contentOffset.y;
    context.contentHeight.value = event.nativeEvent.contentSize.height;
    context.viewportHeight.value = event.nativeEvent.layoutMeasurement.height;
    props.onScroll?.(event);
  }

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
      onScroll={handleScroll}
      scrollEventThrottle={
        props.scrollEventThrottle ?? DEFAULT_SCROLL_EVENT_THROTTLE
      }
    />
  );
};

const PageView = (props: ComponentProps<typeof View>) => {
  const context = usePageContext();

  return (
    <View {...props} style={[buildPageInsetStyle(context), props.style]}>
      {props.children}
    </View>
  );
};

const BackButton = (props: ComponentProps<typeof Button>) => (
  <Button
    isIconOnly
    onPress={() => router.back()}
    size="sm"
    variant="ghost"
    {...props}
  >
    <Header.Icon icon={ArrowLeft01Icon} />
  </Button>
);

const PageFooter = (props: ComponentProps<typeof View>) => {
  const context = usePageContext();
  const fallbackColor = useThemeColor("background");
  const overlayColor = colorKit.setAlpha(fallbackColor, 0).hex();

  useEffect(
    () => () => {
      context.setFooterHeight(0);
    },
    [context.setFooterHeight]
  );

  const handleLayout = (
    event: Parameters<NonNullable<typeof props.onLayout>>[0]
  ) => {
    context.setFooterHeight(event.nativeEvent.layout.height);
    props.onLayout?.(event);
  };

  const blurAnimatedStyle = useAnimatedStyle(() => {
    const distanceToEnd = Math.max(
      context.contentHeight.value -
        context.viewportHeight.value -
        context.scrollY.value,
      0
    );

    return {
      opacity: interpolate(
        distanceToEnd,
        [0, DEFAULT_FOOTER_BLUR_DISTANCE],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <View
      {...props}
      className={cn(
        "absolute bottom-0 z-50 w-full flex-row gap-3 overflow-visible px-4 pt-4 pb-safe-offset-2",
        props.className
      )}
      onLayout={handleLayout}
    >
      <Animated.View
        className="absolute -top-12 right-0 bottom-0 left-0"
        pointerEvents="none"
        style={[blurAnimatedStyle]}
      >
        <PageProgressiveBlurView
          blurAmount={10}
          blurType="systemChromeMaterial"
          className="absolute inset-0"
          direction="blurredBottomClearTop"
          overlayColor={overlayColor}
          reducedTransparencyFallbackColor={fallbackColor}
        />
      </Animated.View>

      {props.children}
    </View>
  );
};

export const Page = withSlots(PageRoot, {
  Footer: PageFooter,
  Header: withSlots(PageHeader, {
    ...Header,
    BackButton,
  }),
  View: PageView,
  ScrollView: PageKeyboardAwareScrollView,
});
