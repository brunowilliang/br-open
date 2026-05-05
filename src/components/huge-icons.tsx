import { HugeiconsIcon } from "@hugeicons/react-native";
import { withUniwind } from "uniwind";

export const HugeIcons = withUniwind(HugeiconsIcon, {
  width: { fromClassName: "className", styleProperty: "width" },
  height: { fromClassName: "className", styleProperty: "height" },
  color: { fromClassName: "className", styleProperty: "color" },
});
