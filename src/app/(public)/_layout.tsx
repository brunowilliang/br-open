import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBackTitle: "Voltar",
        headerBackButtonDisplayMode: "minimal",
      }}
    />
  );
}
