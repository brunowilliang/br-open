import {
  Description,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { Segment } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  RuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { SelectOptionItem } from "@/components/ui/select-option-item";

import {
  RULE_INFO,
  getSelectedOption,
  validationModeOptions,
  type RuleConfig,
  type RuleSectionProps,
} from "../_shared";

const winBehaviorOptions = [
  {
    label: "Assume a posição do adversário",
    value: "take_opponent_position" as const,
  },
  {
    label: "Sobe 1 posição",
    value: "climb_one_position" as const,
  },
];

const lossBehaviorOptions = [
  {
    label: "Continua na mesma posição",
    value: "stay_put" as const,
  },
  {
    label: "Cai 1 posição",
    value: "drop_one_position" as const,
  },
];

const walkoverBehaviorOptions = [
  {
    label: "Derrota automática",
    value: "automatic_loss" as const,
  },
  {
    label: "Derrota automática e vai para o final do ranking",
    value: "automatic_loss_and_move_to_end" as const,
  },
  {
    label: "Desafio cancelado",
    value: "cancel_challenge" as const,
  },
];

export const ResultRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.winBehavior",
      "ruleConfig.lossBehavior",
      "ruleConfig.walkoverBehavior",
      "ruleConfig.resultValidationMode",
    ],
  });
  const [winBehavior, lossBehavior, walkoverBehavior, resultValidationMode] =
    useWatch({
      control,
      name: [
        "ruleConfig.winBehavior",
        "ruleConfig.lossBehavior",
        "ruleConfig.walkoverBehavior",
        "ruleConfig.resultValidationMode",
      ],
    });

  return (
    <>
      <RuleCard info={RULE_INFO.winBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.winBehavior)}
          isRequired
        >
          <Label>Vitória no desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define como o ranking muda quando o desafiante vence.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.winBehavior",
                  nextValue.value as RuleConfig["winBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(winBehaviorOptions, winBehavior)}
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
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {winBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.winBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.lossBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.lossBehavior)}
          isRequired
        >
          <Label>Derrota no desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define como o ranking muda quando o desafiante perde.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.lossBehavior",
                  nextValue.value as RuleConfig["lossBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(lossBehaviorOptions, lossBehavior)}
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
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {lossBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.lossBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.walkoverBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.walkoverBehavior)}
          isRequired
        >
          <Label>W.O</Label>
          <Description className="-mt-1.5 mb-1">
            Define o que acontece quando um jogador não comparece ao desafio.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.walkoverBehavior",
                  nextValue.value as RuleConfig["walkoverBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(walkoverBehaviorOptions, walkoverBehavior)}
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
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {walkoverBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.walkoverBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.resultValidation}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.resultValidationMode)}
          isRequired
        >
          <Label>Validação do resultado</Label>
          <Description className="-mt-1.5 mb-1">
            Define se o resultado confirmado entre os jogadores já vale ou
            precisa da aprovação do admin.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.resultValidationMode",
                nextValue as RuleConfig["resultValidationMode"],
                fieldUpdateOptions
              );
            }}
            value={resultValidationMode}
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
            {errors.ruleConfig?.resultValidationMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>
    </>
  );
};
