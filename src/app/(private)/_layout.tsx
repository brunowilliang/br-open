import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

// Without `initialRouteName`, the Stack has no default screen when the
// `Stack.Protected` guard in the root layout mounts this group after login.
// The only explicitly-declared `Stack.Screen` is `checkout/[chargeId]`, so
// React Navigation falls back to it as the first route — landing the user on
// the payment screen instead of the home tabs. Pinning `(tabs)` as the
// initial route makes the post-login landing deterministic.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function Layout() {
  const backgroundColor = useThemeColor("background");
  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{ contentStyle: { backgroundColor }, headerShown: false }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="checkout/[chargeId]"
        options={{
          // Checkout is reached from deeply nested routes (league detail
          // has its own Tabs navigator) and from flat routes (settings).
          // `presentation: "modal"` opens it as a full-screen overlay above
          // the current screen — the underlying navigator stays mounted, so
          // there's no "blink" from the nested Tabs/Stack unwinding before
          // the checkout fade opens.
          animation: "fade",
          presentation: "fullScreenModal",
        }}
      />
    </Stack>
  );
}
