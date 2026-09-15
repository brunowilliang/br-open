import {
  Calendar03Icon,
  Edit02Icon,
  ExchangeIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { Button, Card, Chip, Menu } from "heroui-native";
import { Pressable, View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  canSwapMatch,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import {
  formatEntrySideLabel,
  getMatchStatusChip,
} from "@/lib/tournaments/tournament-details-derived";

export type BracketSwapTarget = {
  match: TournamentMatchWithSides;
  side: "a" | "b";
};

type BracketSideRowProps = {
  isSelected: boolean;
  isSwapEnabled: boolean;
  match: TournamentMatchWithSides;
  onSidePress: (target: BracketSwapTarget) => void;
  side: "a" | "b";
};

function BracketSideRow({
  isSelected,
  isSwapEnabled,
  match,
  onSidePress,
  side,
}: BracketSideRowProps) {
  const sideEntry = side === "a" ? match.entryA : match.entryB;
  const isWinner = sideEntry !== null && match.winnerEntryId === sideEntry.id;

  return (
    <Pressable
      disabled={!isSwapEnabled}
      onPress={() => {
        onSidePress({ match, side });
      }}
    >
      <View
        className={`flex-row items-center gap-1.5 rounded-lg px-1.5 py-1 ${
          isSelected ? "bg-accent-soft" : ""
        }`}
      >
        <View className="flex-row">
          <Image
            className="size-6 rounded-full"
            fallback="green"
            source={sideEntry?.playerA?.avatarUrl ?? undefined}
          />
          {sideEntry?.playerB ? (
            <Image
              className="-ml-2 size-6 rounded-full"
              fallback="blue"
              source={sideEntry.playerB.avatarUrl ?? undefined}
            />
          ) : null}
        </View>
        <Text
          className={`min-w-0 flex-1 ${isWinner ? "font-semibold text-accent" : ""}`}
          numberOfLines={1}
          size="sm"
        >
          {formatEntrySideLabel(sideEntry)}
        </Text>
        {match.score ? (
          <Text className="text-muted" size="sm">
            {match.score.sets
              .map((set) =>
                side === "a"
                  ? `${set.aGames}-${set.bGames}`
                  : `${set.bGames}-${set.aGames}`
              )
              .join(" ")}
          </Text>
        ) : null}
        {isSwapEnabled ? (
          <HugeIcons
            className={`size-4 ${isSelected ? "text-accent" : "text-muted"}`}
            icon={ExchangeIcon}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

type BracketMatchCardProps = {
  stageLabel: string;
  isFinal: boolean;
  isOrganizer: boolean;
  match: TournamentMatchWithSides;
  onEditResultPress: (match: TournamentMatchWithSides) => void;
  onHeightChange: (height: number) => void;
  onResultPress: (match: TournamentMatchWithSides) => void;
  onSchedulePress: (match: TournamentMatchWithSides) => void;
  onSidePress: (target: BracketSwapTarget) => void;
  scheduleSummary: null | string;
  selectedSide: "a" | "b" | null;
  swapDisabled: boolean;
};

export function BracketMatchCard({
  stageLabel,
  isFinal,
  isOrganizer,
  match,
  onEditResultPress,
  onHeightChange,
  onResultPress,
  onSchedulePress,
  onSidePress,
  scheduleSummary,
  selectedSide,
  swapDisabled,
}: BracketMatchCardProps) {
  const statusChip = getMatchStatusChip(match.status);
  const canSwap = isOrganizer && canSwapMatch(match) && !swapDisabled;
  const canAct =
    isOrganizer && match.entryAId !== null && match.entryBId !== null;

  return (
    <View
      onLayout={(event) => {
        onHeightChange(event.nativeEvent.layout.height);
      }}
    >
      <Card className="w-full gap-1.5 rounded-2xl p-2">
        <View className="flex-row items-center justify-between gap-1.5">
          <Text className="text-muted" numberOfLines={1} size="xs">
            {stageLabel}
          </Text>
          <View className="flex-row items-center gap-1">
            {/* Vacant (subárvore podada de um cabeça de chave): sem chip de
                status e sem ações — não é um jogo, é a moldura da chave
                (IBX-0035). */}
            {match.status === "vacant" ? null : isFinal &&
              match.winnerEntryId ? (
              <Chip className="self-center" color="accent" size="sm">
                Campeão
              </Chip>
            ) : (
              <Chip
                className="self-center"
                color={statusChip.color}
                size="sm"
                variant="soft"
              >
                {statusChip.label}
              </Chip>
            )}
            {canAct ? (
              <Menu>
                <Menu.Trigger asChild>
                  <Button
                    animation={{ scale: false }}
                    className="size-7"
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                  >
                    <HugeIcons className="size-4.5" icon={MoreVerticalIcon} />
                  </Button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Overlay className="bg-backdrop" />
                  <Menu.Content presentation="popover" width={240}>
                    {match.status === "finished" ? (
                      <Menu.Item
                        onPress={() => {
                          onEditResultPress(match);
                        }}
                      >
                        <Menu.ItemTitle>Editar resultado</Menu.ItemTitle>
                        <HugeIcons className="size-4.5" icon={Edit02Icon} />
                      </Menu.Item>
                    ) : (
                      <>
                        <Menu.Item
                          onPress={() => {
                            onSchedulePress(match);
                          }}
                        >
                          <Menu.ItemTitle>
                            {match.matchDate ? "Reagendar" : "Agendar"}
                          </Menu.ItemTitle>
                          <HugeIcons
                            className="size-4.5"
                            icon={Calendar03Icon}
                          />
                        </Menu.Item>
                        <Menu.Item
                          onPress={() => {
                            onResultPress(match);
                          }}
                        >
                          <Menu.ItemTitle>Resultado</Menu.ItemTitle>
                          <HugeIcons className="size-4.5" icon={Edit02Icon} />
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Content>
                </Menu.Portal>
              </Menu>
            ) : null}
          </View>
        </View>

        {scheduleSummary ? (
          <Text className="text-muted" numberOfLines={1} size="xs">
            {scheduleSummary}
          </Text>
        ) : null}

        <BracketSideRow
          isSelected={selectedSide === "a"}
          isSwapEnabled={canSwap}
          match={match}
          onSidePress={onSidePress}
          side="a"
        />
        <BracketSideRow
          isSelected={selectedSide === "b"}
          isSwapEnabled={canSwap}
          match={match}
          onSidePress={onSidePress}
          side="b"
        />
      </Card>
    </View>
  );
}
