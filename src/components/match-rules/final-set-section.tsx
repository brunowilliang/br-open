import {
  Description,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { NumberStepper, Segment } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import {
  RuleCard,
  RuleExpandableContent,
  RuleToggleRow,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import {
  buildMatchConfigPaths,
  resolveMatchConfigFieldError,
} from "./use-match-config-form";
import {
  MATCH_RULE_INFO,
  getSelectedOption,
  scoringModeOptions,
  type MatchConfig,
  type RuleSectionProps,
} from "./shared";

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

type FinalSetWatchValues = [
  MatchConfig["finalSetMode"],
  MatchConfig["finalSetGamesPerSet"],
  MatchConfig["finalSetScoringMode"],
  MatchConfig["finalSetMustWinByTwoGames"],
  MatchConfig["finalSetHasTieBreak"],
  MatchConfig["finalSetTieBreakPoints"],
  MatchConfig["finalSetTieBreakMustWinByTwo"],
  MatchConfig["finalSetSuperTieBreakPoints"],
  MatchConfig["finalSetSuperTieBreakMustWinByTwo"],
];

export const FinalSetSection = ({ isDisabled, prefix }: RuleSectionProps) => {
  const paths = buildMatchConfigPaths(prefix);
  const { control, setValue } = useFormContext();
  const { errors } = useFormState({
    control,
    name: [
      paths.finalSetMode,
      paths.finalSetGamesPerSet,
      paths.finalSetScoringMode,
      paths.finalSetMustWinByTwoGames,
      paths.finalSetHasTieBreak,
      paths.finalSetTieBreakPoints,
      paths.finalSetTieBreakMustWinByTwo,
      paths.finalSetSuperTieBreakPoints,
      paths.finalSetSuperTieBreakMustWinByTwo,
    ],
  });
  const [
    finalSetMode,
    finalSetGamesPerSet,
    finalSetScoringMode,
    finalSetMustWinByTwoGames,
    finalSetHasTieBreak,
    finalSetTieBreakPoints,
    finalSetTieBreakMustWinByTwo,
    finalSetSuperTieBreakPoints,
    finalSetSuperTieBreakMustWinByTwo,
  ] = useWatch({
    control,
    name: [
      paths.finalSetMode,
      paths.finalSetGamesPerSet,
      paths.finalSetScoringMode,
      paths.finalSetMustWinByTwoGames,
      paths.finalSetHasTieBreak,
      paths.finalSetTieBreakPoints,
      paths.finalSetTieBreakMustWinByTwo,
      paths.finalSetSuperTieBreakPoints,
      paths.finalSetSuperTieBreakMustWinByTwo,
    ],
  }) as FinalSetWatchValues;

  return (
    <RuleCard info={MATCH_RULE_INFO.finalSetMode}>
      <TextField
        isInvalid={Boolean(
          resolveMatchConfigFieldError(errors, paths.finalSetMode)
        )}
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
                paths.finalSetMode,
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
          {resolveMatchConfigFieldError(errors, paths.finalSetMode)?.message ??
            ""}
        </FieldError>
      </TextField>

      {finalSetMode === "custom_set" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              resolveMatchConfigFieldError(errors, paths.finalSetGamesPerSet)
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
                  paths.finalSetGamesPerSet,
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
              {resolveMatchConfigFieldError(errors, paths.finalSetGamesPerSet)
                ?.message ?? ""}
            </FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(
              resolveMatchConfigFieldError(errors, paths.finalSetScoringMode)
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
                    paths.finalSetScoringMode,
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
              {resolveMatchConfigFieldError(errors, paths.finalSetScoringMode)
                ?.message ?? ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois games de diferença no último set."
            enabled={finalSetMustWinByTwoGames}
            label="Vencer o último set por 2 games"
            onToggle={(nextEnabled) => {
              setValue(
                paths.finalSetMustWinByTwoGames,
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {resolveMatchConfigFieldError(
              errors,
              paths.finalSetMustWinByTwoGames
            )?.message ?? ""}
          </FieldError>

          <RuleToggleRow
            description="Ative para configurar tie-break também no último set."
            enabled={finalSetHasTieBreak}
            label="Tie-break no último set"
            onToggle={(nextEnabled) => {
              setValue(
                paths.finalSetHasTieBreak,
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {resolveMatchConfigFieldError(errors, paths.finalSetHasTieBreak)
              ?.message ?? ""}
          </FieldError>

          {finalSetHasTieBreak ? (
            <RuleExpandableContent>
              <TextField
                isInvalid={Boolean(
                  resolveMatchConfigFieldError(
                    errors,
                    paths.finalSetTieBreakPoints
                  )
                )}
                isRequired
              >
                <Label>Quantos pontos no tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Quantos pontos decidem o tie-break do último set.
                </Description>
                <Segment
                  isDisabled={isDisabled}
                  onValueChange={(nextValue) => {
                    setValue(
                      paths.finalSetTieBreakPoints,
                      Number(nextValue),
                      fieldUpdateOptions
                    );
                  }}
                  value={String(finalSetTieBreakPoints)}
                >
                  <Segment.Group>
                    <Segment.ScrollView>
                      <Segment.Indicator />
                      <Segment.Item value="7">
                        <Segment.Label>7 pontos</Segment.Label>
                      </Segment.Item>
                      <Segment.Item value="10">
                        <Segment.Label>10 pontos</Segment.Label>
                      </Segment.Item>
                    </Segment.ScrollView>
                  </Segment.Group>
                </Segment>
                <FieldError>
                  {resolveMatchConfigFieldError(
                    errors,
                    paths.finalSetTieBreakPoints
                  )?.message ?? ""}
                </FieldError>
              </TextField>

              <RuleToggleRow
                description="Ative para exigir dois pontos de diferença no tie-break do último set."
                enabled={finalSetTieBreakMustWinByTwo}
                label="Vencer o tie-break final por 2 pontos"
                onToggle={(nextEnabled) => {
                  setValue(
                    paths.finalSetTieBreakMustWinByTwo,
                    nextEnabled,
                    fieldUpdateOptions
                  );
                }}
              />
              <FieldError>
                {resolveMatchConfigFieldError(
                  errors,
                  paths.finalSetTieBreakMustWinByTwo
                )?.message ?? ""}
              </FieldError>
            </RuleExpandableContent>
          ) : null}
        </RuleExpandableContent>
      ) : null}

      {finalSetMode === "super_tiebreak" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              resolveMatchConfigFieldError(
                errors,
                paths.finalSetSuperTieBreakPoints
              )
            )}
            isRequired
          >
            <Label>Quantos pontos no super tie-break?</Label>
            <Description className="-mt-1.5 mb-1">
              Pontuação que decide o último set em super tie-break. 10 é o
              padrão oficial.
            </Description>
            <Segment
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                setValue(
                  paths.finalSetSuperTieBreakPoints,
                  Number(nextValue),
                  fieldUpdateOptions
                );
              }}
              value={String(finalSetSuperTieBreakPoints)}
            >
              <Segment.Group>
                <Segment.ScrollView>
                  <Segment.Indicator />
                  <Segment.Item value="7">
                    <Segment.Label>7 pontos</Segment.Label>
                  </Segment.Item>
                  <Segment.Item value="10">
                    <Segment.Label>10 pontos</Segment.Label>
                  </Segment.Item>
                </Segment.ScrollView>
              </Segment.Group>
            </Segment>
            <FieldError>
              {resolveMatchConfigFieldError(
                errors,
                paths.finalSetSuperTieBreakPoints
              )?.message ?? ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois pontos de diferença no super tie-break."
            enabled={finalSetSuperTieBreakMustWinByTwo}
            label="Vencer o super tie-break por 2 pontos"
            onToggle={(nextEnabled) => {
              setValue(
                paths.finalSetSuperTieBreakMustWinByTwo,
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {resolveMatchConfigFieldError(
              errors,
              paths.finalSetSuperTieBreakMustWinByTwo
            )?.message ?? ""}
          </FieldError>
        </RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
};
