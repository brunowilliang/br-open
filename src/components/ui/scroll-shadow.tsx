import { LinearGradient } from "expo-linear-gradient";
import {
  ScrollShadow as HeroScrollShadow,
  type ScrollShadowProps as HeroScrollShadowProps,
  type ThemeColor,
  useThemeColor,
} from "heroui-native";
import { colorKit } from "heroui-native/utils";
import {
  cloneElement,
  createElement,
  isValidElement,
  type ComponentType,
  type ReactElement,
  useCallback,
  useState,
} from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type ScrollHandlerProcessed,
  type SharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useSharedValue,
} from "react-native-reanimated";

type ScrollShadowProps = Omit<
  HeroScrollShadowProps,
  "LinearGradientComponent" | "color"
> & {
  bottomSize?: number;
  color?: ThemeColor;
  isGesturePassthrough?: boolean;
  leftSize?: number;
  rightSize?: number;
  topSize?: number;
};

const DEFAULT_SCROLL_SHADOW_COLOR = "background";
const DEFAULT_SCROLL_SHADOW_SIZE = 56;
const DEFAULT_SCROLL_EVENT_THROTTLE = 16;

type ScrollShadowOrientation = NonNullable<
  HeroScrollShadowProps["orientation"]
>;

type ContainerLayoutParams = {
  layout: {
    height: number;
    width: number;
  };
};

type ScrollShadowChildProps = {
  horizontal?: boolean;
  onAnimValInit?: (params: ScrollShadowAnimValues) => void;
  onContainerLayout?: (params: ContainerLayoutParams) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onScroll?: ScrollHandlerProcessed<Record<string, unknown>>;
  onScrollOffsetChange?: (offset: number) => void;
  scrollEventThrottle?: number;
};

type ScrollShadowAnimValues = {
  activeCellSize: SharedValue<number>;
  activeIndexAnim: SharedValue<number>;
  hoverOffset: SharedValue<number>;
};

type PassthroughScrollShadowProps = Omit<
  ScrollShadowProps,
  "animation" | "children" | "color" | "isGesturePassthrough"
> & {
  child: ReactElement<ScrollShadowChildProps>;
  resolvedColor: string;
};

type StandardScrollShadowProps = Omit<
  ScrollShadowProps,
  "animation" | "children" | "color" | "isGesturePassthrough"
> & {
  child: ReactElement<ScrollShadowChildProps>;
  resolvedColor: string;
};

type ScrollShadowComponentType = ComponentType<ScrollShadowChildProps>;

type ScrollShadowSizeOptions = {
  bottomSize?: number;
  leftSize?: number;
  orientation: ScrollShadowOrientation;
  rightSize?: number;
  size: number;
  topSize?: number;
};

type MaybeAnimatedComponentType = {
  __isAnimatedComponent?: boolean;
  displayName?: string;
};

const animatedComponentCache = new WeakMap<
  ScrollShadowComponentType,
  ScrollShadowComponentType
>();

const scrollShadowStyles = StyleSheet.create({
  bottomShadow: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 10,
  },
  root: {
    overflow: "hidden",
  },
  leftShadow: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    zIndex: 10,
  },
  rightShadow: {
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  topShadow: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
});

const getLayoutDimension = (
  layout: ContainerLayoutParams["layout"],
  orientation: ScrollShadowOrientation
) => (orientation === "vertical" ? layout.height : layout.width);

const getContentDimension = (
  width: number,
  height: number,
  orientation: ScrollShadowOrientation
) => (orientation === "vertical" ? height : width);

const getAnimatedComponent = (component: ScrollShadowComponentType) => {
  const cachedComponent = animatedComponentCache.get(component);

  if (cachedComponent) {
    return cachedComponent;
  }

  const animatedComponent = Animated.createAnimatedComponent(component);

  animatedComponentCache.set(component, animatedComponent);

  return animatedComponent;
};

const getScrollShadowSizes = (options: ScrollShadowSizeOptions) => {
  const { bottomSize, leftSize, orientation, rightSize, size, topSize } =
    options;

  if (orientation === "vertical") {
    return {
      endSize: bottomSize ?? size,
      startSize: topSize ?? size,
    };
  }

  return {
    endSize: rightSize ?? size,
    startSize: leftSize ?? size,
  };
};

