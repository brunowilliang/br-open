import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Description } from "heroui-native";
import { Card } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";

type KpiCardProps = {
  description?: string;
  icon: HugeiconsProps["icon"];
  label: string;
  tint?: "danger" | "default" | "warning";
  value: string;
};

export function KpiCard(props: KpiCardProps) {
  return (
    <Card className="flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <HugeIcons
          className={cn(
            "size-4",
            props.tint === "danger" ? "text-danger" : "text-muted"
          )}
          icon={props.icon}
        />
        <Description className="flex-1" numberOfLines={1}>
          {props.label}
        </Description>
      </View>
      <Text
        color={props.tint === "danger" ? "danger" : undefined}
        size="xl"
        weight="semibold"
      >
        {props.value}
      </Text>
      {props.description ? (
        <Description numberOfLines={2}>{props.description}</Description>
      ) : null}
    </Card>
  );
}
