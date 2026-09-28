import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

import { MatchAgreementHost } from "@/components/pages/tournaments/match-agreement-provider";

// Without `initialRouteName`, React Navigation falls back to the only
// explicitly-declared `Stack.Screen` — `checkout/[chargeId]` — as first route
// when this group mounts after login, landing the user on the payment screen.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function Layout() {
  const backgroundColor = useThemeColor("background");
  // O COMBINAR JOGO é um só para o app inteiro (folha e diálogos inclusive): o
  // jogador combina na home e dentro do torneio, e cada card diz de qual
  // torneio é o jogo.
  return (
    <MatchAgreementHost>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          contentStyle: { backgroundColor },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="checkout/[chargeId]"
          options={{
            // `presentation: "modal"` opens a full-screen overlay above the
            // current screen: the underlying navigator stays mounted, so deeply
            // nested Tabs/Stack don't unwind and blink before the fade opens.
            animation: "fade",
            presentation: "fullScreenModal",
          }}
        />
      </Stack>
    </MatchAgreementHost>
  );
}
