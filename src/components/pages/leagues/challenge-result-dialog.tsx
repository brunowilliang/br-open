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
import {
  buildChallengeScoreProgress,
  getExpectedSetKind,
  getRequiredSetWins,
  isChallengeScoreSetBlank,
  resolveChallengeScoreWinnerMembershipId,
  validateChallengeScore,
} from "@convex/domains/league/challenge-rules";
import type {
  LeagueChallengeScore,
  LeagueMatchConfig,
} from "@convex/domains/league/contract";

type ChallengeScoreSet = LeagueChallengeScore["sets"][number];

type ChallengeResultDialogValue = {
  sets: ChallengeScoreSet[];
  winnerMembershipId: string;
};

type ChallengeResultDialogProps = {
  challengedMembershipId: string;
  challengedName: string;
  challengerMembershipId: string;
  challengerName: string;
  initialScore?: ChallengeScoreSet[];
  isOpen: boolean;
  isPending?: boolean;
  matchConfig: LeagueMatchConfig;
  onOpenChange: (nextOpen: boolean) => void;
  onSubmit: (value: ChallengeResultDialogValue) => Promise<void> | void;
  title: string;
};

function buildEmptySet(
  matchConfig: LeagueMatchConfig,
  setIndex: number
): ChallengeScoreSet {
  return {
    challengedGames: 0,
    challengerGames: 0,
    kind: getExpectedSetKind(matchConfig, setIndex),
  };
}

function trimTrailingBlankSets(sets: ChallengeScoreSet[]) {
  const trimmedSets = [...sets];

  while (trimmedSets.length > 0) {
    const lastSet = trimmedSets.at(-1);

    if (!(lastSet && isChallengeScoreSetBlank(lastSet))) {
      break;
    }

    trimmedSets.pop();
  }

  return trimmedSets;
}

function pruneDraftSets(
  matchConfig: LeagueMatchConfig,
  draftSets: ChallengeScoreSet[]
) {
  const trimmedSets = trimTrailingBlankSets(draftSets);
  const progress = buildChallengeScoreProgress({
    matchConfig,
    sets: trimmedSets,
  });

  return progress.winnerSide
    ? trimmedSets.slice(0, progress.completedSetCount)
    : trimmedSets.slice(0, progress.visibleSetCount);
}

function getSetLabel(matchConfig: LeagueMatchConfig, setIndex: number) {
  return getExpectedSetKind(matchConfig, setIndex) === "super_tiebreak"
    ? "Super tie-break"
    : `Set ${setIndex + 1}`;
}

function getDialogDescription(matchConfig: LeagueMatchConfig) {
  const requiredSetWins = getRequiredSetWins(matchConfig.bestOfSets);
  const decidingSetDescription =
    matchConfig.bestOfSets > 1 && matchConfig.finalSetMode === "super_tiebreak"
      ? " Se precisar, o último set será um super tie-break."
      : "";

  return `Melhor de ${matchConfig.bestOfSets} sets. Vence quem fizer ${requiredSetWins} ${requiredSetWins === 1 ? "set" : "sets"} primeiro.${decidingSetDescription}`;
}

export const ChallengeResultDialog = (props: ChallengeResultDialogProps) => {
  const {
    challengedMembershipId,
    challengedName,
    challengerMembershipId,
    challengerName,
    initialScore,
    isOpen,
    isPending,
    matchConfig,
    onOpenChange,
    onSubmit,
    title,
  } = props;
  const [draftSets, setDraftSets] = useState<ChallengeScoreSet[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftSets(pruneDraftSets(matchConfig, [...(initialScore ?? [])]));
    setErrorMessage("");
  }, [initialScore, isOpen, matchConfig]);

  const trimmedDraftSets = trimTrailingBlankSets(draftSets);
  const progress = buildChallengeScoreProgress({
    matchConfig,
    sets: trimmedDraftSets,
  });
  const winnerMembershipId = resolveChallengeScoreWinnerMembershipId({
    challengedMembershipId,
    challengerMembershipId,
    matchConfig,
    sets: trimmedDraftSets,
  });

  function updateDraftSet(
    setIndex: number,
    field: "challengedGames" | "challengerGames",
    nextValue: number
  ) {
    setErrorMessage("");
    setDraftSets((currentDraftSets) => {
      const nextDraftSets = [...currentDraftSets];
      const currentSet =
        nextDraftSets[setIndex] ?? buildEmptySet(matchConfig, setIndex);

      nextDraftSets[setIndex] = {
        ...currentSet,
        [field]: nextValue,
        kind: getExpectedSetKind(matchConfig, setIndex),
      };

      return pruneDraftSets(matchConfig, nextDraftSets);
    });
  }

  async function handleSubmit() {
    const score = {
      sets: trimmedDraftSets,
      winnerMembershipId: winnerMembershipId ?? challengerMembershipId,
    } satisfies ChallengeResultDialogValue;
    const validationError = validateChallengeScore({
      challengedMembershipId,
      challengerMembershipId,
      matchConfig,
      score,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    await onSubmit(score);
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
          <Description>{getDialogDescription(matchConfig)}</Description>

          <TextField isInvalid={Boolean(errorMessage)} isRequired>
            <Label>Placar</Label>
            <View className="gap-3 rounded-2xl bg-surface-secondary px-4 py-4">
              {Array.from(
                { length: progress.visibleSetCount },
                (_, setIndex) => {
                  const draftSet =
                    draftSets[setIndex] ?? buildEmptySet(matchConfig, setIndex);

                  return (
                    <View className="gap-3" key={setIndex}>
                      <Text className="text-muted" variant="description">
                        {getSetLabel(matchConfig, setIndex)}
                      </Text>
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1 items-center gap-3">
                          <Text className="text-center" weight="semibold">
                            {challengerName}
                          </Text>
                          <NumberStepper
                            className="self-center"
                            defaultValue={draftSet.challengerGames}
                            isDisabled={isPending}
                            maxValue={99}
                            minValue={0}
                            onValueChange={(nextValue) => {
                              updateDraftSet(
                                setIndex,
                                "challengerGames",
                                nextValue
                              );
                            }}
                            step={1}
                            value={draftSet.challengerGames}
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
                            defaultValue={draftSet.challengedGames}
                            isDisabled={isPending}
                            maxValue={99}
                            minValue={0}
                            onValueChange={(nextValue) => {
                              updateDraftSet(
                                setIndex,
                                "challengedGames",
                                nextValue
                              );
                            }}
                            step={1}
                            value={draftSet.challengedGames}
                          >
                            <NumberStepper.DecrementButton />
                            <NumberStepper.Value />
                            <NumberStepper.IncrementButton />
                          </NumberStepper>
                        </View>
                      </View>
                    </View>
                  );
                }
              )}
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
