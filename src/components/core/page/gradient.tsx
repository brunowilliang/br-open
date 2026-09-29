import { LinearGradient } from "expo-linear-gradient";
import { colorKit, useThemeColor } from "heroui-native";
import { StyleSheet } from "react-native";
import type { PageOverlayDirection } from "./blur";

type PageGradientOverlayProps = {
  direction: PageOverlayDirection;
};

/**
 * Gradient stand-in for the header blur: theme background fading to
 * transparent, same stops as the ScrollShadow edges.
 */
export const PageGradientOverlay = (props: PageGradientOverlayProps) => {
  const backgroundColor = useThemeColor("background");
  const opaqueColor = colorKit.setAlpha(backgroundColor, 1).hex();
  const transparentColor = colorKit.setAlpha(backgroundColor, 0).hex();
  const colors: readonly [string, string] =
    props.direction === "blurredTopClearBottom"
      ? [opaqueColor, transparentColor]
      : [transparentColor, opaqueColor];

  return <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />;
};
