import { cn } from "better-styled";
import { Card } from "heroui-native";
import { memo, type ReactNode } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";

export type StandingsCardItem = {
  avatarUrl?: null | string;
  id: string;
  name: string;
  nickname: string;
  position: number;
};

export type StandingsFormSlot = {
  /** Verde para a partida ganha, vermelha para a perdida. */
  outcome: "loss" | "win";
};

type StandingsCardProps = {
  /** Alça de arrasto pronta: quem monta a lista passa o botão já envolvido no handle do item. */
  dragHandle?: ReactNode;
  /**
   * Forma do jogador, uma bolinha por partida (mais antiga à esquerda) e `null`
   * nas não jogadas. Omitida desenha as 5 casas neutras; lista vazia não desenha.
   */
  form?: readonly (null | StandingsFormSlot)[];
  /** Item no meio do arrasto: o card sai com opacidade reduzida. */
  isDragging?: boolean;
  /** Item do próprio jogador que olha: avatar, posição e nome em accent. */
  isViewer?: boolean;
  item: StandingsCardItem;
  /** Ação da ponta, abaixo da forma (desafiar); ausente não desenha. */
  suffix?: ReactNode;
};

/** Cinco casas: o mesmo tamanho da forma que o servidor calcula. */
const NEUTRAL_FORM_SLOTS: readonly null[] = [null, null, null, null, null];

function StandingsCardImpl(props: StandingsCardProps) {
  const { item } = props;
  const formSlots = props.form ?? NEUTRAL_FORM_SLOTS;
  const form =
    formSlots.length > 0 ? (
      <View className="flex-row gap-1">
        {formSlots.map((slot, index) => (
          <View
            className={cn(
              "size-2.5 rounded-full",
              slot === null
                ? "bg-border"
                : slot.outcome === "win"
                  ? "bg-success"
                  : "bg-danger"
            )}
            key={index}
          />
        ))}
      </View>
    ) : null;
  const hasTrailing = Boolean(form) || Boolean(props.suffix);

  return (
    <Card className={cn("w-full p-3", props.isDragging ? "opacity-70" : "")}>
      <View className="flex-row items-center gap-3">
        <View className="centered flex-row gap-2">
          {props.dragHandle}
          <View>
            <Image
              alt={item.name}
              className={cn(
                "size-12 rounded-full",
                props.isViewer ? "border-2 border-accent" : ""
              )}
              source={item.avatarUrl}
            />
            <View
              className={cn(
                "centered absolute -top-1 -left-1 size-5.5 rounded-full border bg-surface-secondary",
                props.isViewer
                  ? "border-accent bg-accent"
                  : "border-separator bg-surface-secondary"
              )}
            >
              <Text
                className={cn(
                  "font-bold text-xs",
                  props.isViewer
                    ? "text-accent-foreground"
                    : "text-surface-tertiary-foreground"
                )}
              >
                {item.position}
              </Text>
            </View>
          </View>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            className={cn("text-base", props.isViewer ? "text-accent" : "")}
            numberOfLines={1}
            weight="semibold"
          >
            {item.name}
          </Text>
          <Text color="muted" numberOfLines={1} variant="description">
            {item.nickname}
          </Text>
        </View>
        {hasTrailing ? (
          <View className="items-end gap-2">
            {form}
            {props.suffix}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export const StandingsCard = memo(StandingsCardImpl);
