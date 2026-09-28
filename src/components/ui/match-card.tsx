import {
  Button,
  Card,
  Chip,
  Menu,
  PressableFeedback,
  Separator,
} from "heroui-native";
import { memo, useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { formatMatchMonthDay } from "@/lib/format/date";
import { formatMinuteToHHMM } from "@/lib/format/time";
import {
  getMatchStatusChip,
  UNDEFINED_PLAYER_NAME,
} from "@/lib/matches/match-display";
import {
  buildBracketScoreTokens,
  type ScoreSet,
} from "@/lib/matches/score-display";
import { ExchangeIcon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons, type HugeIconGlyph } from "./huge-icons";

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

/** Item do menu ⋮ do card: a MESMA peça para o menu do PAPEL (organizador) e
 * para os verbos do acerto (jogador). Quem decide o que entra é o builder do
 * papel; o card só desenha. */
export type MatchCardMenuItem = {
  icon: HugeIconGlyph;
  /** Verbo destrutivo (Cancelar jogo, Recusar): rótulo e ícone em vermelho. */
  isDanger?: boolean;
  label: string;
  onPress: () => void;
};

/** Estado do acerto NO CHIP (padrão das ligas): o card não escreve frase. */
export type MatchCardAgreementChip = {
  color: "accent" | "default" | "success" | "warning";
  label: string;
  variant: "soft";
};

export type MatchCardAgreement = {
  chip: MatchCardAgreementChip | null;
  menuItems: readonly MatchCardMenuItem[];
  /** Horário NA MESA (proposta ainda não confirmada): ocupa o rodapé de
   * agendamento com a cor de atenção. */
  scheduleProposal: null | {
    courtName: null | string;
    matchDate: string;
    startMinute: number;
  };
  /** Placar NA MESA, no lugar do publicado e pintado como ele: o vencedor sai
   * accent + semibold, o perdedor muted. W.O. proposto vem sem sets e só com o
   * vencedor (o card desenha como o W.O. publicado). */
  scoreProposal: null | {
    sets: readonly ScoreSet[];
    walkoverWinner: "a" | "b" | null;
  };
};

export type MatchCardProps = {
  agreement?: MatchCardAgreement | null;
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
  /** Abre o menu já na montagem (a galeria de componentes mostra o menu de cada
   * estado sem toque). */
  isMenuDefaultOpen?: boolean;
  /** Modo seleção da agenda: o toque no card alterna a marcação e o card nasce
   * com a borda de selecionado. Sem `onCardLongPress` não existe superfície de
   * toque própria (o card segue como sempre foi). */
  isSelected?: boolean;
  /** Menu do PAPEL, montado pelo builder dele (`buildOrganizerMatchMenu` no
   * organizador, o acerto no jogador): o card só desenha o que chega. Sem item
   * nenhum o ⋮ não aparece. */
  menu?: readonly MatchCardMenuItem[] | null;
  /** Toque longo: o card entra no modo seleção da agenda. */
  onCardLongPress?: () => void;
  /** Toque no card DURANTE o modo seleção (marca/desmarca). */
  onCardPress?: () => void;
  /** Modalidade do LADO, que o card não consegue ver sozinho no lado vazio (a
   * vaga em aberto não tem parceiro para denunciar a dupla). Sem a prop vale a
   * inferência pelo parceiro, como antes; `singles` força um avatar e uma
   * linha, `doubles` força o par de avatares em TODA ponta. */
  modality?: "doubles" | "singles";
  /** Toque no LADO: só chega com o lado habilitado na troca de oponente. */
  onSidePress?: (side: "a" | "b") => void;
  /** Sets do confronto (challenger = lado A, challenged = lado B); ausente ou
   * vazio não desenha o ponto do resultado. */
  scoreSets?: null | ScoreSet[];
  /** Lado armado na troca de oponente (a tela decide; aqui é só a pintura). */
  selectedSide?: "a" | "b" | null;
  /** Fase da partida (chip do topo, à esquerda); ausente não desenha o chip. */
  stageLabel?: null | string;
  startMinute: number;
  /** Por LADO, como no chaveamento: liga a seta da troca de oponente. */
  swapPickEnabled?: { a: boolean; b: boolean };
  /** Lado (`a` = challenger, `b` = challenged) que venceu o W.O. jogado: o W.O.
   * (esta prop ou o status `walkover`, a agenda da liga) não desenha placar e pinta
   * o vencedor accent + semibold e o perdedor muted. Sem W.O., decidem os sets. */
  walkoverWinner?: "a" | "b" | null;
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
  // Proposta na mesa manda no rodapé (é a pergunta em aberto), com a cor de
  // atenção no lugar do cinza do agendamento confirmado. Sem quadra escolhida,
  // o slot da quadra não entra.
  const scheduleProposal = props.agreement?.scheduleProposal ?? null;
  const scheduleProposalLabels = scheduleProposal
    ? [
        formatMatchMonthDay(scheduleProposal.matchDate),
        formatMinuteToHHMM(scheduleProposal.startMinute),
        scheduleProposal.courtName,
      ].filter((label): label is string => Boolean(label))
    : null;
  const footerLabels = scheduleProposalLabels ?? scheduleLabels;
  const footerIsProposal = scheduleProposalLabels !== null;
  // W.O.: a prop dá o vencedor do jogo publicado e o acerto, o do W.O. proposto;
  // o status `walkover` é o W.O. sem vencedor no wire. O chip troca o
  // "Encerrado" do wire; status deliberado do caller passa.
  const walkoverWinner =
    props.walkoverWinner ??
    props.agreement?.scoreProposal?.walkoverWinner ??
    null;
  const chipStatus =
    walkoverWinner && props.matchStatus === "finished"
      ? "walkover"
      : props.matchStatus;
  const statusChip = chipStatus ? getMatchStatusChip(chipStatus) : null;
  // Só o "A definir" leva o text-muted no rótulo do chip; os outros estados
  // (agendado, encerrado, W.O.) ficam como estão.
  const statusLabelClassName =
    props.matchStatus === "pending" ? "text-muted" : undefined;

  // O card não decide item nenhum: ele desenha o menu do PAPEL (organizador ou
  // jogador) que chega pronto e, sem item, não desenha o ⋮.
  const menuItems = props.menu ?? [];
  const agreementItems = props.agreement?.menuItems ?? [];
  const agreementChip = props.agreement?.chip ?? null;
  const hasMenuActions = menuItems.length > 0 || agreementItems.length > 0;

  // Challenger é o lado A e challenged o lado B (mesma convenção das agendas);
  // o vencedor de cada set sai do próprio placar, com o tie-break desempatando.
  const isWalkover =
    walkoverWinner !== null || props.matchStatus === "walkover";
  // Placar publicado tem a prop; sem ela, o placar NA MESA ocupa o mesmo lugar e
  // pinta igual: o vencedor da proposta também é vencedor.
  const proposedSets = props.agreement?.scoreProposal?.sets ?? null;
  const isProposedScore =
    (props.scoreSets?.length ?? 0) === 0 && (proposedSets?.length ?? 0) > 0;
  const scoreSets = isProposedScore
    ? [...(proposedSets ?? [])]
    : props.scoreSets;
  const challengerScoreTokens =
    isWalkover || !scoreSets ? [] : buildBracketScoreTokens(scoreSets, "a");
  const challengedScoreTokens =
    isWalkover || !scoreSets ? [] : buildBracketScoreTokens(scoreSets, "b");

  // Os NOMES são do LADO: o par que venceu a partida fica em accent e semibold,
  // o que perdeu em muted e normal. O vencedor é o do W.O. quando ele vem
  // explícito e, jogada, sai da maioria dos sets; empate ou sem sets não pinta.
  const challengerSetsWon = challengerScoreTokens.filter(
    (token) => token.isSetWinner
  ).length;
  const challengedSetsWon = challengedScoreTokens.filter(
    (token) => token.isSetWinner
  ).length;
  const challengerTakesMatch = walkoverWinner
    ? walkoverWinner === "a"
    : challengerSetsWon > challengedSetsWon;
  const challengedTakesMatch = walkoverWinner
    ? walkoverWinner === "b"
    : challengedSetsWon > challengerSetsWon;
  const challengerColor = challengerTakesMatch
    ? "accent"
    : challengedTakesMatch
      ? "muted"
      : undefined;
  const challengedColor = challengedTakesMatch
    ? "accent"
    : challengerTakesMatch
      ? "muted"
      : undefined;
  const challengerWeight = challengerTakesMatch ? "semibold" : "normal";
  const challengedWeight = challengedTakesMatch ? "semibold" : "normal";

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
  // A seleção da agenda é um ANEL por FORA do card, animado: nasce e some
  // suave, sem mexer no layout (entrar/sair não desloca nada).
  const isSelectable = Boolean(props.onCardLongPress);
  const card = (
    <Card className="gap-3 p-3">
      <View className="flex-row items-center justify-between">
        {props.stageLabel ? (
          <Chip color="default" size="md" variant="soft">
            <Chip.Label className="text-muted">{props.stageLabel}</Chip.Label>
          </Chip>
        ) : null}
        <View className="flex-row items-center gap-2">
          {agreementChip ? (
            <Chip color={agreementChip.color} size="md" variant="soft">
              <Chip.Label>{agreementChip.label}</Chip.Label>
            </Chip>
          ) : statusChip ? (
            <Chip color={statusChip.color} size="md" variant="soft">
              <Chip.Label className={statusLabelClassName}>
                {statusChip.label}
              </Chip.Label>
            </Chip>
          ) : null}
          {hasMenuActions ? (
            <Menu isDefaultOpen={props.isMenuDefaultOpen}>
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
                  {menuItems.map((item) => (
                    <Menu.Item key={item.label} onPress={item.onPress}>
                      <Menu.ItemTitle
                        className={item.isDanger ? "text-danger" : undefined}
                      >
                        {item.label}
                      </Menu.ItemTitle>
                      <HugeIcons
                        className={
                          item.isDanger ? "size-4.5 text-danger" : "size-4.5"
                        }
                        icon={item.icon}
                      />
                    </Menu.Item>
                  ))}
                  {agreementItems.map((item) => (
                    <Menu.Item key={item.label} onPress={item.onPress}>
                      <Menu.ItemTitle
                        className={item.isDanger ? "text-danger" : undefined}
                      >
                        {item.label}
                      </Menu.ItemTitle>
                      <HugeIcons
                        className={
                          item.isDanger ? "size-4.5 text-danger" : "size-4.5"
                        }
                        icon={item.icon}
                      />
                    </Menu.Item>
                  ))}
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

      {footerLabels ? (
        <View className="flex-row items-center gap-2">
          <Chip
            className="flex-1 gap-2"
            color={footerIsProposal ? "accent" : "default"}
            size="md"
            variant="soft"
          >
            <Chip.Label
              className={footerIsProposal ? undefined : "text-muted"}
              numberOfLines={1}
            >
              {footerLabels.join("   |   ")}
            </Chip.Label>
          </Chip>
        </View>
      ) : null}
      {isSelectable ? (
        <MatchSelectionRing isSelected={Boolean(props.isSelected)} />
      ) : null}
      {isSelectable ? <PressableFeedback.Highlight /> : null}
    </Card>
  );

  if (!isSelectable) {
    return card;
  }

  return (
    <PressableFeedback
      onLongPress={props.onCardLongPress}
      onPress={props.onCardPress}
    >
      {card}
    </PressableFeedback>
  );
}

/**
 * Borda de seleção da agenda: um contorno accent POR DENTRO do card (o card e o
 * pressable cortam o que passa das bordas, então anel por fora aparecia
 * cortado), com opacidade animada pra entrar e sair suave. Não ocupa layout.
 */
export function MatchSelectionRing(props: { isSelected: boolean }) {
  const progress = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  useEffect(() => {
    progress.value = withTiming(props.isSelected ? 1 : 0, { duration: 180 });
  }, [props.isSelected, progress]);

  return (
    <Animated.View
      className="absolute inset-0 rounded-3xl border-2 border-accent"
      pointerEvents="none"
      style={ringStyle}
    />
  );
}

export const MatchCard = memo(MatchCardImpl);
