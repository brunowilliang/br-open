import { cn } from "better-styled";
import { Spinner } from "heroui-native";
import { View } from "react-native";

type LoadingStateProps = {
  isFull?: boolean;
  className?: string;
};

export const LoadingState = (props: LoadingStateProps) => (
  <View
    accessibilityLabel="Carregando"
    accessibilityRole="progressbar"
    className={cn("centered w-full p-4", props.className)}
  >
    <Spinner />
  </View>
);
