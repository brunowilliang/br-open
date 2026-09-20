import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Card, Skeleton } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  type InfoContent,
  InfoDialog,
  InfoTrigger,
} from "@/components/ui/info-dialog";

type KpiCardProps = {
  /** Elemento opcional à direita da linha do label (trend, botão de ação). */
  action?: React.ReactNode;
  description?: string;
  icon?: HugeiconsProps["icon"];
  /** Dialog de explicação (padrão compartilhado `info-dialog`). */
  info?: InfoContent;
  /** Mostra skeleton no lugar do valor enquanto a query carrega. */
  isLoading?: boolean;
  label: string;
  tint?: "danger" | "default" | "warning";
  value: string;
};

export function KpiCard(props: KpiCardProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <>
      <Card className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          {props.icon ? (
            <HugeIcons
              className={cn(
                "size-4",
                props.tint === "danger" ? "text-danger" : "text-muted"
              )}
              icon={props.icon}
            />
          ) : null}
          <Text
            className="flex-1"
            color={props.tint === "danger" ? "danger" : "muted"}
            variant="description"
            weight="medium"
          >
            {props.label}
          </Text>
          {props.info ? (
            <InfoTrigger
              onPress={() => {
                setIsInfoOpen(true);
              }}
              title={props.info.title}
            />
          ) : null}
          {props.action ? <View>{props.action}</View> : null}
        </View>
        {props.isLoading ? (
          <Skeleton className="h-8 w-28 rounded-xl" />
        ) : (
          <Text
            color={props.tint === "danger" ? "danger" : undefined}
            size="base"
            weight="semibold"
          >
            {props.value}
          </Text>
        )}
        {props.description ? (
          <Text
            color={props.tint === "danger" ? "danger" : "muted"}
            variant="description"
            weight="normal"
          >
            {props.description}
          </Text>
        ) : null}
      </Card>

      {props.info ? (
        <InfoDialog
          content={props.info}
          isOpen={isInfoOpen}
          onOpenChange={setIsInfoOpen}
        />
      ) : null}
    </>
  );
}
