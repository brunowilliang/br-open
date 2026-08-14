import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Description, Skeleton } from "heroui-native";
import { Card } from "heroui-native";
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
  /** Tamanho do valor: `sm` = xl (padrão), `md` = 2xl, `lg` = 3xl. */
  size?: "sm" | "md" | "lg";
  tint?: "danger" | "default" | "warning";
  value: string;
};

const VALUE_SIZE = {
  lg: "3xl",
  md: "2xl",
  sm: "xl",
} as const;

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
          <Description className="flex-1" numberOfLines={1}>
            {props.label}
          </Description>
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
            size={VALUE_SIZE[props.size ?? "sm"]}
            weight="semibold"
          >
            {props.value}
          </Text>
        )}
        {props.description ? (
          <Description numberOfLines={2}>{props.description}</Description>
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
