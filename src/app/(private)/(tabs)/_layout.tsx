import {
  ChampionIcon,
  Home01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import type { FloatingTabBarItem } from "@/components/navigation/floating-tab-bar";
import { useCRPC } from "@/lib/convex/crpc";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useThemeColor } from "heroui-native";

const PLAYER_TAB_ITEMS = [
  {
    icon: Home01Icon,
    label: "Início",
    value: "index",
  },
  {
    icon: Search01Icon,
    label: "Buscar",
    value: "search",
  },
] as const satisfies readonly FloatingTabBarItem[];

const ORGANIZER_TAB_ITEMS = [
  {
    icon: Home01Icon,
    label: "Dashboard",
    value: "index",
  },
  {
    icon: ChampionIcon,
    label: "Ligas",
    value: "ligas",
  },
] as const satisfies readonly FloatingTabBarItem[];

export default function TabsLayout(): React.ReactElement {
  const backgroundColor = useThemeColor("background");
  const crpc = useCRPC();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const isOrganizationActor =
    viewerContext.data?.activeActor?.kind === "organization";

  const tabItems = isOrganizationActor ? ORGANIZER_TAB_ITEMS : PLAYER_TAB_ITEMS;

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}
      tabBar={(props) => <FloatingTabBar {...props} items={tabItems} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen
        name="search"
        options={{ href: isOrganizationActor ? null : undefined }}
      />
      <Tabs.Screen
        name="ligas"
        options={{ href: isOrganizationActor ? undefined : null }}
      />
    </Tabs>
  );
}
