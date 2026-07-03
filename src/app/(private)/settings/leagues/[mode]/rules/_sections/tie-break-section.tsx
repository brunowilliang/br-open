import { Description, FieldError, Label, TextField } from "heroui-native";
import { NumberStepper } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  RuleToggleRow,
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";

import { RULE_INFO, type RuleSectionProps } from "../_shared";

export const TieBreakSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.hasTieBreak",
      "ruleConfig.matchConfig.tieBreakAtGamesAll",
      "ruleConfig.matchConfig.tieBreakPoints",
      "ruleConfig.matchConfig.tieBreakMustWinByTwo",
    ],
  });
  const [
    hasTieBreak,
    tieBreakAtGamesAll,
    tieBreakPoints,
    tieBreakMustWinByTwo,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.hasTieBreak",
      "ruleConfig.matchConfig.tieBreakAtGamesAll",
      "ruleConfig.matchConfig.tieBreakPoints",
      "ruleConfig.matchConfig.tieBreakMustWinByTwo",
    ],
  });

  return (
    <ToggleableRuleCard
      description="Ative para configurar o tie-break padrão dos sets."
      enabled={hasTieBreak}
      error={
        <FieldError>
          {errors.ruleConfig?.matchConfig?.hasTieBreak?.message ?? ""}
        </FieldError>
      }
      info={RULE_INFO.tieBreak}
      isDisabled={isDisabled}
      label="Tie-break"
      onToggle={(nextEnabled) => {
        setValue(
          "ruleConfig.matchConfig.hasTieBreak",
          nextEnabled,
          fieldUpdateOptions
        );
      }}
    >
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.tieBreakAtGamesAll)}
        isRequired
      >
        <Label>Em qual placar entra o tie-break?</Label>
        <Description className="-mt-1.5 mb-1">
          Normalmente acompanha a quantidade de games do set, mas você pode
          ajustar.
        </Description>
        <NumberStepper
          className="self-start"
          defaultValue={tieBreakAtGamesAll}
          isDisabled={isDisabled}
          maxValue={12}
          minValue={1}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.matchConfig.tieBreakAtGamesAll",
              nextValue,
              fieldUpdateOptions
            );
          }}
          step={1}
          value={tieBreakAtGamesAll}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.tieBreakAtGamesAll?.message ?? ""}
        </FieldError>
      </TextField>

      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.tieBreakPoints)}
        isRequired
      >
        <Label>Quantos pontos no tie-break?</Label>
        <Description className="-mt-1.5 mb-1">
          Quantidade padrão de pontos para vencer o tie-break.
        </Description>
        <NumberStepper
          className="self-start"
          defaultValue={tieBreakPoints}
          isDisabled={isDisabled}
          maxValue={30}
          minValue={1}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.matchConfig.tieBreakPoints",
              nextValue,
              fieldUpdateOptions
            );
          }}
          step={1}
          value={tieBreakPoints}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.tieBreakPoints?.message ?? ""}
        </FieldError>
      </TextField>

      <RuleToggleRow
        description="Ative para exigir dois pontos de diferença no tie-break."
        enabled={tieBreakMustWinByTwo}
        label="Vencer o tie-break por 2 pontos"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.matchConfig.tieBreakMustWinByTwo",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      />
      <FieldError>
        {errors.ruleConfig?.matchConfig?.tieBreakMustWinByTwo?.message ?? ""}
      </FieldError>
    </ToggleableRuleCard>
  );
};
