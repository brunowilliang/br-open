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
  isValidElement,
  type ReactElement,
  useCallback,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

type ScrollShadowProps = Omit<
  HeroScrollShadowProps,
  "LinearGradientComponent" | "color"
> & {
  color?: ThemeColor;
  isGesturePassthrough?: boolean;
};

const DEFAULT_SCROLL_SHADOW_COLOR = "background";
const DEFAULT_SCROLL_SHADOW_SIZE = 56;

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
  onScrollOffsetChange?: (offset: number) => void;
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
    orientation: orientationProp,
    resolvedColor,
    size = DEFAULT_SCROLL_SHADOW_SIZE,
    style,
    visibility = "auto",
    ...rest
  } = props;
  const childProps = child.props;
  const orientation =
    orientationProp ?? (childProps.horizontal ? "horizontal" : "vertical");
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
      size,
      canShowStartShadow
    );
    const dragOpacity =
      animValues && canShowStartShadow
        ? getDragStartShadowOpacity(
            animValues.activeCellSize.value,
            animValues.activeIndexAnim.value,
            animValues.hoverOffset.value,
            scrollOffset.value,
            size
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
      size,
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
            size
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
              { height: size },
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
              { height: size },
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
              { width: size },
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
              { width: size },
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
    isEnabled = true,
    isGesturePassthrough = false,
    orientation: orientationProp,
    size = DEFAULT_SCROLL_SHADOW_SIZE,
    style,
    visibility = "auto",
    ...rest
  } = props;
  const resolvedColor = useThemeColor(color);
  const child = isValidElement(children)
    ? (children as ReactElement<ScrollShadowChildProps>)
    : null;

  if (isGesturePassthrough && child) {
    return (
      <PassthroughScrollShadow
        child={child}
        className={className}
        isEnabled={isEnabled}
        orientation={orientationProp}
        resolvedColor={resolvedColor}
        size={size}
        style={style}
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
