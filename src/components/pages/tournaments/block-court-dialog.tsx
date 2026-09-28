import {
  Button,
  Dialog,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ScheduleDateField } from "@/components/ui/schedule-date-field";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { getSelectedOption } from "@/lib/collections";
import { resolveScheduleDateBounds } from "@/lib/scheduling/schedule-view";
import {
  buildUnavailabilityEndOptions,
  buildUnavailabilityStartOptions,
} from "@/lib/tournaments/unavailability-derived";
import { ReasonField } from "@/components/pages/tournaments/reason-field";
import { brazilDayKey } from "@convex/domains/tournament/window-rules";

const ALL_COURTS_VALUE = "all";

export type BlockCourtDialogInput = {
  courtId: null | string;
  date: string;
  endMinute: null | number;
  reason: string;
  startMinute: null | number;
};

type BlockCourtDialogProps = {
  courts: { id: string; name: string }[];
  /** Dia já aberto na agenda: o bloqueio nasce no dia que o organizador olha. */
  initialDate?: null | string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: BlockCourtDialogInput) => Promise<void> | void;
  windowEndDayKey?: null | string;
  windowStartDayKey?: null | string;
};

/**
 * Fecha dia, pedaço do dia ou uma quadra específica: o bloqueio recusa qualquer
 * agendamento na faixa (inclusive o acerto entre os jogadores) até ser reaberto.
 */
export function BlockCourtDialog(props: BlockCourtDialogProps) {
  const { courts } = props;
  const [date, setDate] = useState<null | string>(props.initialDate ?? null);
  const [courtValue, setCourtValue] = useState<string>(
    courts[0]?.id ?? ALL_COURTS_VALUE
  );
  const [startMinute, setStartMinute] = useState<string | undefined>(undefined);
  const [endMinute, setEndMinute] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [dateError, setDateError] = useState("");
  const [periodError, setPeriodError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const dateBounds = useMemo(
    () =>
      resolveScheduleDateBounds({
        endDayKey: props.windowEndDayKey ?? null,
        startDayKey: props.windowStartDayKey ?? null,
        todayDayKey: brazilDayKey(Date.now()),
      }),
    [props.windowEndDayKey, props.windowStartDayKey]
  );
  const courtOptions = useMemo(
    () => [
      { label: "Todas as quadras", value: ALL_COURTS_VALUE },
      ...courts.map((court) => ({ label: court.name, value: court.id })),
    ],
    [courts]
  );
  const startOptions = useMemo(
    () => [
      { label: "Dia todo", value: ALL_COURTS_VALUE },
      ...buildUnavailabilityStartOptions(),
    ],
    []
  );
  const endOptions = useMemo(
    () =>
      startMinute === undefined
        ? []
        : buildUnavailabilityEndOptions(Number(startMinute)),
    [startMinute]
  );

  async function handleSubmit() {
    setDateError(date ? "" : "Selecione o dia.");
    setPeriodError(
      startMinute !== undefined && endMinute === undefined
        ? "Informe o fim do período."
        : ""
    );
    setReasonError(reason.trim().length < 3 ? "Informe o motivo." : "");

    if (
      !date ||
      reason.trim().length < 3 ||
      (startMinute !== undefined && endMinute === undefined)
    ) {
      return;
    }

    await props.onSubmit({
      courtId: courtValue === ALL_COURTS_VALUE ? null : courtValue,
      date,
      endMinute: endMinute === undefined ? null : Number(endMinute),
      reason: reason.trim(),
      startMinute: startMinute === undefined ? null : Number(startMinute),
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView automaticOffset behavior="padding">
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Fechar quadra</Dialog.Title>
            <Text color="muted" variant="description">
              Ninguém consegue agendar nesse período, nem você nem o acerto
              entre os jogadores. A agenda reabre quando você quiser.
            </Text>

            <ScheduleDateField
              error={dateError}
              isDisabled={props.isPending}
              maxDayKey={dateBounds.maxDayKey}
              minDayKey={dateBounds.minDayKey}
              onChange={(next) => {
                setDateError("");
                setDate(next);
              }}
              value={date}
            />

            <TextField isRequired>
              <Label>Quadra</Label>
              <Select
                isDisabled={props.isPending}
                onValueChange={(nextValue) => {
                  if (!nextValue || Array.isArray(nextValue)) {
                    return;
                  }

                  setCourtValue(String(nextValue.value));
                }}
                selectionMode="single"
                value={getSelectedOption(courtOptions, courtValue)}
              >
                <Select.Trigger className="bg-surface-secondary">
                  <Select.Value
                    className="font-normal"
                    placeholder="Escolha a quadra"
                  />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <SelectScrollContent width="trigger">
                    {courtOptions.map((option) => (
                      <SelectOptionItem
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </SelectScrollContent>
                </Select.Portal>
              </Select>
            </TextField>

            <View className="flex-row gap-3">
              <TextField className="flex-1">
                <Label>Início</Label>
                <Select
                  isDisabled={props.isPending}
                  onValueChange={(nextValue) => {
                    if (!nextValue || Array.isArray(nextValue)) {
                      return;
                    }

                    const next = String(nextValue.value);

                    if (next === ALL_COURTS_VALUE) {
                      setPeriodError("");
                      setStartMinute(undefined);
                      setEndMinute(undefined);
                      return;
                    }

                    setPeriodError("");
                    setStartMinute(next);

                    if (
                      endMinute !== undefined &&
                      Number(endMinute) <= Number(next)
                    ) {
                      setEndMinute(undefined);
                    }
                  }}
                  presentation="popover"
                  selectionMode="single"
                  value={getSelectedOption(startOptions, startMinute)}
                >
                  <Select.Trigger className="bg-surface-secondary">
                    <Select.Value placeholder="Dia todo" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content
                      className="w-full"
                      presentation="popover"
                      width="trigger"
                    >
                      <Select.ListLabel className="mb-2">
                        Início do período
                      </Select.ListLabel>
                      <ScrollShadow color="surface" style={{ maxHeight: 450 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                          {startOptions.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </ScrollView>
                      </ScrollShadow>
                    </Select.Content>
                  </Select.Portal>
                </Select>
              </TextField>
              <TextField className="flex-1">
                <Label>Fim</Label>
                <Select
                  isDisabled={props.isPending || startMinute === undefined}
                  onValueChange={(nextValue) => {
                    if (!nextValue || Array.isArray(nextValue)) {
                      return;
                    }

                    setEndMinute(String(nextValue.value));
                  }}
                  presentation="popover"
                  selectionMode="single"
                  value={getSelectedOption(endOptions, endMinute)}
                >
                  <Select.Trigger className="bg-surface-secondary">
                    <Select.Value placeholder="--:--" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content
                      className="w-full"
                      presentation="popover"
                      width="trigger"
                    >
                      <Select.ListLabel className="mb-2">
                        Fim do período
                      </Select.ListLabel>
                      <ScrollShadow color="surface" style={{ maxHeight: 450 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                          {endOptions.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </ScrollView>
                      </ScrollShadow>
                    </Select.Content>
                  </Select.Portal>
                </Select>
              </TextField>
            </View>

            {periodError ? (
              <FieldError isInvalid>{periodError}</FieldError>
            ) : null}

            <ReasonField
              error={reasonError}
              isDisabled={props.isPending}
              onChange={(next) => {
                setReasonError("");
                setReason(next);
              }}
              value={reason}
            />

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={props.isPending}
                onPress={props.onClose}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={props.isPending}
                onPress={() => {
                  handleSubmit().catch(() => undefined);
                }}
                size="sm"
              >
                <Button.Label>Fechar quadra</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
