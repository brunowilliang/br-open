import {
  Activity01Icon,
  Home01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import type { FloatingTabBarItem } from "@/components/navigation/floating-tab-bar";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

const TAB_BAR_ITEMS = [
  {
    icon: Home01Icon,
    label: "Home",
    value: "index",
  },
  {
    icon: Search01Icon,
    label: "Search",
    value: "search",
  },
  {
    icon: Activity01Icon,
    label: "Minha página",
    value: "activity",
  },
] as const satisfies readonly FloatingTabBarItem[];

export default function TabsLayout(): React.ReactElement {
  const backgroundColor = useThemeColor("background");

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}
      tabBar={(props) => <FloatingTabBar {...props} items={TAB_BAR_ITEMS} />}
    />
  );
}
