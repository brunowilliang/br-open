import { router } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";

export default function NotFound() {
  return (
    <View className="centered flex-1 gap-10 bg-background px-4">
      <View className="centered gap-1">
        <Text className="text-6xl leading-0">☹️</Text>
        <Text color="accent" size="2xl" weight="medium">
          Página não encontrada
        </Text>
        <Text color="muted" size="xl" weight="medium">
          Não tem nada aqui.
        </Text>
      </View>
      <Button onPress={() => router.replace("/")}>Voltar para o início</Button>
    </View>
  );
}
