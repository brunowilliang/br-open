import {
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  TextField,
} from "heroui-native";
import { NumberStepper } from "heroui-native-pro";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import type { LeagueMatchConfig } from "@convex/domains/league/contract";

const SCORE_SET_PARTS_REGEX = /[-xX]/;

type ChallengeScoreSet = {
  challengerGames: number;
  challengedGames: number;
  kind: "set" | "super_tiebreak";
};

type ChallengeResultDialogValue = {
  sets: ChallengeScoreSet[];
  winnerMembershipId: string;
};

type ChallengeResultDialogProps = {
  challengedMembershipId: string;
  challengedName: string;
  challengerMembershipId: string;
  challengerName: string;
  initialScoreText?: string;
  initialWinnerMembershipId?: string;
  isOpen: boolean;
  isPending?: boolean;
  matchConfig: LeagueMatchConfig;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: (value: ChallengeResultDialogValue) => Promise<void> | void;
  title: string;
};

function getTieBreakSetValidationError(input: {
  gamesPerSet: number;
  loserGames: number;
  tieBreakAtGamesAll: number;
  winnerGames: number;
}) {
  if (input.loserGames <= input.gamesPerSet - 2) {
    return input.winnerGames === input.gamesPerSet
      ? null
      : `Com ${input.loserGames} games do adversário, o placar final deve ser ${input.gamesPerSet}x${input.loserGames}.`;
  }

  if (input.loserGames === input.gamesPerSet - 1) {
    return input.winnerGames === input.gamesPerSet + 1
      ? null
      : `Antes do tie-break, o set deve terminar em ${input.gamesPerSet + 1}x${input.loserGames}.`;
  }

  if (input.loserGames === input.tieBreakAtGamesAll) {
    return input.winnerGames === input.tieBreakAtGamesAll + 1
      ? null
      : `Com tie-break em ${input.tieBreakAtGamesAll}x${input.tieBreakAtGamesAll}, o placar final deve ser ${input.tieBreakAtGamesAll + 1}x${input.tieBreakAtGamesAll}.`;
  }

  return "Esse placar não respeita a regra do tie-break da liga.";
}

function getAdvantageSetValidationError(input: {
  gamesPerSet: number;
  loserGames: number;
  winnerGames: number;
}) {
  if (input.winnerGames - input.loserGames !== 2) {
    return "Sem tie-break, o vencedor precisa abrir 2 games de diferença.";
  }

  return input.winnerGames >= input.gamesPerSet
    ? null
    : `O vencedor precisa chegar a pelo menos ${input.gamesPerSet} games.`;
}

function getSetValidationError(input: {
  challengedGames: number;
  challengerGames: number;
  matchConfig: LeagueMatchConfig;
}) {
  const winnerGames = Math.max(input.challengerGames, input.challengedGames);
  const loserGames = Math.min(input.challengerGames, input.challengedGames);
  const gamesPerSet = input.matchConfig.gamesPerSet;
  const tieBreakAtGamesAll = input.matchConfig.tieBreakAtGamesAll;

  if (winnerGames < gamesPerSet) {
    return `O vencedor precisa chegar a pelo menos ${gamesPerSet} games.`;
  }

  if (!input.matchConfig.setMustWinByTwoGames) {
    return winnerGames === gamesPerSet
      ? null
      : `A partida deve terminar em ${gamesPerSet} games.`;
  }

  if (input.matchConfig.hasTieBreak) {
    return getTieBreakSetValidationError({
      gamesPerSet,
      loserGames,
      tieBreakAtGamesAll,
      winnerGames,
    });
  }

  return getAdvantageSetValidationError({
    gamesPerSet,
    loserGames,
    winnerGames,
  });
}

export const ChallengeResultDialog = (props: ChallengeResultDialogProps) => {
  const {
    challengedMembershipId,
    challengedName,
    challengerMembershipId,
    challengerName,
    initialScoreText,
    initialWinnerMembershipId,
    isOpen,
    isPending,
    matchConfig,
    onOpenChange,
    onSubmit,
    title,
  } = props;
  const [challengerGames, setChallengerGames] = useState(0);
  const [challengedGames, setChallengedGames] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialScoreText) {
      const [initialChallengerGames, initialChallengedGames] = initialScoreText
        .split(SCORE_SET_PARTS_REGEX)
        .map((item) => Number(item.trim()));

      setChallengerGames(
        Number.isNaN(initialChallengerGames) ? 0 : initialChallengerGames
      );
      setChallengedGames(
        Number.isNaN(initialChallengedGames) ? 0 : initialChallengedGames
      );
    } else {
      setChallengerGames(0);
      setChallengedGames(0);
    }

    setErrorMessage("");
  }, [initialScoreText, isOpen]);

  let winnerMembershipId: string | null = initialWinnerMembershipId ?? null;

  if (challengerGames > challengedGames) {
    winnerMembershipId = challengerMembershipId;
  } else if (challengedGames > challengerGames) {
    winnerMembershipId = challengedMembershipId;
  }

  async function handleSubmit() {
    if (challengerGames === challengedGames) {
      setErrorMessage("O placar não pode empatar.");
      return;
    }

    const setValidationError = getSetValidationError({
      challengedGames,
      challengerGames,
      matchConfig,
    });

    if (setValidationError) {
      setErrorMessage(setValidationError);
      return;
    }

    setErrorMessage("");
    await onSubmit({
      sets: [
        {
          challengerGames,
          challengedGames,
          kind: "set",
        },
      ],
      winnerMembershipId:
        winnerMembershipId === null
          ? challengerMembershipId
          : winnerMembershipId,
    });
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
        <Dialog.Content className="gap-4 p-5">
          {isPending ? null : (
            <Dialog.Close className="absolute top-4 right-4 z-100" />
          )}
          <Dialog.Title>{title}</Dialog.Title>
          <Description>Informe o placar da partida.</Description>

          <TextField isInvalid={Boolean(errorMessage)} isRequired>
            <Label>Placar</Label>
            <View className="gap-4 rounded-2xl bg-surface-secondary px-4 py-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 items-center gap-3">
                  <Text className="text-center" weight="semibold">
                    {challengerName}
                  </Text>
                  <NumberStepper
                    className="self-center"
                    defaultValue={challengerGames}
                    isDisabled={isPending}
                    maxValue={99}
                    minValue={0}
                    onValueChange={(nextValue) => {
                      setChallengerGames(nextValue);
                    }}
                    step={1}
                    value={challengerGames}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                </View>

                <Text className="text-muted" weight="bold">
                  x
                </Text>

                <View className="flex-1 items-center gap-3">
                  <Text className="text-center" weight="semibold">
                    {challengedName}
                  </Text>
                  <NumberStepper
                    className="self-center"
                    defaultValue={challengedGames}
                    isDisabled={isPending}
                    maxValue={99}
                    minValue={0}
                    onValueChange={(nextValue) => {
                      setChallengedGames(nextValue);
                    }}
                    step={1}
                    value={challengedGames}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                </View>
              </View>
            </View>
            <FieldError>{errorMessage}</FieldError>
          </TextField>

          <View className="self-end">
            <Button
              isDisabled={isPending}
              onPress={() => {
                handleSubmit().catch(() => undefined);
              }}
              size="sm"
            >
              <Button.Label>Salvar placar</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
