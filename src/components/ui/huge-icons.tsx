import { HugeiconsIcon } from "@hugeicons/react-native";
import { styled } from "better-styled";
import { withUniwind } from "uniwind";

const HugeIconsUiwind = withUniwind(HugeiconsIcon, {
  width: { fromClassName: "className", styleProperty: "width" },
  height: { fromClassName: "className", styleProperty: "height" },
  color: { fromClassName: "className", styleProperty: "color" },
});

export const HugeIcons = styled(HugeIconsUiwind, {
  base: {
    className: "size-5.5 text-foreground",
  },
});
