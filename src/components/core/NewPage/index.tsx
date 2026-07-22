import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { withSlots } from "better-styled";
import { router } from "expo-router";
import { Button } from "heroui-native";
import type { ComponentProps } from "react";
import { Header } from "../header";
import { PageFooter } from "./footer";
import { PageHeader } from "./header";
import { PageAnimatedLegendList } from "./legendlist";
import { PageKeyboardAwareScrollView, PageView } from "./scrollview";
import { PageRoot } from "./context";

export const BackButton = (props: ComponentProps<typeof Button>) => (
  <Button
    isIconOnly
    onPress={() => router.back()}
    size="sm"
    variant="ghost"
    {...props}
  >
    <Header.Icon icon={ArrowLeft01Icon} />
  </Button>
);

export const Page = withSlots(PageRoot, {
  Footer: PageFooter,
  Header: withSlots(PageHeader, {
    ...Header,
    BackButton,
  }),
  LegendList: PageAnimatedLegendList,
  ScrollView: PageKeyboardAwareScrollView,
  View: PageView,
});