const isAnimatedComponentType = (component: unknown) => {
  const componentMeta = component as MaybeAnimatedComponentType;

  return (
    componentMeta.__isAnimatedComponent === true ||
    componentMeta.displayName?.includes("AnimatedComponent") === true
  );
};

const getStartShadowOpacity = (
  offset: number,
  size: number,
  canShowShadow: boolean
) => {
  "worklet";

  return canShowShadow
    ? interpolate(offset, [0, size / 4], [0, 1], Extrapolation.CLAMP)
    : 0;
};

const getDragStartShadowOpacity = (
  activeCellSize: number,
  activeIndex: number,
  hoverOffset: number,
  offset: number,
  size: number
) => {
  "worklet";

  if (activeIndex < 0 || activeCellSize <= 0) {
    return 0;
  }

  return interpolate(
    hoverOffset - offset,
    [0, size / 4],
    [1, 0],
    Extrapolation.CLAMP
  );
};

const getEndShadowOpacity = (
  containerSize: number,
  contentSize: number,
  offset: number,
  size: number,
  canShowShadow: boolean,
  contentOverflows: boolean
) => {
  "worklet";

  return canShowShadow && contentOverflows
    ? interpolate(
        offset + containerSize,
        [contentSize - size / 4, contentSize],
        [1, 0],
        Extrapolation.CLAMP
      )
    : 0;
};

const getDragEndShadowOpacity = (
  activeCellSize: number,
  activeIndex: number,
  containerSize: number,
  hoverOffset: number,
  offset: number,
  size: number
) => {
  "worklet";

  if (activeIndex < 0 || activeCellSize <= 0) {
    return 0;
  }

  return interpolate(
    hoverOffset - offset + activeCellSize,
    [containerSize - size / 4, containerSize],
    [0, 1],
    Extrapolation.CLAMP
  );
};

