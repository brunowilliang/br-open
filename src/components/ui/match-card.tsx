import {
  Button,
  Card,
  Chip,
  Menu,
  PressableFeedback,
  Separator,
} from "heroui-native";
import { memo } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";
import {
  buildBracketScoreTokens,
  type BracketScoreSet,
} from "@/lib/tournaments/bracket-score-display";
import {
  getMatchStatusChip,
  UNDEFINED_PLAYER_NAME,
} from "@/lib/tournaments/tournament-details-derived";
import {
  Calendar03Icon,
  Edit02Icon,
  ExchangeIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "./huge-icons";

/** Avatar do jogador indefinido: sem foto, o placeholder marca a vaga (o core
 * tem blue/green/white/black) e o par do lado em aberto fica todo black. */
const UNDEFINED_AVATAR_FALLBACK = "black";

type MatchSideLine = {
  color?: "accent" | "muted";
  name: string;
  weight: "normal" | "semibold";
};

/** Linhas do lado: uma por jogador. O lado indefinido é UMA linha (a dupla é
 * uma unidade) e sai muted; quem diz que ele está indefinido é o CALLER, nunca
 * o texto do nome. O parceiro em aberto é a segunda linha, também muted. */
function buildSideLines(input: {
  doubles: boolean;
  lineColor?: "accent" | "muted";
  lineWeight: "normal" | "semibold";
  name: string;
  partnerName?: null | string;
  undefinedSide: boolean;
}): MatchSideLine[] {
  if (input.undefinedSide) {
    return [{ color: "muted", name: input.name, weight: "normal" }];
  }

  const line: MatchSideLine = {
    color: input.lineColor,
    name: input.name,
    weight: input.lineWeight,
  };

  if (!input.doubles) {
    return [line];
  }

  return input.partnerName
    ? [
        line,
        {
          color: input.lineColor,
          name: input.partnerName,
          weight: input.lineWeight,
        },
      ]
    : [line, { color: "muted", name: UNDEFINED_PLAYER_NAME, weight: "normal" }];
}

type MatchCardProps = {
  challengedAvatarUrl?: string | null;
  /** Sinal EXPLÍCITO do lado sem jogador definido (a vaga em aberto da chave):
   * a linha sai muted e o avatar, `fallback="black"`. Ausente = lado definido;
   * os dois lados do card têm o seu, porque podem estar em estados diferentes. */
  challengedDefined?: boolean;
  challengedName: string;
  challengedPartnerAvatarUrl?: string | null;
  challengedPartnerName?: null | string;
  challengerAvatarUrl?: string | null;
  challengerDefined?: boolean;
  challengerName: string;
  challengerPartnerAvatarUrl?: string | null;
  challengerPartnerName?: null | string;
  courtName: string;
  /** Dia do jogo (`YYYY-MM-DD`) para a linha "data · hora · quadra"; sem ele
   * (ou sem quadra resolvida) a linha não é desenhada. */
  matchDate?: null | string;
  /** Status da partida (chip do topo, à direita) no vocabulário do chaveamento
   * (`getMatchStatusChip`); ausente não desenha o chip. */
  matchStatus?: null | string;
  /** Modalidade do LADO, que o card não consegue ver sozinho no lado vazio (a
   * vaga em aberto não tem parceiro para denunciar a dupla). Sem a prop vale a
   * inferência pelo parceiro, como antes; `singles` força um avatar e uma
   * linha, `doubles` força o par de avatares em TODA ponta. */
  modality?: "doubles" | "singles";
  /** Menu do organizador: ele só é DESENHADO onde há ação — sem nenhum destes
   * handlers (agendas e "Próximo jogo") o menu não aparece, e a partida
   * encerrada troca Agendar/Resultado por "Editar resultado". */
  onEditResultPress?: () => void;
  onResultPress?: () => void;
  onSchedulePress?: () => void;
  /** Toque no LADO: só chega com o lado habilitado na troca de oponente. */
  onSidePress?: (side: "a" | "b") => void;
  /** Sets do confronto (challenger = lado A, challenged = lado B); ausente ou
   * vazio não desenha o ponto do resultado. */
  scoreSets?: null | BracketScoreSet[];
  /** Lado armado na troca de oponente (a tela decide; aqui é só a pintura). */
  selectedSide?: "a" | "b" | null;
  /** Fase da partida (chip do topo, à esquerda); ausente não desenha o chip. */
  stageLabel?: null | string;
  startMinute: number;
  /** Por LADO, como no chaveamento: liga a seta da troca de oponente. */
  swapPickEnabled?: { a: boolean; b: boolean };
};

function MatchCardImpl(props: MatchCardProps) {
  // Chip de agendamento: "12 de set.   |   14:00   |   Quadra 2". Sem dia ou sem
  // quadra resolvida o chip não aparece.
  const scheduleLabels =
    props.matchDate && props.courtName
      ? [
          formatMatchMonthDay(props.matchDate),
          formatMinuteToHHMM(props.startMinute),
          props.courtName,
        ]
      : null;
  const statusChip = props.matchStatus
    ? getMatchStatusChip(props.matchStatus)
    : null;
  // Só o "A definir" leva o text-muted no rótulo do chip; os outros estados
  // (agendado, encerrado, W.O.) ficam como estão.
  const statusLabelClassName =
    props.matchStatus === "pending" ? "text-muted" : undefined;

  // O menu é do CARD e só é DESENHADO onde há ação: sem handler nenhum (agendas
  // e "Próximo jogo") ele não aparece. Encerrada, a ação é editar o resultado
  // já publicado; antes disso são agendar (ou reagendar) e publicar.
  const isFinished = props.matchStatus === "finished";
  const editResultAction = isFinished ? props.onEditResultPress : undefined;
  const resultAction = isFinished ? undefined : props.onResultPress;
  const scheduleAction = isFinished ? undefined : props.onSchedulePress;
  const hasMenuActions = Boolean(
    editResultAction || resultAction || scheduleAction
  );

  // Challenger é o lado A e challenged o lado B (mesma convenção das agendas);
  // o vencedor de cada set sai do próprio placar, com o tie-break desempatando.
  const challengerScoreTokens = props.scoreSets
    ? buildBracketScoreTokens(props.scoreSets, "a")
    : [];
  const challengedScoreTokens = props.scoreSets
    ? buildBracketScoreTokens(props.scoreSets, "b")
    : [];

  // Os NOMES são do LADO: o par que venceu a partida (maioria dos sets) fica em
  // accent e semibold, o que perdeu em muted e normal; empate (placar livre,
  // W.O. sem jogo) ou sem sets não pinta os nomes. Os NÚMEROS seguem o SET.
  const challengerSetsWon = challengerScoreTokens.filter(
    (token) => token.isSetWinner
  ).length;
  const challengedSetsWon = challengedScoreTokens.filter(
    (token) => token.isSetWinner
  ).length;
  const challengerColor =
    challengerSetsWon === challengedSetsWon
      ? undefined
      : challengerSetsWon > challengedSetsWon
        ? "accent"
        : "muted";
  const challengedColor =
    challengedSetsWon === challengerSetsWon
      ? undefined
      : challengedSetsWon > challengerSetsWon
        ? "accent"
        : "muted";
  const challengerWeight =
    challengerSetsWon > challengedSetsWon ? "semibold" : "normal";
  const challengedWeight =
    challengedSetsWon > challengerSetsWon ? "semibold" : "normal";

  // Troca de oponente (chaveamento): a tela habilita por lado e diz qual está
  // armado; aqui só a seta e a pintura do lado selecionado.
  const challengerSwapOn = props.swapPickEnabled?.a === true;
  const challengedSwapOn = props.swapPickEnabled?.b === true;
  const challengerSelected = props.selectedSide === "a";
  const challengedSelected = props.selectedSide === "b";

  // O lado tem UM ou DOIS jogadores: em duplas são dois avatares sobrepostos e
  // um nome por linha; em simples, um avatar e uma linha. A modalidade e o
  // jogador indefinido vêm de quem sabe (o lado vazio não tem parceiro para
  // denunciar a dupla): indefinido sai com a linha muted e o avatar black, um
  // por linha, porque os dois lados podem estar em estados diferentes.
  const challengerDoubles = props.modality
    ? props.modality === "doubles"
    : Boolean(props.challengerPartnerName);
  const challengedDoubles = props.modality
    ? props.modality === "doubles"
    : Boolean(props.challengedPartnerName);
  const challengerUndefined = props.challengerDefined === false;
  const challengedUndefined = props.challengedDefined === false;
  // O SEGUNDO avatar é o jogador 2: em aberto quando o parceiro não veio ou
  // quando o lado inteiro está indefinido (aí os dois avatares são vaga).
  const challengerPartnerOpen =
    challengerDoubles && !props.challengerPartnerName;
  const challengedPartnerOpen =
    challengedDoubles && !props.challengedPartnerName;
  const challengerLines = buildSideLines({
    doubles: challengerDoubles,
    lineColor: challengerColor,
    lineWeight: challengerWeight,
    name: props.challengerName,
    partnerName: props.challengerPartnerName,
    undefinedSide: challengerUndefined,
  });
  const challengedLines = buildSideLines({
    doubles: challengedDoubles,
    lineColor: challengedColor,
    lineWeight: challengedWeight,
    name: props.challengedName,
    partnerName: props.challengedPartnerName,
    undefinedSide: challengedUndefined,
  });
  const challengerAvatarFallback = challengerUndefined
    ? UNDEFINED_AVATAR_FALLBACK
    : "green";
  const challengedAvatarFallback = challengedUndefined
    ? UNDEFINED_AVATAR_FALLBACK
    : "green";
  const challengerPartnerAvatarFallback = challengerPartnerOpen
    ? UNDEFINED_AVATAR_FALLBACK
    : "blue";
  const challengedPartnerAvatarFallback = challengedPartnerOpen
    ? UNDEFINED_AVATAR_FALLBACK
    : "blue";

  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-center justify-between">
        {props.stageLabel ? (
          <Chip color="default" size="md" variant="soft">
            <Chip.Label className="text-muted">{props.stageLabel}</Chip.Label>
          </Chip>
        ) : null}
        <View className="flex-row items-center gap-2">
          {statusChip ? (
            <Chip color={statusChip.color} size="md" variant="soft">
              <Chip.Label className={statusLabelClassName}>
                {statusChip.label}
              </Chip.Label>
            </Chip>
          ) : null}
          {hasMenuActions ? (
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
                  {scheduleAction ? (
                    <Menu.Item onPress={scheduleAction}>
                      <Menu.ItemTitle>
                        {props.matchDate ? "Reagendar" : "Agendar"}
                      </Menu.ItemTitle>
                      <HugeIcons className="size-4.5" icon={Calendar03Icon} />
                    </Menu.Item>
                  ) : null}
                  {resultAction ? (
                    <Menu.Item onPress={resultAction}>
                      <Menu.ItemTitle>Resultado</Menu.ItemTitle>
                      <HugeIcons className="size-4.5" icon={Edit02Icon} />
                    </Menu.Item>
                  ) : null}
                  {editResultAction ? (
                    <Menu.Item onPress={editResultAction}>
                      <Menu.ItemTitle>Editar resultado</Menu.ItemTitle>
                      <HugeIcons className="size-4.5" icon={Edit02Icon} />
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu>
          ) : null}
        </View>
      </View>

      <PressableFeedback
        className={`flex-row items-center gap-3 rounded-lg ${
          challengerSelected ? "-m-1.5 rounded-2xl bg-accent-soft p-1.5" : ""
        }`}
        isDisabled={!challengerSwapOn}
        onPress={() => {
          props.onSidePress?.("a");
        }}
      >
        {challengerDoubles ? (
          <View className="relative h-11 w-11">
            <Image
              className="absolute top-0 left-0 size-7.5 rounded-full border border-separator"
              fallback={challengerAvatarFallback}
              source={props.challengerAvatarUrl}
            />
            <Image
              className="absolute right-0 bottom-0 size-7.5 rounded-full border border-separator"
              fallback={challengerPartnerAvatarFallback}
              source={props.challengerPartnerAvatarUrl}
            />
          </View>
        ) : (
          <Image
            className="size-7.5 rounded-full"
            fallback={challengerAvatarFallback}
            source={props.challengerAvatarUrl}
          />
        )}
        <View className="min-w-0 flex-1">
          {challengerLines.map((line, index) => (
            <Text
              color={line.color}
              key={index}
              numberOfLines={1}
              weight={line.weight}
            >
              {line.name}
            </Text>
          ))}
        </View>

        {/* resultado */}
        {challengerScoreTokens.length === 0 ? null : (
          <View className="flex-row items-center gap-3 pr-3">
            {challengerScoreTokens.map((token, index) => (
              <View className="flex-row" key={index}>
                <Text
                  color={token.isSetWinner ? "accent" : "muted"}
                  size="base"
                  weight={token.isSetWinner ? "bold" : "normal"}
                >
                  {token.games}
                </Text>
                {token.tieBreakPoints === null ? null : (
                  <Text
                    className="absolute -top-2 -right-2"
                    color={token.isSetWinner ? "accent" : "muted"}
                    size="xs"
                    weight={token.isSetWinner ? "bold" : "normal"}
                  >
                    {token.tieBreakPoints}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
        {challengerSwapOn ? (
          <View className="mr-2">
            <HugeIcons
              className={`size-4.5 ${
                challengerSelected ? "text-accent" : "text-muted"
              }`}
              icon={ExchangeIcon}
            />
          </View>
        ) : null}
      </PressableFeedback>

      <Separator />

      <PressableFeedback
        className={`flex-row items-center gap-3 rounded-lg ${
          challengedSelected ? "-m-1.5 rounded-2xl bg-accent-soft p-1.5" : ""
        }`}
        isDisabled={!challengedSwapOn}
        onPress={() => {
          props.onSidePress?.("b");
        }}
      >
        {challengedDoubles ? (
          <View className="relative h-11 w-11">
            <Image
              className="absolute top-0 left-0 size-7.5 rounded-full border border-separator"
              fallback={challengedAvatarFallback}
              source={props.challengedAvatarUrl}
            />
            <Image
              className="absolute right-0 bottom-0 size-7.5 rounded-full border border-separator"
              fallback={challengedPartnerAvatarFallback}
              source={props.challengedPartnerAvatarUrl}
            />
          </View>
        ) : (
          <Image
            className="size-7.5 rounded-full"
            fallback={challengedAvatarFallback}
            source={props.challengedAvatarUrl}
          />
        )}
        <View className="min-w-0 flex-1">
          {challengedLines.map((line, index) => (
            <Text
              color={line.color}
              key={index}
              numberOfLines={1}
              weight={line.weight}
            >
              {line.name}
            </Text>
          ))}
        </View>

        {/* resultado */}
        {challengedScoreTokens.length === 0 ? null : (
          <View className="flex-row items-center gap-3 pr-3">
            {challengedScoreTokens.map((token, index) => (
              <View className="flex-row" key={index}>
                <Text
                  color={token.isSetWinner ? "accent" : "muted"}
                  size="base"
                  weight={token.isSetWinner ? "bold" : "normal"}
                >
                  {token.games}
                </Text>
                {token.tieBreakPoints === null ? null : (
                  <Text
                    className="absolute -top-2 -right-2"
                    color={token.isSetWinner ? "accent" : "muted"}
                    size="xs"
                    weight={token.isSetWinner ? "bold" : "normal"}
                  >
                    {token.tieBreakPoints}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
        {challengedSwapOn ? (
          <View className="mr-2">
            <HugeIcons
              className={`size-4.5 ${
                challengedSelected ? "text-accent" : "text-muted"
              }`}
              icon={ExchangeIcon}
            />
          </View>
        ) : null}
      </PressableFeedback>

      {scheduleLabels ? (
        <View className="flex-row items-center gap-2">
          <Chip
            className="flex-1 gap-2"
            color="default"
            size="md"
            variant="soft"
          >
            <Chip.Label className="text-muted" numberOfLines={1}>
              {scheduleLabels.join("   |   ")}
            </Chip.Label>
          </Chip>
        </View>
      ) : null}
    </Card>
  );
}

export const MatchCard = memo(MatchCardImpl);
