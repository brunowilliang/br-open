import {
  Button,
  Dialog,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleDateField } from "@/components/ui/schedule-date-field";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { getSelectedOption } from "@/lib/collections";
import {
  resolveScheduleProposalForm,
  type ScheduleProposalFormValue,
} from "@/lib/scheduling/schedule-proposal-form";
import { resolveScheduleDateBounds } from "@/lib/scheduling/schedule-view";
import { isSameScheduleSlot } from "@/lib/scheduling/slot-equality";
import { buildSlotTimeOptions } from "@/lib/scheduling/slot-options";
import type { Court } from "@convex/domains/match/contract";
import type { TournamentUnavailability } from "@convex/domains/tournament/unavailability-rules";
import { brazilDayKey } from "@convex/domains/tournament/window-rules";

/** Slot ocupado NEUTRO: cada domínio manda o id dele (`challengeId`,
 * `matchId`) e o adapter renomeia para `slotId` na fronteira. */
export type OccupiedSlot = {
  courtId: string;
  endMinute: number;
  matchDate: string;
  slotId: string;
  startMinute: number;
};

type ScheduleProposalDialogProps = {
  actionLabel: string;
  slotIdToIgnore?: string;
  courts: Court[];
  defaultDurationMinutes: number;
  /** Copy do domínio que usa o diálogo (a peça não traz texto de liga). */
  description: ReactNode;
  initialValue?: ScheduleProposalFormValue;
  isOpen: boolean;
  isPending?: boolean;
  /** Torneio SEM quadra cadastrada não exige quadra no acerto (o contrato aceita
   * `courtId` nulo e o horário sai pelo dia inteiro). Ausente = exigida, como no
   * agendamento do organizador, que é por quadra. */
  isCourtRequired?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  occupiedSlots: OccupiedSlot[];
  onSubmit: (value: ScheduleProposalFormValue) => Promise<void> | void;
  title: string;
  /** Bloqueios de indisponibilidade do torneio (lista CRUA, a mesma do
   * servidor): horário coberto por bloqueio não entra na lista. */
  unavailabilityBlocks: TournamentUnavailability[];
  /** Aviso (neutro) enquanto o slot for o MESMO do `initialValue`: o envio fica
   * bloqueado e aviso e bloqueio caem juntos na primeira mudança. Ausente = o
   * diálogo aceita repetir (o reagendamento do organizador é um no-op). */
  unchangedMessage?: string;
  /** Janela do torneio: fora dela o dia não é selecionável (o servidor recusa
   * de todo jeito). Ausente = torneio sem fim, o calendário de sempre. */
  windowEndDayKey?: null | string;
  windowStartDayKey?: null | string;
};