const PassthroughScrollShadow = (props: PassthroughScrollShadowProps) => {
  const {
    child,
    className,
    isEnabled = true,
    bottomSize,
    leftSize,
    orientation: orientationProp,
    resolvedColor,
    rightSize,
    size = DEFAULT_SCROLL_SHADOW_SIZE,
    style,
    topSize,
    visibility = "auto",
    ...rest
  } = props;
  const childProps = child.props;
  const orientation =
    orientationProp ?? (childProps.horizontal ? "horizontal" : "vertical");
  const { endSize, startSize } = getScrollShadowSizes({
    bottomSize,
    leftSize,
    orientation,
    rightSize,
    size,
    topSize,
  });
  const containerSize = useSharedValue(0);
  const contentSize = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const [animValues, setAnimValues] = useState<ScrollShadowAnimValues | null>(
    null
  );
  const opaqueColor = colorKit.setAlpha(resolvedColor, 1).hex();
  const transparentColor = colorKit.setAlpha(resolvedColor, 0).hex();
  const startColors = [opaqueColor, transparentColor] as const;
  const endColors = [transparentColor, opaqueColor] as const;
  const canShowStartShadow =
    isEnabled &&
    visibility !== "none" &&
    visibility !== "bottom" &&
    visibility !== "right";
  const canShowEndShadow =
    isEnabled &&
    visibility !== "none" &&
    visibility !== "top" &&
    visibility !== "left";

  const handleContainerLayout = useCallback(
    (params: ContainerLayoutParams) => {
      containerSize.value = getLayoutDimension(params.layout, orientation);
      childProps.onContainerLayout?.(params);
    },
    [childProps, containerSize, orientation]
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentSize.value = getContentDimension(width, height, orientation);
      childProps.onContentSizeChange?.(width, height);
    },
    [childProps, contentSize, orientation]
  );

  const handleScrollOffsetChange = useCallback(
    (offset: number) => {
      scrollOffset.value = offset;
      childProps.onScrollOffsetChange?.(offset);
    },
    [childProps, scrollOffset]
  );

  const handleAnimValInit = useCallback(
    (params: ScrollShadowAnimValues) => {
      setAnimValues(params);
      childProps.onAnimValInit?.(params);
    },
    [childProps]
  );

  const startShadowStyle = useAnimatedStyle(() => {
    const normalOpacity = getStartShadowOpacity(
      scrollOffset.value,
      startSize,
      canShowStartShadow
    );
    const dragOpacity =
      animValues && canShowStartShadow
        ? getDragStartShadowOpacity(
            animValues.activeCellSize.value,
            animValues.activeIndexAnim.value,
            animValues.hoverOffset.value,
            scrollOffset.value,
            startSize
          )
        : 0;

    return {
      opacity: Math.max(normalOpacity, dragOpacity),
    };
  });

  const endShadowStyle = useAnimatedStyle(() => {
    const contentOverflows = contentSize.value > containerSize.value;
    const normalOpacity = getEndShadowOpacity(
      containerSize.value,
      contentSize.value,
      scrollOffset.value,
      endSize,
      canShowEndShadow,
      contentOverflows
    );
    const dragOpacity =
      animValues && canShowEndShadow
        ? getDragEndShadowOpacity(
            animValues.activeCellSize.value,
            animValues.activeIndexAnim.value,
            containerSize.value,
            animValues.hoverOffset.value,
            scrollOffset.value,
            endSize
          )
        : 0;

    return {
      opacity: Math.max(normalOpacity, dragOpacity),
    };
  });

  const enhancedChild = cloneElement(child, {
    onAnimValInit: handleAnimValInit,
    onContainerLayout: handleContainerLayout,
    onContentSizeChange: handleContentSizeChange,
    onScrollOffsetChange: handleScrollOffsetChange,
  });

  return (
    <View
      className={className}
      style={[scrollShadowStyles.root, style]}
      {...rest}
    >
      {enhancedChild}

      {orientation === "vertical" ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.topShadow,
              { height: startSize },
              startShadowStyle,
            ]}
          >
            <LinearGradient
              colors={startColors}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.bottomShadow,
              { height: endSize },
              endShadowStyle,
            ]}
          >
            <LinearGradient
              colors={endColors}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.leftShadow,
              { width: startSize },
              startShadowStyle,
            ]}
          >
            <LinearGradient
              colors={startColors}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.rightShadow,
              { width: endSize },
              endShadowStyle,
            ]}
          >
            <LinearGradient
              colors={endColors}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
};

