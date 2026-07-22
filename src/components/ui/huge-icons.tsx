import { DashedLineCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { styled } from "better-styled";
import { withUniwind } from "uniwind";

const HugeIconsUiwind = withUniwind(HugeiconsIcon, {
  color: { fromClassName: "className", styleProperty: "color" },
  height: { fromClassName: "className", styleProperty: "height" },
  position: { fromClassName: "className", styleProperty: "position" },
  right: { fromClassName: "className", styleProperty: "right" },
  top: { fromClassName: "className", styleProperty: "top" },
  width: { fromClassName: "className", styleProperty: "width" },
});

export const HugeIcons = styled(HugeIconsUiwind, {
  base: {
    className: "size-5.5 text-foreground",
    icon: DashedLineCircleIcon,
  },
});
