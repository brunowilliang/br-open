import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

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
      tabBar={(props) => <FloatingTabBar {...props} />}
    />
  );
}
