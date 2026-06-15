import { DashedLineCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { styled } from "better-styled";
import { withUniwind } from "uniwind";

const HugeIconsUiwind = withUniwind(HugeiconsIcon, {
  position: { fromClassName: "className", styleProperty: "position" },
  top: { fromClassName: "className", styleProperty: "top" },
  right: { fromClassName: "className", styleProperty: "right" },
  width: { fromClassName: "className", styleProperty: "width" },
  height: { fromClassName: "className", styleProperty: "height" },
  color: { fromClassName: "className", styleProperty: "color" },
});

export const HugeIcons = styled(HugeIconsUiwind, {
  base: {
    icon: DashedLineCircleIcon,
    className: "size-5.5 text-foreground",
  },
});
