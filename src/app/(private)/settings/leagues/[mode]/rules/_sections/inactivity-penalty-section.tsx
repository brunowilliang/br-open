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
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { SelectOptionItem } from "@/components/ui/select-option-item";

import {
  RULE_INFO,
  getSelectedOption,
  type RuleConfig,
  type RuleSectionProps,
} from "../_shared";

const inactivityPenaltyTypeOptions = [
  {
    label: "Cai 1 posição",
    value: "drop_one_position" as const,
  },
  {
    label: "Vai para o final do ranking",
    value: "move_to_ranking_end" as const,
  },
];

export const InactivityPenaltySection = ({ isDisabled }: RuleSectionProps) => {
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.hasInactivityPenalty",
      "ruleConfig.inactivityPenaltyType",
      "ruleConfig.inactivityPenaltyDays",
    ],
  });
  const [hasInactivityPenalty, inactivityPenaltyType, inactivityPenaltyDays] =
    useWatch({
      control,
      name: [
        "ruleConfig.hasInactivityPenalty",
        "ruleConfig.inactivityPenaltyType",
        "ruleConfig.inactivityPenaltyDays",
      ],
    });

  function toggleInactivityPenalty(nextEnabled: boolean) {
    const ruleConfig = getValues("ruleConfig");

    if (!nextEnabled) {
      setValue(
        "ruleConfig",
        {
          ...ruleConfig,
          hasInactivityPenalty: false,
          inactivityPenaltyType: undefined,
          inactivityPenaltyDays: undefined,
        },
        fieldUpdateOptions
      );
      return;
    }

    setValue(
      "ruleConfig",
      {
        ...ruleConfig,
        hasInactivityPenalty: true,
        inactivityPenaltyType: inactivityPenaltyType ?? "drop_one_position",
        inactivityPenaltyDays: inactivityPenaltyDays ?? 30,
      },
      fieldUpdateOptions
    );
  }

  return (
    <ToggleableRuleCard
      description="Ative para definir a punição e o período sem partidas."
      enabled={hasInactivityPenalty}
      error={
        <FieldError>
          {errors.ruleConfig?.hasInactivityPenalty?.message ?? ""}
        </FieldError>
      }
      info={RULE_INFO.inactivityPenalty}
      isDisabled={isDisabled}
      label="Penalidade por inatividade"
      onToggle={toggleInactivityPenalty}
    >
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.inactivityPenaltyType)}
        isRequired
      >
        <Label>Qual penalidade aplicar?</Label>
        <Description className="-mt-1.5 mb-1">
          Escolha o impacto da inatividade no ranking do jogador.
        </Description>
        <Select
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            if (nextValue && !Array.isArray(nextValue)) {
              setValue(
                "ruleConfig.inactivityPenaltyType",
                nextValue.value as RuleConfig["inactivityPenaltyType"],
                fieldUpdateOptions
              );
            }
          }}
          selectionMode={"single"}
          value={getSelectedOption(
            inactivityPenaltyTypeOptions,
            inactivityPenaltyType
          )}
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
              {inactivityPenaltyTypeOptions.map((option) => (
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
          {errors.ruleConfig?.inactivityPenaltyType?.message ?? ""}
        </FieldError>
      </TextField>

      <TextField
        isInvalid={Boolean(errors.ruleConfig?.inactivityPenaltyDays)}
        isRequired
      >
        <Label>Após quanto tempo sem jogar?</Label>
        <Description className="-mt-1.5 mb-1">
          Tempo sem partidas para a penalidade começar a valer.
        </Description>
        <Segment
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.inactivityPenaltyDays",
              Number(nextValue),
              fieldUpdateOptions
            );
          }}
          value={String(inactivityPenaltyDays ?? 30)}
        >
          <Segment.Group>
            <Segment.ScrollView>
              <Segment.Indicator />
              <Segment.Item value="15">
                <Segment.Label>15 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="30">
                <Segment.Label>30 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="45">
                <Segment.Label>45 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="60">
                <Segment.Label>60 dias</Segment.Label>
              </Segment.Item>
            </Segment.ScrollView>
          </Segment.Group>
        </Segment>
        <FieldError>
          {errors.ruleConfig?.inactivityPenaltyDays?.message ?? ""}
        </FieldError>
      </TextField>
    </ToggleableRuleCard>
  );
};
