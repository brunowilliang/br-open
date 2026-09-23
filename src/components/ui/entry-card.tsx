import { Card, Chip } from "heroui-native";
import { memo, type ReactNode } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { getEntryStatusChip } from "@/lib/tournaments/tournament-details-derived";

type EntryCardProps = {
  /** Categoria da inscrição (chip do topo, à esquerda); ausente não desenha. */
  categoryLabel?: null | string;
  /** Ações da inscrição (aprovar, responder convite, pagar): vão na ponta. */
  children?: ReactNode;
  /** Status da inscrição (`getEntryStatusChip`); ausente não desenha o chip. */
  entryStatus?: null | string;
  /** Nota do estado (convite, pagamento) no chip do pé; ausente não desenha. */
  noteLabel?: null | string;
  partnerAvatarUrl?: null | string;
  /** Parceiro da dupla: ausente = inscrição de simples (um avatar e um nome). */
  partnerName?: null | string;
  playerAvatarUrl?: null | string;
  playerName: string;
};

function EntryCardImpl(props: EntryCardProps) {
  const entryStatusChip = props.entryStatus
    ? getEntryStatusChip(props.entryStatus)
    : null;
  // O lado tem UM ou DOIS jogadores: com parceiro é dupla (dois avatares e um
  // nome por linha); sem parceiro é simples.
  const names = props.partnerName
    ? [props.playerName, props.partnerName]
    : [props.playerName];

  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-center justify-between">
        {props.categoryLabel ? (
          <Chip color="default" size="md" variant="soft">
            <Chip.Label>{props.categoryLabel}</Chip.Label>
          </Chip>
        ) : null}
        {entryStatusChip ? (
          <Chip color={entryStatusChip.color} size="md" variant="soft">
            <Chip.Label>{entryStatusChip.label}</Chip.Label>
          </Chip>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3">
        {props.partnerName ? (
          <View className="relative h-11 w-11">
            <Image
              className="absolute top-0 left-0 size-7.5 rounded-full border border-separator"
              fallback="green"
              source={props.playerAvatarUrl}
            />
            <Image
              className="absolute right-0 bottom-0 size-7.5 rounded-full border border-separator"
              fallback="blue"
              source={props.partnerAvatarUrl}
            />
          </View>
        ) : (
          <Image
            className="size-7.5 rounded-full"
            fallback="green"
            source={props.playerAvatarUrl}
          />
        )}
        <View className="min-w-0 flex-1">
          {names.map((name, index) => (
            <Text key={index} numberOfLines={1} weight="semibold">
              {name}
            </Text>
          ))}
        </View>
        {props.children}
      </View>

      {props.noteLabel ? (
        <View className="flex-row items-center gap-2">
          <Chip
            className="flex-1 gap-2"
            color="default"
            size="md"
            variant="soft"
          >
            <Chip.Label numberOfLines={1}>{props.noteLabel}</Chip.Label>
          </Chip>
        </View>
      ) : null}
    </Card>
  );
}

export const EntryCard = memo(EntryCardImpl);
