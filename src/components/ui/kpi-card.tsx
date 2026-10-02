import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Card, PressableFeedback, Skeleton } from "heroui-native";
import { type ReactNode, useState } from "react";
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
  /** Toque no card: entra o feedback da casa (press + highlight). */
  onPress?: () => void;
  tint?: "danger" | "default" | "warning";
  /** Texto do valor; um nó entra cru (ex.: chip com a cor do estado). */
  value: ReactNode;
};

export function KpiCard(props: KpiCardProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const cardBody = (
    <>
      <View className="flex-1 gap-1">
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
            numberOfLines={1}
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
        </View>
        {props.isLoading ? (
          <Skeleton className="h-6 w-28 rounded-xl" />
        ) : typeof props.value === "string" ? (
          <Text
            color={props.tint === "danger" ? "danger" : undefined}
            size="base"
            weight="semibold"
          >
            {props.value}
          </Text>
        ) : (
          props.value
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
      </View>
      {props.action ? <View>{props.action}</View> : null}
    </>
  );

  return (
    <>
      {props.onPress ? (
        <PressableFeedback className="flex-1" onPress={props.onPress}>
          <Card className="flex-1 flex-row items-center gap-1">
            {cardBody}
            <PressableFeedback.Highlight />
          </Card>
        </PressableFeedback>
      ) : (
        <Card className="flex-1 flex-row items-center gap-1">{cardBody}</Card>
      )}

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
