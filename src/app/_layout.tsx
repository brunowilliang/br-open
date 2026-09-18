import "../global.css";

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { Observe, ObserveRoot, useObserve } from "expo-observe";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useAuth } from "kitcn/react";
import { useEffect, useRef, useState } from "react";
import { useColorScheme } from "react-native";

import { NotificationBootstrap } from "@/components/notifications/notification-bootstrap";
import { Providers } from "@/components/providers";
import { useThemeColor } from "heroui-native";

SplashScreen.setOptions({
  duration: 500,
  fade: true,
});
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Module scope, before any screen mounts (toggling at runtime throws).
Observe.configure({
  integrations: { "expo-router": true },
});

function RootLayout() {
  return (
    <Providers>
      <Root />
    </Providers>
  );
}

export default ObserveRoot.wrap(RootLayout);

function Root() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("background");
  const { isAuthenticated, isLoading } = useAuth();
  const [hasResolvedAuth, setHasResolvedAuth] = useState(false);
  const lastAuthenticatedRef = useRef(false);
  const [fontsLoaded, fontsError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const effectiveIsAuthenticated =
    isLoading && hasResolvedAuth
      ? lastAuthenticatedRef.current
      : isAuthenticated;
  const { markInteractive } = useObserve();
  const isAppReady =
    (hasResolvedAuth || !isLoading) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    lastAuthenticatedRef.current = isAuthenticated;
    setHasResolvedAuth(true);
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().catch(() => undefined);
      markInteractive();
    }
  }, [isAppReady, markInteractive]);

  useEffect(() => {
    // Route transitions fade semi-transparent scenes over the native root
    // view. It defaults to white, so it must track the themed background.
    SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => undefined);
  }, [backgroundColor]);

  if (!isAppReady) {
    return null;
  }

  return (
    <>
      <Stack
        screenOptions={{
          animation: "fade",
          contentStyle: { backgroundColor },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={effectiveIsAuthenticated}>
          <Stack.Screen
            name="(private)"
            options={{ animation: "fade", contentStyle: { backgroundColor } }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!effectiveIsAuthenticated}>
          <Stack.Screen
            name="(public)"
            options={{ animation: "fade", contentStyle: { backgroundColor } }}
          />
        </Stack.Protected>
      </Stack>
      <NotificationBootstrap isEnabled={effectiveIsAuthenticated} />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}
