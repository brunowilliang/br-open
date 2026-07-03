import {
  Description,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
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
  type RuleConfig,
  type RuleSectionProps,
} from "../shared";
import { InactivityPenaltySection } from "./inactivity-penalty-section";

const newPlayerPlacementOptions = [
  {
    label: "Final da fila",
    value: "end_of_ranking" as const,
  },
];

export const RankingRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: "ruleConfig.newPlayerPlacement",
  });
  const newPlayerPlacement = useWatch({
    control,
    name: "ruleConfig.newPlayerPlacement",
  });

  return (
    <>
      <RuleCard info={RULE_INFO.newPlayerPlacement}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.newPlayerPlacement)}
          isRequired
        >
          <Label>Entrada de novo jogador</Label>
          <Description className="-mt-1.5 mb-1">
            Define em que posição novos participantes entram no ranking.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.newPlayerPlacement",
                  nextValue.value as RuleConfig["newPlayerPlacement"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(
              newPlayerPlacementOptions,
              newPlayerPlacement
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
                {newPlayerPlacementOptions.map((option) => (
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
            {errors.ruleConfig?.newPlayerPlacement?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <InactivityPenaltySection isDisabled={isDisabled} />
    </>
  );
};
