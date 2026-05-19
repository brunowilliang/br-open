import "../global.css";

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "kitcn/react";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { Providers } from "@/components/providers";
import { useThemeColor } from "heroui-native";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <Providers>
      <Root />
    </Providers>
  );
}

function Root() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("background");
  const { isAuthenticated, isLoading } = useAuth();
  const [fontsLoaded, fontsError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const isAppReady = !isLoading && (fontsLoaded || fontsError);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isAppReady]);

  if (!isAppReady) {
    return null;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(private)" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(public)" options={{ animation: "fade" }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}
