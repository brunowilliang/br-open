import {
  Description,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { NumberStepper } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  RuleCard,
  RuleExpandableContent,
  RuleToggleRow,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";

import {
  RULE_INFO,
  getSelectedOption,
  scoringModeOptions,
  type MatchConfig,
  type RuleSectionProps,
} from "../shared";

const finalSetModeOptions = [
  {
    label: "Igual aos anteriores",
    value: "same_as_previous" as const,
  },
  {
    label: "Set personalizado",
    value: "custom_set" as const,
  },
  {
    label: "Super tie-break",
    value: "super_tiebreak" as const,
  },
];

export const FinalSetSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.finalSetMode",
      "ruleConfig.matchConfig.finalSetGamesPerSet",
      "ruleConfig.matchConfig.finalSetScoringMode",
      "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
      "ruleConfig.matchConfig.finalSetHasTieBreak",
      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
      "ruleConfig.matchConfig.finalSetTieBreakPoints",
      "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
      "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
      "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
    ],
  });
  const [
    finalSetMode,
    finalSetGamesPerSet,
    finalSetScoringMode,
    finalSetMustWinByTwoGames,
    finalSetHasTieBreak,
    finalSetTieBreakAtGamesAll,
    finalSetTieBreakPoints,
    finalSetTieBreakMustWinByTwo,
    finalSetSuperTieBreakPoints,
    finalSetSuperTieBreakMustWinByTwo,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.finalSetMode",
      "ruleConfig.matchConfig.finalSetGamesPerSet",
      "ruleConfig.matchConfig.finalSetScoringMode",
      "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
      "ruleConfig.matchConfig.finalSetHasTieBreak",
      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
      "ruleConfig.matchConfig.finalSetTieBreakPoints",
      "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
      "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
      "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
    ],
  });

  return (
    <RuleCard info={RULE_INFO.finalSetMode}>
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.finalSetMode)}
      >
        <Label>Formato do último set</Label>
        <Description className="-mt-1.5 mb-1">
          Escolha se o último set segue igual, vira um set próprio ou um super
          tie-break.
        </Description>
        <Select
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            if (nextValue && !Array.isArray(nextValue)) {
              setValue(
                "ruleConfig.matchConfig.finalSetMode",
                nextValue.value as MatchConfig["finalSetMode"],
                fieldUpdateOptions
              );
            }
          }}
          selectionMode={"single"}
          value={getSelectedOption(finalSetModeOptions, finalSetMode)}
        >
          <Select.Trigger className="bg-surface-secondary">
            <Select.Value
              className="font-normal"
              numberOfLines={1}
              placeholder="Escolha uma opção"
            />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <SelectScrollContent label="Escolha uma opção" width="trigger">
              {finalSetModeOptions.map((option) => (
                <SelectOptionItem
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </SelectScrollContent>
          </Select.Portal>
        </Select>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.finalSetMode?.message ?? ""}
        </FieldError>
      </TextField>

      {finalSetMode === "custom_set" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetGamesPerSet
            )}
            isRequired
          >
            <Label>Quantos games no último set?</Label>
            <Description className="-mt-1.5 mb-1">
              Quantidade padrão de games para o último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetGamesPerSet}
              isDisabled={isDisabled}
              maxValue={12}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetGamesPerSet",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetGamesPerSet}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetGamesPerSet?.message ??
                ""}
            </FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetScoringMode
            )}
          >
            <Label>Pontuação do último set</Label>
            <Description className="-mt-1.5 mb-1">
              Escolha se o último set usa vantagem ou no-ad.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  setValue(
                    "ruleConfig.matchConfig.finalSetScoringMode",
                    nextValue.value as MatchConfig["finalSetScoringMode"],
                    fieldUpdateOptions
                  );
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(scoringModeOptions, finalSetScoringMode)}
            >
              <Select.Trigger className="bg-surface-secondary">
                <Select.Value
                  className="font-normal"
                  numberOfLines={1}
                  placeholder="Escolha uma opção"
                />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <SelectScrollContent label="Escolha uma opção" width="trigger">
                  {scoringModeOptions.map((option) => (
                    <SelectOptionItem
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </SelectScrollContent>
              </Select.Portal>
            </Select>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetScoringMode?.message ??
                ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois games de diferença no último set."
            enabled={finalSetMustWinByTwoGames}
            label="Vencer o último set por 2 games"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetMustWinByTwoGames
              ?.message ?? ""}
          </FieldError>

          <RuleToggleRow
            description="Ative para configurar tie-break também no último set."
            enabled={finalSetHasTieBreak}
            label="Tie-break no último set"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetHasTieBreak",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetHasTieBreak?.message ?? ""}
          </FieldError>

          {finalSetHasTieBreak ? (
            <RuleExpandableContent>
              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                )}
                isRequired
              >
                <Label>Em qual placar entra o tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Exemplo: informe 6 para tie-break final em 6x6.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakAtGamesAll}
                  isDisabled={isDisabled}
                  maxValue={12}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakAtGamesAll}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                )}
                isRequired
              >
                <Label>Quantos pontos no tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Pontuação padrão do tie-break no último set.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakPoints}
                  isDisabled={isDisabled}
                  maxValue={30}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakPoints",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakPoints}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <RuleToggleRow
                description="Ative para exigir dois pontos de diferença no tie-break do último set."
                enabled={finalSetTieBreakMustWinByTwo}
                label="Vencer o tie-break final por 2 pontos"
                onToggle={(nextEnabled) => {
                  setValue(
                    "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
                    nextEnabled,
                    fieldUpdateOptions
                  );
                }}
              />
              <FieldError>
                {errors.ruleConfig?.matchConfig?.finalSetTieBreakMustWinByTwo
                  ?.message ?? ""}
              </FieldError>
            </RuleExpandableContent>
          ) : null}
        </RuleExpandableContent>
      ) : null}

      {finalSetMode === "super_tiebreak" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
            )}
            isRequired
          >
            <Label>Quantos pontos no super tie-break?</Label>
            <Description className="-mt-1.5 mb-1">
              Pontuação padrão do super tie-break no lugar do último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetSuperTieBreakPoints}
              isDisabled={isDisabled}
              maxValue={30}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetSuperTieBreakPoints}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
                ?.message ?? ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois pontos de diferença no super tie-break."
            enabled={finalSetSuperTieBreakMustWinByTwo}
            label="Vencer o super tie-break por 2 pontos"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakMustWinByTwo
              ?.message ?? ""}
          </FieldError>
        </RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
};
