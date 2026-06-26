import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { useThemeColor, colorKit } from "heroui-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { withUniwind } from "uniwind";
import { usePageContext } from "./context";

/**
 * uniwind-aware ProgressiveBlurView so className styling is supported.
 * Shared by the header and footer blur overlays.
 */
export const PageProgressiveBlurView = withUniwind(ProgressiveBlurView);

type PageBlurOverlayProps = {
  /**
   * Progressive blur direction.
   * - "blurredTopClearBottom" for headers (frosted at the top edge).
   * - "blurredBottomClearTop" for footers (frosted at the bottom edge).
   */
  direction: "blurredTopClearBottom" | "blurredBottomClearTop";
  /** Key prefix used for the remount key (`header-blur` / `footer-blur`). */
  prefix: string;
};

/**
 * Shared progressive-blur overlay used by both PageHeader and PageFooter.
 *
 * Encapsulates the blur restore animation (driven by `blurOpacity`), the
 * `isBlurMounted` remount gate, and the `blurViewKey`-based remount after
 * app background/foreground transitions. Previously this block was
 * duplicated between header and footer with only `direction`/key differing.
 */
export const PageBlurOverlay = (props: PageBlurOverlayProps) => {
  const context = usePageContext();
  const fallbackColor = useThemeColor("background");
  const overlayColor = colorKit.setAlpha(fallbackColor, 0).hex();

  const blurRestoreAnimatedStyle = useAnimatedStyle(() => ({
    opacity: context.blurOpacity.value,
  }));

  if (!context.isBlurMounted) {
    return null;
  }

  return (
    <Animated.View
      className="absolute inset-0"
      style={[blurRestoreAnimatedStyle]}
    >
      <PageProgressiveBlurView
        blurAmount={10}
        blurType="systemChromeMaterial"
        className="absolute inset-0"
        direction={props.direction}
        key={`${props.prefix}-blur-${context.blurViewKey}`}
        overlayColor={overlayColor}
        reducedTransparencyFallbackColor={fallbackColor}
      />
    </Animated.View>
  );
};
