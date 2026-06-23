import { Spinner } from "heroui-native";
import { View } from "react-native";

export const LoadingState = () => (
  <View
    accessibilityLabel="Carregando"
    accessibilityRole="progressbar"
    className="centered w-full bg-transparent p-4"
  >
    <Spinner />
  </View>
);
