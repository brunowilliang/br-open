import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { useThemeColor, colorKit } from "heroui-native";
import { withUniwind } from "uniwind";

/**
 * uniwind-aware ProgressiveBlurView so className styling is supported.
 * Used by the header blur overlay.
 */
export const PageProgressiveBlurView = withUniwind(ProgressiveBlurView);

/**
 * Direction of a page edge overlay: the "blurred" edge is the opaque one
 * (frosted on the blur overlay, solid theme background on the gradient one),
 * the opposite edge is clear.
 */
export type PageOverlayDirection =
  | "blurredTopClearBottom"
  | "blurredBottomClearTop";

type PageBlurOverlayProps = {
  /**
   * Progressive blur direction — the page header uses
   * "blurredTopClearBottom".
   */
  direction: PageOverlayDirection;
};

/**
 * Progressive-blur overlay of the `PageHeader`.
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
