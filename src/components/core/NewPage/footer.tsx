import { cn } from "better-styled";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { PageBlurOverlay } from "./blur";
import { DEFAULT_FOOTER_BLUR_DISTANCE } from "./constants";
import { usePageContext } from "./context";

type PageFooterProps = ComponentProps<typeof View> & {
  isBlurred?: boolean;
};

export const PageFooter = (props: PageFooterProps) => {
  const { isBlurred = false, ...viewProps } = props;
  const context = usePageContext();

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

  return (
    <View
      {...viewProps}
      className={cn(
        "absolute bottom-0 z-50 w-full flex-row gap-3",
        isBlurred
          ? "overflow-visible"
          : "bg-linear-to-t from-background to-background/0",
        viewProps.className
      )}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      {isBlurred ? (
        <Animated.View
          className="absolute -top-12 right-0 bottom-0 left-0"
          pointerEvents="none"
          style={[blurAnimatedStyle]}
        >
          <PageBlurOverlay direction="blurredBottomClearTop" prefix="footer" />
        </Animated.View>
      ) : null}

      {viewProps.children}
    </View>
  );
};
