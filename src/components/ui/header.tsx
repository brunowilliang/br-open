import { cn, styled, withSlots } from "better-styled";
import { View } from "react-native";
import { HugeIcons } from "./huge-icons";
import { Text } from "./text";

const HeaderRoot = styled(View, {
  base: {
    className: cn(
      "flex-row items-center justify-between px-4 pb-4",
      "bg-linear-to-b",
      "from-20% from-background/96",
      "via-60% via-background/80",
      "to-background/0"
      // "via-95% via-background/0",
    ),
  },
  variants: {
    transparent: {
      true: {
        className: cn(
          "flex-row items-center justify-between px-4 pb-4",
          "bg-linear-to-b",
          "from-20% from-background/0",
          "via-60% via-background/0",
          "to-background/0"
        ),
      },
    },
  },
});

const LeftFrame = styled(View, {
  base: {
    className: "h-full w-1/6 flex-row items-center justify-start",
  },
});

const CenterFrame = styled(View, {
  base: {
    className: "flex-1 items-center justify-center",
  },
});

const RightFrame = styled(View, {
  base: {
    className: "h-full w-1/6 flex-row items-center justify-end",
  },
});

const HeaderTitle = styled(Text, {
  base: {
    variant: "body",
    weight: "semibold",
  },
});

const HeaderSubTitle = styled(Text, {
  base: {
    variant: "description",
    color: "muted",
    numberOfLines: 2,
  },
});

const HeaderIcon = styled(HugeIcons, {});

export const Header = withSlots(HeaderRoot, {
  Left: LeftFrame,
  Center: CenterFrame,
  Right: RightFrame,
  Title: HeaderTitle,
  SubTitle: HeaderSubTitle,
  Icon: HeaderIcon,
});
