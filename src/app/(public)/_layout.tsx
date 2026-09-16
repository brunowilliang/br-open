import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function Layout() {
  const backgroundColor = useThemeColor("background");
  return (
    <Stack
      screenOptions={{ contentStyle: { backgroundColor }, headerShown: false }}
    />
  );
}