const StandardScrollShadow = (props: StandardScrollShadowProps) => {
  const {
    child,
    className,
    isEnabled = true,
    bottomSize,
    leftSize,
    orientation: orientationProp,
    resolvedColor,
    rightSize,
    size = DEFAULT_SCROLL_SHADOW_SIZE,
    style,
    topSize,
    visibility = "auto",
    ...rest
  } = props;
  const childProps = child.props;
  const orientation =
    orientationProp ?? (childProps.horizontal ? "horizontal" : "vertical");
  const { endSize, startSize } = getScrollShadowSizes({
    bottomSize,
    leftSize,
    orientation,
    rightSize,
    size,
    topSize,
  });
  const containerSize = useSharedValue(0);
  const contentSize = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const opaqueColor = colorKit.setAlpha(resolvedColor, 1).hex();
  const transparentColor = colorKit.setAlpha(resolvedColor, 0).hex();
  const startColors = [opaqueColor, transparentColor] as const;
  const endColors = [transparentColor, opaqueColor] as const;
  const canShowStartShadow =
    isEnabled &&
    visibility !== "none" &&
    visibility !== "bottom" &&
    visibility !== "right";
  const canShowEndShadow =
    isEnabled &&
    visibility !== "none" &&
    visibility !== "top" &&
    visibility !== "left";

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentSize.value = getContentDimension(width, height, orientation);
      childProps.onContentSizeChange?.(width, height);
    },
    [childProps, contentSize, orientation]
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      containerSize.value = getLayoutDimension(
        event.nativeEvent.layout,
        orientation
      );
      childProps.onLayout?.(event);
    },
    [childProps, containerSize, orientation]
  );

  const localScrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollOffset.value =
          orientation === "vertical"
            ? event.contentOffset.y
            : event.contentOffset.x;
      },
    },
    [orientation]
  );
  const onScroll = useComposedEventHandler([
    localScrollHandler,
    childProps.onScroll ?? null,
  ]);
  const scrollEventThrottle =
    childProps.scrollEventThrottle ?? DEFAULT_SCROLL_EVENT_THROTTLE;

  const startShadowStyle = useAnimatedStyle(() => {
    const normalOpacity = getStartShadowOpacity(
      scrollOffset.value,
      startSize,
      canShowStartShadow
    );

    return {
      opacity: normalOpacity,
    };
  });

  const endShadowStyle = useAnimatedStyle(() => {
    const contentOverflows = contentSize.value > containerSize.value;
    const normalOpacity = getEndShadowOpacity(
      containerSize.value,
      contentSize.value,
      scrollOffset.value,
      endSize,
      canShowEndShadow,
      contentOverflows
    );

    return {
      opacity: normalOpacity,
    };
  });

  const isAnimatedComponent = isAnimatedComponentType(child.type);

  const enhancedChild = isAnimatedComponent
    ? cloneElement(child, {
        onContentSizeChange: handleContentSizeChange,
        onLayout: handleLayout,
        onScroll,
        scrollEventThrottle,
      })
    : createElement(
        getAnimatedComponent(child.type as ScrollShadowComponentType),
        {
          ...childProps,
          onContentSizeChange: handleContentSizeChange,
          onLayout: handleLayout,
          onScroll,
          scrollEventThrottle,
        }
      );

  return (
    <View
      className={className}
      style={[scrollShadowStyles.root, style]}
      {...rest}
    >
      {enhancedChild}

      {orientation === "vertical" ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.topShadow,
              { height: startSize },
              startShadowStyle,
            ]}
          >
            <LinearGradient
              colors={startColors}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.bottomShadow,
              { height: endSize },
              endShadowStyle,
            ]}
          >
            <LinearGradient
              colors={endColors}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.leftShadow,
              { width: startSize },
              startShadowStyle,
            ]}
          >
            <LinearGradient
              colors={startColors}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              scrollShadowStyles.rightShadow,
              { width: endSize },
              endShadowStyle,
            ]}
          >
            <LinearGradient
              colors={endColors}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
};

export const ScrollShadow = (props: ScrollShadowProps) => {
  const {
    animation,
    children,
    className,
    color = DEFAULT_SCROLL_SHADOW_COLOR,
    bottomSize,
    isEnabled = true,
    isGesturePassthrough = false,
    leftSize,
    orientation: orientationProp,
    rightSize,
    size = DEFAULT_SCROLL_SHADOW_SIZE,
    style,
    topSize,
    visibility = "auto",
    ...rest
  } = props;
  const resolvedColor = useThemeColor(color);
  const child = isValidElement(children)
    ? (children as ReactElement<ScrollShadowChildProps>)
    : null;
  const hasCustomShadowSize =
    typeof bottomSize === "number" ||
    typeof leftSize === "number" ||
    typeof rightSize === "number" ||
    typeof topSize === "number";

  if (isGesturePassthrough && child) {
    return (
      <PassthroughScrollShadow
        bottomSize={bottomSize}
        child={child}
        className={className}
        isEnabled={isEnabled}
        leftSize={leftSize}
        orientation={orientationProp}
        resolvedColor={resolvedColor}
        rightSize={rightSize}
        size={size}
        style={style}
        topSize={topSize}
        visibility={visibility}
        {...rest}
      />
    );
  }

  if (hasCustomShadowSize && child) {
    return (
      <StandardScrollShadow
        bottomSize={bottomSize}
        child={child}
        className={className}
        isEnabled={isEnabled}
        leftSize={leftSize}
        orientation={orientationProp}
        resolvedColor={resolvedColor}
        rightSize={rightSize}
        size={size}
        style={style}
        topSize={topSize}
        visibility={visibility}
        {...rest}
      />
    );
  }

  return (
    <HeroScrollShadow
      animation={animation}
      className={className}
      color={resolvedColor}
      isEnabled={isEnabled}
      LinearGradientComponent={LinearGradient}
      orientation={orientationProp}
      size={size}
      style={style}
      visibility={visibility}
      {...rest}
    >
      {children}
    </HeroScrollShadow>
  );
};
