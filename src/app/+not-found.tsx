import { router } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <View className="centered flex-1 gap-10 bg-background px-4">
      <View className="centered gap-1">
        <Text className="text-6xl leading-0">☹️</Text>
        <Text className="font-medium text-2xl text-accent">Page not found</Text>
        <Text className="font-medium text-muted text-xl">
          Oops, nothing to see here
        </Text>
      </View>
      <Button onPress={() => router.replace("/")}>Back to home</Button>
    </View>
  );
}
