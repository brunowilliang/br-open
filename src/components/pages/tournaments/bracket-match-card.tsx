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
import { buildBracketScoreTokens } from "@/lib/tournaments/bracket-score-display";
import { BRACKET_BYE_CARD_HEIGHT } from "@/lib/tournaments/bracket-tree";
import {
  isByeMatch,
  type BracketSwapTarget,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import {
  formatEntrySideLabel,
  getMatchStatusChip,
} from "@/lib/tournaments/tournament-details-derived";

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
  const scoreTokens = match.score
    ? buildBracketScoreTokens(match.score.sets, side)
    : [];

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
            // lado "A definir" (sem inscrição): fallback PRETO; com entrada, azul
            fallback={sideEntry ? "blue" : "black"}
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
          // lado "A definir": rótulo muted (com entrada segue o default)
          color={sideEntry ? undefined : "muted"}
          numberOfLines={1}
          size="sm"
        >
          {formatEntrySideLabel(sideEntry)}
        </Text>
        {match.score ? (
          <View className="flex-row items-center gap-3.5">
            {scoreTokens.map((token, index) => (
              <View className="flex-row" key={index}>
                <Text
                  // estilo do número do set
                  color={token.isSetWinner ? "accent" : "muted"}
                  size="base"
                  weight={token.isSetWinner ? "bold" : "normal"}
                >
                  {token.games}
                </Text>
                {token.tieBreakPoints === null ? null : (
                  <Text
                    // estilo do tie-break sobrescrito
                    className="absolute -top-1.5 -right-1.5 text-[11px]"
                    color={token.isSetWinner ? "accent" : "muted"}
                    weight={token.isSetWinner ? "bold" : "normal"}
                  >
                    {token.tieBreakPoints}
                  </Text>
                )}
              </View>
            ))}
          </View>
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
  /** Por LADO: aceita a seleção corrente como origem (preenchido) ou destino. */
  swapPickEnabled: { a: boolean; b: boolean };
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
  swapPickEnabled,
}: BracketMatchCardProps) {
  // Vaga DERIVADA do sorteio (bye): o card existe VAZIO — nenhum filho, sem
  // fase, sem chip (o "W.O." leria como W.O. jogado e o "A definir" como
  // adversário que não existe), sem lado fantasma, sem seta e sem identidade.
  // O W.O. JOGADO de verdade é `finished` com `walkover: true` e cai no card
  // normal (isByeMatch). O container do card e a altura FIXA na constante do
  // layout ficam: o retângulo do grafo casa com o render por construção e a
  // âncora do conector não se move (a rota sai cedo no onHeightChange do bye).
  if (isByeMatch(match)) {
    return (
      <View
        onLayout={(event) => {
          onHeightChange(event.nativeEvent.layout.height);
        }}
      >
        <Card
          className="w-full justify-center rounded-2xl p-2"
          style={{ height: BRACKET_BYE_CARD_HEIGHT }}
        />
      </View>
    );
  }

  const statusChip = getMatchStatusChip(match.status);
  // A regra de quem pode ser origem ou destino mora na tela (bracket.tsx,
  // via o modelo puro de bracket-view): aqui só a apresentação do que ela
  // decidiu, LADO a LADO. Lado bloqueado não mostra a seta de troca.
  const swapEnabled = isOrganizer && !swapDisabled;
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
          isSwapEnabled={swapEnabled && swapPickEnabled.a}
          match={match}
          onSidePress={onSidePress}
          side="a"
        />
        <BracketSideRow
          isSelected={selectedSide === "b"}
          isSwapEnabled={swapEnabled && swapPickEnabled.b}
          match={match}
          onSidePress={onSidePress}
          side="b"
        />
      </Card>
    </View>
  );
}
