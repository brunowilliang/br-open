import { Description, FieldError, Label, TextField } from "heroui-native";
import { NumberStepper, Segment } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  RuleCard,
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";

import {
  RULE_INFO,
  scoringModeOptions,
  type MatchConfig,
  type RuleSectionProps,
} from "../shared";

export const MatchBasicsSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.bestOfSets",
      "ruleConfig.matchConfig.gamesPerSet",
      "ruleConfig.matchConfig.defaultDurationMinutes",
      "ruleConfig.matchConfig.scoringMode",
      "ruleConfig.matchConfig.setMustWinByTwoGames",
    ],
  });
  const [
    bestOfSets,
    gamesPerSet,
    defaultDurationMinutes,
    scoringMode,
    setMustWinByTwoGames,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.bestOfSets",
      "ruleConfig.matchConfig.gamesPerSet",
      "ruleConfig.matchConfig.defaultDurationMinutes",
      "ruleConfig.matchConfig.scoringMode",
      "ruleConfig.matchConfig.setMustWinByTwoGames",
    ],
  });

  return (
    <>
      <RuleCard info={RULE_INFO.bestOfSets}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.bestOfSets)}
          isRequired
        >
          <Label>Melhor de quantos sets?</Label>
          <Description className="-mt-1.5 mb-1">
            Escolha o formato da partida. Quem atingir a maioria dos sets vence.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.bestOfSets",
                Number(nextValue),
                fieldUpdateOptions
              );
            }}
            value={String(bestOfSets)}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                <Segment.Item value="1">
                  <Segment.Label>Melhor de 1</Segment.Label>
                </Segment.Item>
                <Segment.Item value="3">
                  <Segment.Label>Melhor de 3</Segment.Label>
                </Segment.Item>
                <Segment.Item value="5">
                  <Segment.Label>Melhor de 5</Segment.Label>
                </Segment.Item>
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.bestOfSets?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.gamesPerSet}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.gamesPerSet)}
          isRequired
        >
          <Label>Quantos games por set?</Label>
          <Description className="-mt-1.5 mb-1">
            Quantidade padrão de games em cada set.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={gamesPerSet}
            isDisabled={isDisabled}
            maxValue={12}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.gamesPerSet",
                nextValue,
                fieldUpdateOptions
              );
              setValue(
                "ruleConfig.matchConfig.tieBreakAtGamesAll",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={gamesPerSet}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.gamesPerSet?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.defaultDurationMinutes}>
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.matchConfig?.defaultDurationMinutes
          )}
          isRequired
        >
          <Label>Duração padrão da partida</Label>
          <Description className="-mt-1.5 mb-1">
            Tempo inicial sugerido quando a partida for marcada.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={defaultDurationMinutes}
            isDisabled={isDisabled}
            maxValue={360}
            minValue={15}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.defaultDurationMinutes",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={15}
            value={defaultDurationMinutes}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.defaultDurationMinutes?.message ??
              ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.scoringMode}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.scoringMode)}
        >
          <Label>Pontuação dos games</Label>
          <Description className="-mt-1.5 mb-1">
            Escolha se a partida usa vantagem tradicional ou no-ad.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.scoringMode",
                nextValue as MatchConfig["scoringMode"],
                fieldUpdateOptions
              );
            }}
            value={scoringMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {scoringModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.scoringMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <ToggleableRuleCard
        description="Ative para exigir dois games de diferença no fechamento do set."
        enabled={setMustWinByTwoGames}
        error={
          <FieldError>
            {errors.ruleConfig?.matchConfig?.setMustWinByTwoGames?.message ??
              ""}
          </FieldError>
        }
        info={RULE_INFO.setMustWinByTwoGames}
        isDisabled={isDisabled}
        label="Vencer o set por 2 games"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.matchConfig.setMustWinByTwoGames",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      />
    </>
  );
};
