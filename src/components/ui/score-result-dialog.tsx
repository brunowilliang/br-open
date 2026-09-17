import {
  Add01Icon,
  Cancel01Icon,
  WalkingIcon,
} from "@hugeicons/core-free-icons";
import {
  AccordionLayoutTransition,
  Button,
  Description,
  Dialog,
  Menu,
} from "heroui-native";
import { NumberStepper } from "heroui-native-pro";
import { useEffect, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { HugeIcons } from "@/components/ui/huge-icons";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import {
  buildEmptyDraftSet,
  buildScoreboard,
  canAttachTieBreak,
  getLineLabel,
  settleAttachedTieBreak,
  trimTrailingBlankSets,
  type ScoreDraftSet,
  type ScoreDraftSide,
} from "@/lib/matches/score-draft";
import { EmptyState } from "./empty-state";

/** Valor normalizado submetido pelo dialog — os domínios adaptam o payload. */
export type ScoreResultDialogValue = {
  sets: ScoreDraftSet[];
  walkover: boolean;
  /**
   * Vencedor EXPLÍCITO do payload: preenchido só quando as linhas não
   * decidem (escolha no "Quem venceu?") ou em W.O. (escolha obrigatória);
   * null quando o placar decide — o backend deriva das linhas.
   */
  explicitWinnerId: null | string;
};

type ScoreResultDialogProps = {
  initialSets?: ScoreDraftSet[];
  isOpen: boolean;
  isPending?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: (value: ScoreResultDialogValue) => Promise<void> | void;
  sideAId: string;
  sideAName: string;
  sideBId: string;
  sideBName: string;
  title: string;
  /** W.O. existe só no torneio (delta deliberado do BUG-0010). */
  walkoverEnabled?: boolean;
};

// Molde das transições do rule-card (IBX-0034: famílias FadeIn/FadeOut +
// AccordionLayoutTransition para linhas e sub-linhas de tie-break).
const LINE_ENTERING = FadeIn.duration(180);
const LINE_EXITING = FadeOut.duration(120);

/**
 * Teto do corpo scrollável do dialog — mesmo valor do precedente do repo
 * (selects/challenge-proposal: 450), limitado à metade da janela para não
 * estourar a tela em aparelhos pequenos.
 */
const SCROLL_MAX_HEIGHT = 450;

type SideStepperRowProps = {
  isDisabled: boolean;
  onChange: (side: ScoreDraftSide, value: number) => void;
  sideAGames: number;
  sideALabel: string;
  sideBGames: number;
  sideBLabel: string;
};

/** Par de steppers 0-99 dos dois lados, com os nomes aprovados em cima. */
function SideStepperRow(props: SideStepperRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 items-center gap-2">
        <Text
          className="text-center"
          numberOfLines={1}
          size="xs"
          weight="semibold"
        >
          {props.sideALabel}
        </Text>
        <NumberStepper
          className="self-center"
          defaultValue={props.sideAGames}
          isDisabled={props.isDisabled}
          maxValue={99}
          minValue={0}
          onValueChange={(nextValue) => {
            props.onChange("a", nextValue);
          }}
          step={1}
          value={props.sideAGames}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
      </View>

      <Text className="text-muted" weight="bold">
        x
      </Text>

      <View className="flex-1 items-center gap-2">
        <Text
          className="text-center"
          numberOfLines={1}
          size="xs"
          weight="semibold"
        >
          {props.sideBLabel}
        </Text>
        <NumberStepper
          className="self-center"
          defaultValue={props.sideBGames}
          isDisabled={props.isDisabled}
          maxValue={99}
          minValue={0}
          onValueChange={(nextValue) => {
            props.onChange("b", nextValue);
          }}
          step={1}
          value={props.sideBGames}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
      </View>
    </View>
  );
}

type ScoreLineRowProps = {
  isDisabled: boolean;
  label: string;
  line: ScoreDraftSet;
  onAddTieBreak: () => void;
  onRemove: () => void;
  onRemoveTieBreak: () => void;
  onUpdate: (next: ScoreDraftSet) => void;
  sideAName: string;
  sideBName: string;
};

/**
 * Uma linha da lista livre: placar (par de steppers) ou tie-break avulso.
 * "Tie-break" dentro da linha anexa o mini-placar daquela linha com o gate
 * contextual do placar (canAttachTieBreak, DEC-0005); linha de tie-break
 * nunca oferece o botão (sem aninhamento). O menu de adicionar linhas segue
 * livre em qualquer estado (RUL-0019).
 */
