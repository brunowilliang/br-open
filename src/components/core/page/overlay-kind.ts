import type { PlatformOSType } from "react-native";

export type PageOverlayKind = "blur" | "gradient";

export const getPageOverlayKind = (
  platform: PlatformOSType
): PageOverlayKind => (platform === "android" ? "gradient" : "blur");
