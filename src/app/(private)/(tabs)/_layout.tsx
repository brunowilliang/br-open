import type { FloatingTabBarItem } from "@/components/navigation/floating-tab-bar";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { getViewerMode } from "@/lib/actors/viewer-mode";
import { useCRPC } from "@/lib/convex/crpc";
import { Home01Icon, TrophyIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

/** O rótulo da home muda por modo; a LISTA de tabs é a mesma nos dois. */
const HOME_LABEL = { organization: "Dashboard", player: "Início" } as const;

export default function TabsLayout(): React.ReactElement {
  const backgroundColor = useThemeColor("background");
  const crpc = useCRPC();
  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const isOrganizationActor =
    getViewerMode(viewerContext.data?.activeActor) === "organization";

  const tabItems = [
    {
      icon: Home01Icon,
      label: isOrganizationActor ? HOME_LABEL.organization : HOME_LABEL.player,
      value: "index",
    },
    { icon: TrophyIcon, label: "Minhas Competições", value: "competitions" },
  ] as const satisfies readonly FloatingTabBarItem[];

  return (
    <Tabs
      backBehavior="history"
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}
      tabBar={(props) => <FloatingTabBar {...props} items={tabItems} />}
    >
      <Tabs.Screen name="index" />
      {/* Rota viva, fora da barra: entra pelo botão de buscar do header. */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="competitions" />
    </Tabs>
  );
}
