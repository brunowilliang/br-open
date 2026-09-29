import { Chip, Input, Label, TextField } from "heroui-native";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/core/text";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import {
  resolveReasonPreset,
  toggleReasonPreset,
  UNAVAILABILITY_REASON_PRESETS,
} from "@/lib/tournaments/unavailability-derived";

type ReasonFieldProps = {
  isDisabled?: boolean;
  onChange: (reason: string) => void;
  value: string;
};

/**
 * Motivo do cancelamento/bloqueio: os prontos saem no MESMO desenho do seletor
 * de dias do diálogo de horário (chips em scroll horizontal dentro do
 * ScrollShadow); o que não está na lista vai escrito no campo "Outro".
 */
export function ReasonField(props: ReasonFieldProps) {
  const selectedPreset = resolveReasonPreset(props.value);
  const customReason = selectedPreset === null ? props.value : "";

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text weight="medium">Motivo</Text>
        <ScrollShadow color="surface">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-1">
              {UNAVAILABILITY_REASON_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset;

                return (
                  <Chip
                    color={isSelected ? "accent" : "default"}
                    disabled={props.isDisabled}
                    key={preset}
                    onPress={() => {
                      props.onChange(
                        toggleReasonPreset({ current: props.value, preset })
                      );
                    }}
                    size="md"
                    variant="soft"
                  >
                    <Chip.Label>{preset}</Chip.Label>
                  </Chip>
                );
              })}
            </View>
          </ScrollView>
        </ScrollShadow>
      </View>

      <TextField>
        <Label>Outro</Label>
        <Input
          className="bg-surface-secondary"
          editable={!props.isDisabled}
          maxLength={80}
          onChangeText={props.onChange}
          placeholder="Escreva o motivo"
          value={customReason}
          variant="secondary"
        />
      </TextField>
    </View>
  );
}
