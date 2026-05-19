import { router, Stack } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

export default function HomePublic() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 pt-safe">
        <Text>PUBLIC</Text>
        <Button onPress={() => router.navigate("/sign-in")}>
          Faça seu login
        </Button>
        <Button onPress={() => router.navigate("/sign-up")}>
          Crie a sua conta
        </Button>
      </View>
    </>
  );
}
