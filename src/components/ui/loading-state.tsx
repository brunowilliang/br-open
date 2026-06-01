import { Spinner } from "heroui-native";
import { View } from "react-native";

export const LoadingState = () => (
  <View className="centered w-full bg-transparent p-4">
    <Spinner />
  </View>
);
