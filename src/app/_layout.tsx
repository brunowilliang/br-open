import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { Providers } from "@/components/providers";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Messages" }} />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </Providers>
  );
}
