import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Card } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";

function CardIcon(props: { className?: string; icon: HugeiconsProps["icon"] }) {
  return (
    <View className="centered size-11 rounded-2xl bg-accent-soft">
      <HugeIcons
        className={cn("size-5 text-accent", props.className)}
        icon={props.icon}
      />
    </View>
  );
}

type WidgetCardProps = {
  children?: ReactNode;
  className?: string;
  description?: string;
  icon: HugeiconsProps["icon"];
  title: string;
};

export function WidgetCard(props: WidgetCardProps) {
  return (
    <Card className={props.className}>
      <CardIcon icon={props.icon} />
      <Card.Body className="mt-2">
        <Text className="font-semibold text-xl">{props.title}</Text>
        {props.description ? (
          <Text color="muted" variant="description">
            {props.description}
          </Text>
        ) : null}
        {props.children}
      </Card.Body>
    </Card>
  );
}
