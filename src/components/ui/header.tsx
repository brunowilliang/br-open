import { cn, styled, withSlots } from "better-styled";
import { Text, View } from "react-native";
import { HugeIcons } from "../huge-icons";

const HeaderRoot = styled(View, {
  base: {
    className: cn(
      "flex-row items-center justify-between px-4 pb-4",
      "bg-linear-to-b from-40% from-background to-background/0"
    ),
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
    className: "text-base text-foreground font-semibold text-center",
  },
});

const HeaderSubTitle = styled(Text, {
  base: {
    className: "text-muted text-xs text-center",
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
