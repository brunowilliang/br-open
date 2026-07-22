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
  CHALLENGE_RULE_INFO,
  RULE_INFO,
  validationModeOptions,
  type RuleConfig,
  type RuleSectionProps,
} from "../shared";

export const ChallengeRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.maxChallengeDistance",
      "ruleConfig.maxActiveChallengesPerPlayer",
      "ruleConfig.maxChallengesPerMonth",
      "ruleConfig.responseDeadlineHours",
      "ruleConfig.challengeValidationMode",
    ],
  });
  const [
    maxChallengeDistance,
    maxActiveChallengesPerPlayer,
    maxChallengesPerMonth,
    responseDeadlineHours,
    challengeValidationMode,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.maxChallengeDistance",
      "ruleConfig.maxActiveChallengesPerPlayer",
      "ruleConfig.maxChallengesPerMonth",
      "ruleConfig.responseDeadlineHours",
      "ruleConfig.challengeValidationMode",
    ],
  });

  return (
    <>
      <ToggleableRuleCard
        description="Ative para definir quantas posições acima um jogador pode desafiar."
        enabled={maxChallengeDistance.enabled}
        info={CHALLENGE_RULE_INFO.maxChallengeDistance}
        isDisabled={isDisabled}
        label="Pode desafiar quantas posições acima?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengeDistance.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.maxChallengeDistance?.value)}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengeDistance.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengeDistance.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengeDistance.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengeDistance?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para limitar quantos desafios em aberto cada jogador pode ter."
        enabled={maxActiveChallengesPerPlayer.enabled}
        info={CHALLENGE_RULE_INFO.maxActiveChallengesPerPlayer}
        isDisabled={isDisabled}
        label="Máx. desafios ativos por jogador?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxActiveChallengesPerPlayer.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.maxActiveChallengesPerPlayer?.value
          )}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxActiveChallengesPerPlayer.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxActiveChallengesPerPlayer.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxActiveChallengesPerPlayer.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxActiveChallengesPerPlayer?.value?.message ??
              ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para limitar quantos desafios cada jogador pode abrir por mês."
        enabled={maxChallengesPerMonth.enabled}
        info={CHALLENGE_RULE_INFO.maxChallengesPerMonth}
        isDisabled={isDisabled}
        label="Máx. desafios por mês?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengesPerMonth.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.maxChallengesPerMonth?.value)}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengesPerMonth.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengesPerMonth.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengesPerMonth.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengesPerMonth?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para definir um prazo para o adversário responder o desafio."
        enabled={responseDeadlineHours.enabled}
        info={CHALLENGE_RULE_INFO.responseDeadlineHours}
        isDisabled={isDisabled}
        label="Prazo para responder desafio"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.responseDeadlineHours.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.responseDeadlineHours?.value)}
          isRequired
        >
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.responseDeadlineHours.value",
                Number(nextValue),
                fieldUpdateOptions
              );
            }}
            value={String(responseDeadlineHours.value)}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                <Segment.Item value="12">
                  <Segment.Label>12 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="24">
                  <Segment.Label>24 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="48">
                  <Segment.Label>48 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="72">
                  <Segment.Label>3 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="120">
                  <Segment.Label>5 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="168">
                  <Segment.Label>7 dias</Segment.Label>
                </Segment.Item>
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.responseDeadlineHours?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <RuleCard info={RULE_INFO.challengeValidation}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.challengeValidationMode)}
          isRequired
        >
          <Label>Validação do desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define se o desafio confirmado entre os jogadores já vale ou precisa
            da aprovação do organizador.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.challengeValidationMode",
                nextValue as RuleConfig["challengeValidationMode"],
                fieldUpdateOptions
              );
            }}
            value={challengeValidationMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {validationModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.challengeValidationMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>
    </>
  );
};
