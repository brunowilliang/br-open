import { cn } from "better-styled";
import { Eraser01Icon } from "@hugeicons/core-free-icons";
import { Card, PressableFeedback } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";

type KeyProps = {
  value?: string;
  className?: string;
  render?: ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  flex?: number;
};

function Key({
  value,
  className,
  render,
  onPress,
  isDisabled,
  flex,
}: KeyProps) {
  return (
    <PressableFeedback
      className="flex-1"
      isDisabled={isDisabled}
      onPress={onPress}
      style={flex ? { flex } : undefined}
    >
      <Card
        className={cn(
          "h-16 items-center justify-center rounded-3xl",
          className
        )}
      >
        {render ?? (
          <Text size="2xl" weight="medium">
            {value}
          </Text>
        )}
        <PressableFeedback.Highlight />
      </Card>
    </PressableFeedback>
  );
}

type KeyboardProps = {
  onKeyPress: (value: string) => void;
  isEmpty?: boolean;
};

export function Keyboard({ onKeyPress, isEmpty }: KeyboardProps) {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ] as const;

  return (
    <View className="w-full gap-2 pt-4">
      {rows.map((row, rowIndex) => (
        <View className="flex-row gap-2" key={rowIndex}>
          {row.map((keyValue) => (
            <Key
              className="bg-surface"
              key={keyValue}
              onPress={() => onKeyPress(keyValue)}
              value={keyValue}
            />
          ))}
        </View>
      ))}

      <View className="flex-row gap-2">
        <Key
          className="bg-surface"
          flex={2}
          onPress={() => onKeyPress("0")}
          value="0"
        />
        <Key
          className="bg-surface"
          isDisabled={isEmpty}
          onPress={() => onKeyPress("backspace")}
          render={
            <HugeIcons className="size-7 rotate-180" icon={Eraser01Icon} />
          }
        />
      </View>
    </View>
  );
}
