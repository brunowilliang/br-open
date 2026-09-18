import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { useThemeColor, colorKit } from "heroui-native";
import { withUniwind } from "uniwind";

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
};

/**
 * Shared progressive-blur overlay used by both PageHeader and PageFooter.
 */
export const PageBlurOverlay = (props: PageBlurOverlayProps) => {
  const fallbackColor = useThemeColor("background");
  const overlayColor = colorKit.setAlpha(fallbackColor, 0).hex();

  return (
    <PageProgressiveBlurView
      blurAmount={10}
      blurType="systemChromeMaterial"
      className="absolute inset-0"
      direction={props.direction}
      overlayColor={overlayColor}
      reducedTransparencyFallbackColor={fallbackColor}
    />
  );
};