function getDayKeyFromMatchDate(matchDate?: string) {
  if (!matchDate) {
    return null;
  }

  const parsedDate = new Date(`${matchDate}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const dayOfWeek = parsedDate.getUTCDay();

  switch (dayOfWeek) {
    case 0:
      return "sun";
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    default:
      return "sat";
  }
}

export const ScheduleProposalDialog = (props: ScheduleProposalDialogProps) => {
  const {
    actionLabel,
    slotIdToIgnore,
    courts,
    defaultDurationMinutes,
    description,
    initialValue,
    isCourtRequired = true,
    isOpen,
    isPending,
    onOpenChange,
    occupiedSlots,
    onSubmit,
    title,
    unchangedMessage,
    unavailabilityBlocks,
    windowEndDayKey,
    windowStartDayKey,
  } = props;
  const [matchDate, setMatchDate] = useState<string | undefined>(
    initialValue?.matchDate
  );
  const [startMinute, setStartMinute] = useState<string | undefined>(
    initialValue?.startMinute === undefined
      ? undefined
      : String(initialValue.startMinute)
  );
  const [courtId, setCourtId] = useState<null | string>(
    initialValue?.courtId ?? null
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMatchDate(initialValue?.matchDate);
    setStartMinute(
      initialValue?.startMinute === undefined
        ? undefined
        : String(initialValue.startMinute)
    );
    setCourtId(initialValue?.courtId ?? null);
    setErrorMessage("");
  }, [initialValue, isOpen]);

  const selectedDayKey = useMemo(
    () => getDayKeyFromMatchDate(matchDate),
    [matchDate]
  );
  // O calendário só oferece os dias da janela: o mesmo dia do torneio é o dia
  // BRASILEIRO (a convenção do `matchDate` no servidor).
  const dateBounds = useMemo(
    () =>
      resolveScheduleDateBounds({
        endDayKey: windowEndDayKey ?? null,
        startDayKey: windowStartDayKey ?? null,
        todayDayKey: brazilDayKey(Date.now()),
      }),
    [windowEndDayKey, windowStartDayKey]
  );
  const availableCourts = useMemo(() => {
    if (!selectedDayKey) {
      return [];
    }

    return courts.filter(
      (court) => court.availability[selectedDayKey].length > 0
    );
  }, [courts, selectedDayKey]);
  const selectedCourt = useMemo(
    () => availableCourts.find((court) => court.id === courtId),
    [availableCourts, courtId]
  );
  const skipsCourt = courts.length === 0 && !isCourtRequired;
  const startTimeOptions = useMemo(() => {
    // Sem quadra cadastrada o acerto é data + horário: o dia inteiro é a faixa
    // oferecida e nenhum slot bloqueia (o servidor ignora conflito de quadra).
    if (skipsCourt) {
      return matchDate
        ? buildSlotTimeOptions({
            courtId: null,
            durationMinutes: defaultDurationMinutes,
            matchDate,
            occupiedSlots: [],
            ranges: [{ endMinute: 1440, startMinute: 0 }],
            unavailabilityBlocks,
          })
        : [];
    }

    if (!(matchDate && selectedDayKey && selectedCourt)) {
      return [];
    }

    return buildSlotTimeOptions({
      courtId: selectedCourt.id,
      durationMinutes: defaultDurationMinutes,
      matchDate,
      occupiedSlots,
      ranges: selectedCourt.availability[selectedDayKey],
      slotIdToIgnore,
      unavailabilityBlocks,
    });
  }, [
    defaultDurationMinutes,
    matchDate,
    occupiedSlots,
    selectedCourt,
    selectedDayKey,
    skipsCourt,
    slotIdToIgnore,
    unavailabilityBlocks,
  ]);

  useEffect(() => {
    if (skipsCourt) {
      return;
    }

    if (!selectedDayKey) {
      setCourtId(null);
      setStartMinute(undefined);
      return;
    }

    if (!availableCourts.some((court) => court.id === courtId)) {
      setCourtId(null);
      setStartMinute(undefined);
    }
  }, [availableCourts, courtId, selectedDayKey, skipsCourt]);

  useEffect(() => {
    if (
      startMinute &&
      !startTimeOptions.some(
        (option) => option.value === startMinute && !option.isDisabled
      )
    ) {
      setStartMinute(undefined);
    }
  }, [startMinute, startTimeOptions]);

  // Prefill = o que está na mesa: enquanto o valor for o mesmo não há proposta
  // nova a enviar. Derivado a cada render, então o aviso e o bloqueio do botão
  // caem juntos na primeira mudança de campo.
  const isSameAsTable = Boolean(
    unchangedMessage &&
      initialValue &&
      matchDate &&
      startMinute !== undefined &&
      (!isCourtRequired || courtId) &&
      isSameScheduleSlot(initialValue, {
        courtId: courtId ?? null,
        matchDate,
        startMinute: Number(startMinute),
      })
  );

  async function handleSubmit() {
    const submission = resolveScheduleProposalForm({
      courtId,
      defaultDurationMinutes,
      isCourtRequired,
      matchDate,
      startMinute,
    });

    if (submission.error !== null) {
      setErrorMessage(submission.error);
      return;
    }

    const selectedStartTimeOption = startTimeOptions.find(
      (option) => option.value === startMinute
    );

    if (selectedStartTimeOption?.isDisabled) {
      setErrorMessage("Esse horário já está reservado.");
      return;
    }

    setErrorMessage("");
    await onSubmit(submission.value);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          {isPending ? null : (
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
          )}
          <Dialog.Title>{title}</Dialog.Title>
          <Text color="muted" variant="description">
            {description}
          </Text>

          <ScheduleDateField
            isDisabled={isPending}
            maxDayKey={dateBounds.maxDayKey}
            minDayKey={dateBounds.minDayKey}
            onChange={setMatchDate}
            value={matchDate}
          />

          {skipsCourt ? null : (
            <TextField isRequired>
              <Label>Quadra</Label>
              <Select
                isDisabled={isPending || !selectedDayKey}
                onValueChange={(nextValue) => {
                  if (!nextValue || Array.isArray(nextValue)) {
                    return;
                  }

                  setCourtId(String(nextValue.value));
                  setStartMinute(undefined);
                }}
                selectionMode="single"
                value={getSelectedOption(
                  availableCourts.map((court) => ({
                    label: court.name,
                    value: court.id,
                  })),
                  courtId
                )}
              >
                <Select.Trigger className="bg-surface-secondary">
                  <Select.Value
                    className="font-normal"
                    placeholder={
                      selectedDayKey
                        ? "Escolha uma quadra"
                        : "Selecione a data primeiro"
                    }
                  />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <SelectScrollContent width="trigger">
                    {availableCourts.length === 0 ? (
                      <EmptyState
                        description="Escolha outra data ou cadastre a disponibilidade das quadras."
                        icon={null}
                        title="Nenhuma quadra disponível nesse dia"
                      />
                    ) : (
                      availableCourts.map((court) => (
                        <SelectOptionItem
                          key={court.id}
                          label={court.name}
                          value={court.id}
                        />
                      ))
                    )}
                  </SelectScrollContent>
                </Select.Portal>
              </Select>
            </TextField>
          )}

          <View className="flex-row gap-3">
            <TextField className="flex-1" isRequired>
              <Label>Horário</Label>
              <Select
                isDisabled={
                  isPending ||
                  !(skipsCourt ? Boolean(matchDate) : Boolean(selectedCourt))
                }
                onValueChange={(nextValue) => {
                  if (!nextValue || Array.isArray(nextValue)) {
                    return;
                  }

                  setStartMinute(String(nextValue.value));
                }}
                presentation="popover"
                selectionMode="single"
                value={getSelectedOption(startTimeOptions, startMinute)}
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
                      Horário
                    </Select.ListLabel>
                    <ScrollShadow color="surface" style={{ maxHeight: 450 }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {startTimeOptions.length === 0 ? (
                          <EmptyState
                            description="Não existe horário disponível para a duração definida da partida."
                            icon={null}
                            title="Nenhum horário disponível"
                          />
                        ) : (
                          startTimeOptions.map((option) => (
                            <SelectOptionItem
                              description={option.description}
                              isDisabled={option.isDisabled}
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))
                        )}
                      </ScrollView>
                    </ScrollShadow>
                  </Select.Content>
                </Select.Portal>
              </Select>
            </TextField>
          </View>
          <FieldError isInvalid={Boolean(errorMessage)}>
            {errorMessage}
          </FieldError>

          {isSameAsTable && unchangedMessage ? (
            <Text color="muted" size="xs">
              {unchangedMessage}
            </Text>
          ) : null}

          <View className="self-end">
            <Button
              isDisabled={isPending || isSameAsTable}
              onPress={() => {
                handleSubmit().catch(() => undefined);
              }}
              size="sm"
            >
              <Button.Label>{actionLabel}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
