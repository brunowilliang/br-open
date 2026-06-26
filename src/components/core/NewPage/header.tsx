import { cn } from "better-styled";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Header } from "../header";
import { PageBlurOverlay } from "./blur";
import { DEFAULT_HEADER_BLUR_DISTANCE } from "./constants";
import { usePageContext } from "./context";

type PageHeaderProps = ComponentProps<typeof Header> & {
  /**
   * When true, the header becomes a floating overlay and the scrollable
   * content scrolls underneath it from the top of the screen (y=0) — no
   * height is measured or applied. Useful for transparent hero headers
   * where content should show through behind the header.
   *
   * Default `false`: the header height is measured and applied as top
   * inset to the scrollable content, so content starts below the header.
   */
  overlay?: boolean;
};

export const PageHeader = (props: PageHeaderProps) => {
  const context = usePageContext();
  const { overlay = false, ...headerProps } = props;

  useEffect(() => {
    if (overlay) {
      return;
    }

    return () => {
      context.setHeaderHeight(0);
    };
  }, [context.setHeaderHeight, overlay]);

  const handleLayout = (
    event: Parameters<NonNullable<typeof headerProps.onLayout>>[0]
  ) => {
    if (!overlay) {
      context.setHeaderHeight(event.nativeEvent.layout.height);
    }
    headerProps.onLayout?.(event);
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
      {...headerProps}
      className={cn(
        "absolute z-50 w-full pt-safe-offset-4",
        headerProps.className
      )}
      onLayout={handleLayout}
      transparent={headerProps.transparent ?? true}
    >
      <Animated.View
        className="absolute inset-0"
        pointerEvents="none"
        style={[blurAnimatedStyle]}
      >
        <PageBlurOverlay direction="blurredTopClearBottom" prefix="header" />
      </Animated.View>

      {headerProps.children}
    </Header>
  );
};
