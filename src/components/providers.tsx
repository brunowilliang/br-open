import { type HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaListener } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import { AppConvexProvider } from "@/lib/convex/convex-provider";

const heroUIConfig: HeroUINativeConfig = {
  devInfo: { stylingPrinciples: false },
  toast: {
    defaultProps: {
      placement: "top",
    },
    maxVisibleToasts: 3,
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaListener
      onChange={({ insets }) => {
        Uniwind.updateInsets(insets);
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <HeroUINativeProvider config={heroUIConfig}>
            <AppConvexProvider>{children}</AppConvexProvider>
          </HeroUINativeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
