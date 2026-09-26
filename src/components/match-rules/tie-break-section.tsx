import { Description, FieldError, Label, TextField } from "heroui-native";
import { Segment } from "heroui-native-pro";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import {
  RuleToggleRow,
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/ui/rule-card";
import {
  buildMatchConfigPaths,
  resolveMatchConfigFieldError,
} from "./use-match-config-form";
import { MATCH_RULE_INFO, type RuleSectionProps } from "./shared";

type TieBreakWatchValues = [boolean, number, boolean];

export const TieBreakSection = ({ isDisabled, prefix }: RuleSectionProps) => {
  const paths = buildMatchConfigPaths(prefix);
  const { control, setValue } = useFormContext();
  const { errors } = useFormState({
    control,
    name: [paths.hasTieBreak, paths.tieBreakPoints, paths.tieBreakMustWinByTwo],
  });
  const [hasTieBreak, tieBreakPoints, tieBreakMustWinByTwo] = useWatch({
    control,
    name: [paths.hasTieBreak, paths.tieBreakPoints, paths.tieBreakMustWinByTwo],
  }) as TieBreakWatchValues;

  return (
    <ToggleableRuleCard
      description="Ative para configurar o tie-break padrão dos sets."
      enabled={hasTieBreak}
      error={
        <FieldError>
          {resolveMatchConfigFieldError(errors, paths.hasTieBreak)?.message ??
            ""}
        </FieldError>
      }
      info={MATCH_RULE_INFO.tieBreak}
      isDisabled={isDisabled}
      label="Tie-break"
      onToggle={(nextEnabled) => {
        setValue(paths.hasTieBreak, nextEnabled, fieldUpdateOptions);
      }}
    >
      <TextField
        isInvalid={Boolean(
          resolveMatchConfigFieldError(errors, paths.tieBreakPoints)
        )}
        isRequired
      >
        <Label>Quantos pontos no tie-break?</Label>
        <Description className="-mt-1.5 mb-1">
          Quantos pontos decidem o tie-break: 7 no formato clássico, 10 no
          longo.
        </Description>
        <Segment
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            setValue(
              paths.tieBreakPoints,
              Number(nextValue),
              fieldUpdateOptions
            );
          }}
          value={String(tieBreakPoints)}
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
          {resolveMatchConfigFieldError(errors, paths.tieBreakPoints)
            ?.message ?? ""}
        </FieldError>
      </TextField>

      <RuleToggleRow
        description="Ative para exigir dois pontos de diferença no tie-break."
        enabled={tieBreakMustWinByTwo}
        label="Vencer o tie-break por 2 pontos"
        onToggle={(nextEnabled) => {
          setValue(paths.tieBreakMustWinByTwo, nextEnabled, fieldUpdateOptions);
        }}
      />
      <FieldError>
        {resolveMatchConfigFieldError(errors, paths.tieBreakMustWinByTwo)
          ?.message ?? ""}
      </FieldError>
    </ToggleableRuleCard>
  );
};
