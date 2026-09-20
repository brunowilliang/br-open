import { cn } from "better-styled";
import { Card, PressableFeedback } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";

type PersonCardProps = {
  children?: ReactNode;
  /** Nome do jogador. Sem nome/username, o card entra no estado vazio. */
  fullName?: string;
  isSelected?: boolean;
  username?: string;
};

/**
 * Cardzinho de pessoa (IBX-0074 round 11): foto + nome + @username,
 * extraído VERBATIM do registration-footer (trigger do autocomplete e
 * rows do diálogo, rounds 6-10). Sem nome/username = estado vazio com
 * placeholders no lugar dos dados (desenho do usuário sobre a extração).
 */
export function PersonCard(props: PersonCardProps) {
  if (!(props.fullName && props.username)) {
    return (
      <Card
        className={cn(
          "flex-row items-center gap-3",
          props.isSelected && "bg-accent-soft"
        )}
      >
        <Image className="size-10 rounded-full" fallback="black" />
        <View className="min-w-0 flex-1">
          <Text color="muted" numberOfLines={1} weight="semibold">
            Selecionar Parceiro
          </Text>
          <Text color="muted" numberOfLines={1} variant="description">
            Clique para adicionar
          </Text>
        </View>
        <PressableFeedback.Highlight />
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "flex-row items-center gap-3",
        props.isSelected && "bg-accent-soft"
      )}
    >
      <Image className="size-10 rounded-full" fallback="blue" />
      <View className="min-w-0 flex-1">
        <Text
          color={props.isSelected ? "accent" : "foreground"}
          numberOfLines={1}
          weight="semibold"
        >
          {props.fullName}
        </Text>
        <Text
          color={props.isSelected ? "accent" : "muted"}
          numberOfLines={1}
          variant="description"
        >
          @{props.username}
        </Text>
      </View>
      {props.children}
      <PressableFeedback.Highlight />
    </Card>
  );
}
