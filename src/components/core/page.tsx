import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { LegendListRef } from "@legendapp/list/react-native";
import {
  AnimatedLegendList,
  type AnimatedLegendListProps,
} from "@legendapp/list/reanimated";
import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { cn, withSlots } from "better-styled";
import { router } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { colorKit } from "heroui-native/utils";
import type { ComponentProps } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  type AppStateStatus,
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
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";
import { Header } from "./header";

const DEFAULT_SCROLL_EVENT_THROTTLE = 16;
const DEFAULT_HEADER_BLUR_DISTANCE = 64;
const DEFAULT_FOOTER_BLUR_DISTANCE = 64;
const BLUR_RESTORE_FADE_DURATION = 140;

const PageProgressiveBlurView = withUniwind(ProgressiveBlurView);

type PageContextValue = {
  blurOpacity: SharedValue<number>;
  blurViewKey: number;
  contentHeight: SharedValue<number>;
  footerHeight: number;
  headerHeight: number;
  isBlurMounted: boolean;
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

function isBackgroundAppState(status: AppStateStatus) {
  return status === "background" || status === "inactive";
}

type PageRootProps = {
  children: React.ReactNode;
};

const PageRoot = (props: PageRootProps) => {
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const blurOpacity = useSharedValue(
    isBackgroundAppState(AppState.currentState) ? 0 : 1
  );
  const appState = useRef(AppState.currentState);
  const [blurViewKey, setBlurViewKey] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [isBlurMounted, setIsBlurMounted] = useState(
    !isBackgroundAppState(AppState.currentState)
  );
  const [isBlurRestorePending, setIsBlurRestorePending] = useState(false);
  const unmountBlur = useCallback(() => {
    setIsBlurMounted(false);
  }, []);

  // Temporary workaround for @sbaiahmed1/react-native-blur#111.
  // Remove this remount flow when the library preserves ProgressiveBlurView
  // masks correctly across app background/foreground transitions.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const previousAppState = appState.current;
      appState.current = nextAppState;

      if (isBackgroundAppState(nextAppState)) {
        setIsBlurRestorePending(false);
        cancelAnimation(blurOpacity);
        blurOpacity.value = withTiming(
          0,
          { duration: BLUR_RESTORE_FADE_DURATION },
          (finished) => {
            if (finished) {
              runOnJS(unmountBlur)();
            }
          }
        );
        return;
      }

      cancelAnimation(blurOpacity);
      if (isBackgroundAppState(previousAppState)) {
        blurOpacity.value = 0;
        setBlurViewKey((currentValue) => currentValue + 1);
        setIsBlurRestorePending(true);
        setIsBlurMounted(true);
        return;
      }

      setIsBlurMounted(true);
      blurOpacity.value = withTiming(1, {
        duration: BLUR_RESTORE_FADE_DURATION,
      });
    });

    return () => {
      subscription.remove();
    };
  }, [blurOpacity, unmountBlur]);

  useEffect(() => {
    if (!(isBlurMounted && isBlurRestorePending)) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      blurOpacity.value = withTiming(1, {
        duration: BLUR_RESTORE_FADE_DURATION,
      });
      setIsBlurRestorePending(false);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [blurOpacity, isBlurMounted, isBlurRestorePending]);

  const value = useMemo(
    () => ({
      blurOpacity,
      blurViewKey,
      contentHeight,
      footerHeight,
      headerHeight,
      isBlurMounted,
      scrollY,
      setFooterHeight,
      setHeaderHeight,
      viewportHeight,
    }),
    [
      blurOpacity,
      blurViewKey,
      contentHeight,
      footerHeight,
      headerHeight,
      isBlurMounted,
      scrollY,
      viewportHeight,
    ]
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
  const blurRestoreAnimatedStyle = useAnimatedStyle(() => ({
    opacity: context.blurOpacity.value,
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
        {context.isBlurMounted ? (
          <Animated.View
            className="absolute inset-0"
            style={[blurRestoreAnimatedStyle]}
          >
            <PageProgressiveBlurView
              blurAmount={10}
              blurType="systemChromeMaterial"
              className="absolute inset-0"
              direction="blurredTopClearBottom"
              key={`header-blur-${context.blurViewKey}`}
              overlayColor={overlayColor}
              reducedTransparencyFallbackColor={fallbackColor}
            />
          </Animated.View>
        ) : null}
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

const PageAnimatedLegendList = <T,>(
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

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    context.scrollY.value = event.nativeEvent.contentOffset.y;
    context.contentHeight.value = event.nativeEvent.contentSize.height;
    context.viewportHeight.value = event.nativeEvent.layoutMeasurement.height;
    onScroll?.(event);
  }

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
      onScroll={handleScroll}
      ref={ref}
      {...rest}
      className={cn("bg-background", rest.className)}
      contentContainerClassName={cn("grow", rest.contentContainerClassName)}
    />
  );
};

export const BackButton = (props: ComponentProps<typeof Button>) => (
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

type PageFooterProps = ComponentProps<typeof View> & {
  isBlurred?: boolean;
};

const PageFooter = (props: PageFooterProps) => {
  const { isBlurred = false, ...viewProps } = props;
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
    event: Parameters<NonNullable<typeof viewProps.onLayout>>[0]
  ) => {
    context.setFooterHeight(event.nativeEvent.layout.height);
    viewProps.onLayout?.(event);
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
  const blurRestoreAnimatedStyle = useAnimatedStyle(() => ({
    opacity: context.blurOpacity.value,
  }));

  return (
    <View
      {...viewProps}
      className={cn(
        "absolute bottom-0 z-50 w-full flex-row gap-3 px-4 pt-4",
        isBlurred
          ? "overflow-visible"
          : "bg-linear-to-t from-background to-background/0",
        viewProps.className
      )}
      onLayout={handleLayout}
      pointerEvents="none"
    >
      {isBlurred ? (
        <Animated.View
          className="absolute -top-12 right-0 bottom-0 left-0"
          pointerEvents="none"
          style={[blurAnimatedStyle]}
        >
          {context.isBlurMounted ? (
            <Animated.View
              className="absolute inset-0"
              style={[blurRestoreAnimatedStyle]}
            >
              <PageProgressiveBlurView
                blurAmount={10}
                blurType="systemChromeMaterial"
                className="absolute inset-0"
                direction="blurredBottomClearTop"
                key={`footer-blur-${context.blurViewKey}`}
                overlayColor={overlayColor}
                reducedTransparencyFallbackColor={fallbackColor}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      {viewProps.children}
    </View>
  );
};

export const Page = withSlots(PageRoot, {
  Footer: PageFooter,
  Header: withSlots(PageHeader, {
    ...Header,
    BackButton,
  }),
  LegendList: PageAnimatedLegendList,
  View: PageView,
  ScrollView: PageKeyboardAwareScrollView,
});