function ScoreLineRow(props: ScoreLineRowProps) {
  const tieBreak = props.line.tieBreak;

  return (
    <Animated.View
      className="gap-1 rounded-2xl bg-surface-secondary p-1"
      entering={LINE_ENTERING}
      exiting={LINE_EXITING}
      layout={AccordionLayoutTransition}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="pl-3" variant="label">
          {props.label}
        </Text>

        <View className="flex-row items-center gap-2">
          <Button
            accessibilityLabel="Remover linha"
            className="size-8"
            isDisabled={props.isDisabled}
            isIconOnly
            onPress={props.onRemove}
            variant="ghost"
          >
            <HugeIcons className="size-4" icon={Cancel01Icon} />
          </Button>
        </View>
      </View>

      <View className="rounded-xl bg-surface p-3">
        <SideStepperRow
          isDisabled={props.isDisabled}
          onChange={(side, value) => {
            props.onUpdate({
              ...props.line,
              [side === "a" ? "aGames" : "bGames"]: value,
            });
          }}
          sideAGames={props.line.aGames}
          sideALabel={props.sideAName}
          sideBGames={props.line.bGames}
          sideBLabel={props.sideBName}
        />

        {!tieBreak && canAttachTieBreak(props.line) ? (
          <Animated.View
            className="mt-3 self-center"
            entering={LINE_ENTERING}
            exiting={LINE_EXITING}
            layout={AccordionLayoutTransition}
          >
            <Button
              isDisabled={props.isDisabled}
              onPress={props.onAddTieBreak}
              size="sm"
              variant="secondary"
            >
              <HugeIcons className="size-4 text-accent" icon={Add01Icon} />
              <Button.Label className="text-accent">Tie-break</Button.Label>
            </Button>
          </Animated.View>
        ) : null}

        {tieBreak ? (
          <Animated.View
            className="mt-3 gap-1"
            entering={LINE_ENTERING}
            exiting={LINE_EXITING}
            layout={AccordionLayoutTransition}
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="pl-3" variant="label">
                Tie-break
              </Text>

              <View className="flex-row items-center gap-2">
                <Button
                  accessibilityLabel="Remover tie-break"
                  className="size-8"
                  isDisabled={props.isDisabled}
                  isIconOnly
                  onPress={props.onRemoveTieBreak}
                  variant="ghost"
                >
                  <HugeIcons className="size-4" icon={Cancel01Icon} />
                </Button>
              </View>
            </View>

            <View className="rounded-xl bg-surface-secondary p-3">
              <SideStepperRow
                isDisabled={props.isDisabled}
                onChange={(side, value) => {
                  props.onUpdate({
                    ...props.line,
                    tieBreak: {
                      ...(tieBreak ?? { aPoints: 0, bPoints: 0 }),
                      ...(side === "a"
                        ? { aPoints: value }
                        : { bPoints: value }),
                    },
                  });
                }}
                sideAGames={tieBreak.aPoints}
                sideALabel={props.sideAName}
                sideBGames={tieBreak.bPoints}
                sideBLabel={props.sideBName}
              />
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/**
 * Dialog global de resultado de partida (RUL-0005/RUL-0019) — serve o
 * desafio da liga ("Lançar resultado") e a partida do torneio ("Lançar
 * resultado"/"Editar resultado"). Núcleo em lados A/B, sem nenhuma regra: o
 * resultado é uma lista livre de linhas na ordem em que o jogo aconteceu.
 * O dialog abre vazio com o botão "Adicionar" FIXO no topo (ao lado do X de
 * fechar, sempre visível, desabilitado durante o submit) que abre o menu:
 * "Adicionar set" (par de steppers 0-99), "Adicionar tie-break" (linha
 * avulsa, com 1+ set na lista) e "Registrar W.O.". Dentro da linha de
 * placar, o botão "Tie-break" (centralizado sob os steppers) só aparece
 * com o placar daquela linha empatado e além do 0x0 (DEC-0005) e anexa o
 * mini-placar — um por linha, remoção pelo X da sub-linha. O vencedor sai
 * da contagem crua de linhas vencidas (empate em games é decidido pelo TB
 * anexo); se as linhas empatam, "Quem venceu?" só aparece na hora de
 * salvar. O payload final é montado no onSubmit de cada tela (adaptadores
 * por domínio).
 */
export const ScoreResultDialog = (props: ScoreResultDialogProps) => {
  const {
    initialSets,
    isOpen,
    isPending,
    onOpenChange,
    onSubmit,
    sideAId,
    sideAName,
    sideBId,
    sideBName,
    title,
    walkoverEnabled = false,
  } = props;
  const { height: windowHeight } = useWindowDimensions();
  const [lines, setLines] = useState<ScoreDraftSet[]>([]);
  const [explicitWinnerSide, setExplicitWinnerSide] =
    useState<null | ScoreDraftSide>(null);
  const [isWinnerPickVisible, setIsWinnerPickVisible] = useState(false);
  const [isWalkoverMode, setIsWalkoverMode] = useState(false);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<null | string>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLines(trimTrailingBlankSets([...(initialSets ?? [])]));
    setExplicitWinnerSide(null);
    setIsWinnerPickVisible(false);
    setIsWalkoverMode(false);
    setWalkoverWinnerId(null);
    setErrorMessage("");
  }, [initialSets, isOpen]);

  const scoreboard = buildScoreboard(lines);
  const resolvedWinnerSide = scoreboard.winnerSide ?? explicitWinnerSide;
  const resolvedWinnerId =
    resolvedWinnerSide === "a"
      ? sideAId
      : resolvedWinnerSide === "b"
        ? sideBId
        : null;
  const isWalkover =
    walkoverEnabled && isWalkoverMode && walkoverWinnerId !== null;
  const submitWinnerId = isWalkover ? walkoverWinnerId : resolvedWinnerId;
  // Explícito apenas quando as linhas não decidem (ou em W.O.); placar
  // decidido manda null e o backend deriva dos vencedores de linha.
  const explicitWinnerId = isWalkover
    ? walkoverWinnerId
    : scoreboard.winnerSide
      ? null
      : resolvedWinnerId;
  const hasScoreLine = lines.some((line) => line.kind !== "tiebreak");
  const scrollMaxHeight = Math.min(
    SCROLL_MAX_HEIGHT,
    Math.round(windowHeight / 2)
  );
  const winnerPickVisible =
    isWinnerPickVisible &&
    !isWalkoverMode &&
    lines.length > 0 &&
    scoreboard.winnerSide === null;

  function updateLine(lineIndex: number, nextLine: ScoreDraftSet) {
    // BUG-0035: placar desempatou (ou voltou pro 0x0) com TB anexado, o
    // anexo sai sozinho; edição só dos pontos do TB preserva o placar.
    setLines(
      lines.map((line, index) =>
        index === lineIndex ? settleAttachedTieBreak(line, nextLine) : line
      )
    );
  }

  function addScoreLine() {
    setErrorMessage("");
    setLines([...lines, buildEmptyDraftSet("set")]);
  }

  function addTieBreakLine() {
    setErrorMessage("");
    setLines([...lines, buildEmptyDraftSet("tiebreak")]);
  }

  function removeLine(lineIndex: number) {
    setErrorMessage("");
    setLines(lines.filter((_, index) => index !== lineIndex));
  }

  function addAttachedTieBreak(lineIndex: number) {
    setErrorMessage("");
    updateLine(lineIndex, {
      ...lines[lineIndex],
      tieBreak: { aPoints: 0, bPoints: 0 },
    });
  }

  function removeAttachedTieBreak(lineIndex: number) {
    setErrorMessage("");
    updateLine(lineIndex, { ...lines[lineIndex], tieBreak: null });
  }

  function enterWalkoverMode() {
    setErrorMessage("");
    setIsWalkoverMode(true);
  }

  async function handleSubmit() {
    if (!isWalkoverMode && lines.length === 0) {
      setErrorMessage("Informe ao menos uma linha do resultado.");
      return;
    }

    if (!submitWinnerId) {
      if (isWalkoverMode) {
        setErrorMessage("Escolha quem vence por W.O.");
      } else {
        // Empate: o "Quem venceu?" só aparece na hora de salvar.
        setIsWinnerPickVisible(true);
      }

      return;
    }

    setErrorMessage("");
    await onSubmit({
      explicitWinnerId,
      sets: lines,
      walkover: isWalkover,
    } satisfies ScoreResultDialogValue);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        {/* Corpo com scroll interno: o drag-to-dismiss (default) brigaria
            com o gesto de rolagem — swipe desligado, fechamento pelo X. */}
        <Dialog.Content className="gap-4 p-5" isSwipeable={false}>
          <Dialog.Title>{title}</Dialog.Title>

          <View className="absolute top-4 right-4 z-100 flex-row items-center gap-2">
            <Menu>
              <Menu.Trigger asChild>
                <Button isDisabled={isPending} size="sm" variant="secondary">
                  <Button.Label>Adicionar</Button.Label>
                  <HugeIcons className="text-accent" icon={Add01Icon} />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Overlay className="bg-backdrop" />
                <Menu.Content presentation="popover" width={240}>
                  <Menu.Item onPress={addScoreLine}>
                    <Menu.ItemTitle>Adicionar set</Menu.ItemTitle>
                    <HugeIcons icon={Add01Icon} />
                  </Menu.Item>
                  {hasScoreLine ? (
                    <Menu.Item onPress={addTieBreakLine}>
                      <Menu.ItemTitle>Adicionar tie-break</Menu.ItemTitle>
                      <HugeIcons icon={Add01Icon} />
                    </Menu.Item>
                  ) : null}
                  {walkoverEnabled ? (
                    <Menu.Item onPress={enterWalkoverMode}>
                      <Menu.ItemTitle>Registrar W.O.</Menu.ItemTitle>
                      <HugeIcons icon={WalkingIcon} />
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu>

            <DialogCloseButton isDisabled={isPending} />
          </View>

          {isWalkoverMode ? (
            <View className="gap-3">
              <Description>Escolha quem vence por W.O.</Description>
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  isDisabled={isPending}
                  onPress={() => {
                    setWalkoverWinnerId(
                      walkoverWinnerId === sideAId ? null : sideAId
                    );
                  }}
                  variant={walkoverWinnerId === sideAId ? "secondary" : "ghost"}
                >
                  <Button.Label>{sideAName}</Button.Label>
                </Button>
                <Button
                  className="flex-1"
                  isDisabled={isPending}
                  onPress={() => {
                    setWalkoverWinnerId(
                      walkoverWinnerId === sideBId ? null : sideBId
                    );
                  }}
                  variant={walkoverWinnerId === sideBId ? "secondary" : "ghost"}
                >
                  <Button.Label>{sideBName}</Button.Label>
                </Button>
              </View>
              <Button
                isDisabled={isPending}
                onPress={() => {
                  setErrorMessage("");
                  setIsWalkoverMode(false);
                }}
                size="sm"
                variant="ghost"
              >
                <Button.Label>Voltar pro placar por sets</Button.Label>
              </Button>
            </View>
          ) : (
            <ScrollShadow
              color="surface"
              style={{ maxHeight: scrollMaxHeight }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Animated.View
                  className="gap-3"
                  layout={AccordionLayoutTransition}
                >
                  {lines.map((line, lineIndex) => (
                    <ScoreLineRow
                      isDisabled={Boolean(isPending)}
                      key={lineIndex}
                      label={getLineLabel(lines, lineIndex)}
                      line={line}
                      onAddTieBreak={() => {
                        addAttachedTieBreak(lineIndex);
                      }}
                      onRemove={() => {
                        removeLine(lineIndex);
                      }}
                      onRemoveTieBreak={() => {
                        removeAttachedTieBreak(lineIndex);
                      }}
                      onUpdate={(nextLine) => {
                        updateLine(lineIndex, nextLine);
                      }}
                      sideAName={sideAName}
                      sideBName={sideBName}
                    />
                  ))}

                  {lines.length === 0 ? (
                    <EmptyState
                      description="Adicione o resultado da partida para que a chave seja atualizada."
                      icon={null}
                      title="Nenhum resultado adicionado"
                    />
                  ) : null}

                  {winnerPickVisible ? (
                    <View className="gap-2">
                      <Text className="text-muted" variant="description">
                        Quem venceu?
                      </Text>
                      <View className="flex-row gap-2">
                        <Button
                          className="flex-1"
                          isDisabled={isPending}
                          onPress={() => {
                            setExplicitWinnerSide(
                              explicitWinnerSide === "a" ? null : "a"
                            );
                          }}
                          variant={
                            explicitWinnerSide === "a" ? "secondary" : "ghost"
                          }
                        >
                          <Button.Label>{sideAName}</Button.Label>
                        </Button>
                        <Button
                          className="flex-1"
                          isDisabled={isPending}
                          onPress={() => {
                            setExplicitWinnerSide(
                              explicitWinnerSide === "b" ? null : "b"
                            );
                          }}
                          variant={
                            explicitWinnerSide === "b" ? "secondary" : "ghost"
                          }
                        >
                          <Button.Label>{sideBName}</Button.Label>
                        </Button>
                      </View>
                    </View>
                  ) : null}
                </Animated.View>
              </ScrollView>
            </ScrollShadow>
          )}

          {errorMessage ? (
            <Text className="text-danger" size="xs">
              {errorMessage}
            </Text>
          ) : null}

          <View className="self-end">
            <Button
              isDisabled={
                isPending ||
                (isWalkoverMode
                  ? walkoverWinnerId === null
                  : lines.length === 0)
              }
              onPress={() => {
                handleSubmit().catch(() => undefined);
              }}
              size="sm"
            >
              <Button.Label>Salvar resultado</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
