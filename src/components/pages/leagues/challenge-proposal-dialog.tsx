import {
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  Select,
  TextField,
} from "heroui-native";
import { Calendar, DatePicker } from "heroui-native-pro";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { getSelectedOption } from "@/lib/collections";
import { buildChallengeTimeOptions } from "@/lib/leagues/challenge-schedule";
import type { ApiOutputs } from "@convex/shared/api";
import type { LeagueCourt } from "@convex/domains/league/contract";
import type { CalendarDate } from "@internationalized/date";
import { getLocalTimeZone, today } from "@internationalized/date";

type ChallengeProposalDialogValue = {
  courtId: string;
  endMinute: number;
  matchDate: string;
  startMinute: number;
};

type DatePickerOption = {
  label: string;
  value: string;
};

type OccupiedChallengeSlot =
  ApiOutputs["league"]["challenges"]["listOccupiedSlots"][number];

type ChallengeProposalDialogProps = {
  actionLabel: string;
  challengeIdToIgnore?: string;
  courts: LeagueCourt[];
  defaultDurationMinutes: number;
  initialValue?: ChallengeProposalDialogValue;
  isOpen: boolean;
  isPending?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  occupiedSlots: OccupiedChallengeSlot[];
  onSubmit: (value: ChallengeProposalDialogValue) => Promise<void> | void;
  opponentName: string;
  title: string;
};

const MATCH_DATE_LOCALE = "pt-BR";

function formatMatchDate(date: CalendarDate) {
  // Anchored to UTC so the displayed label matches the weekday key used by
  // getDayKeyFromMatchDate (which drives court availability). Mixing the device
  // local zone here would render a date that disagrees with the availability
  // filter for users west of UTC.
  return new Intl.DateTimeFormat(MATCH_DATE_LOCALE, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date.toDate("UTC"));
}

function buildDateOption(value?: string): DatePickerOption | undefined {
  if (!value) {
    return;
  }

  const currentDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(currentDate.getTime())) {
    return;
  }

  return {
    label: new Intl.DateTimeFormat(MATCH_DATE_LOCALE, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(currentDate),
    value,
  };
}

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

export const ChallengeProposalDialog = (
  props: ChallengeProposalDialogProps
) => {
  const {
    actionLabel,
    challengeIdToIgnore,
    courts,
    defaultDurationMinutes,
    initialValue,
    isOpen,
    isPending,
    onOpenChange,
    occupiedSlots,
    onSubmit,
    opponentName,
    title,
  } = props;
  const [matchDate, setMatchDate] = useState<DatePickerOption | undefined>(
    buildDateOption(initialValue?.matchDate)
  );
  const [startMinute, setStartMinute] = useState<string | undefined>(
    initialValue?.startMinute === undefined
      ? undefined
      : String(initialValue.startMinute)
  );
  const [courtId, setCourtId] = useState(initialValue?.courtId ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMatchDate(buildDateOption(initialValue?.matchDate));
    setStartMinute(
      initialValue?.startMinute === undefined
        ? undefined
        : String(initialValue.startMinute)
    );
    setCourtId(initialValue?.courtId ?? "");
    setErrorMessage("");
  }, [initialValue, isOpen]);

  const selectedDayKey = useMemo(
    () => getDayKeyFromMatchDate(matchDate?.value),
    [matchDate]
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
  const startTimeOptions = useMemo(() => {
    if (!(matchDate?.value && selectedDayKey && selectedCourt)) {
      return [];
    }

    return buildChallengeTimeOptions({
      challengeIdToIgnore,
      courtId: selectedCourt.id,
      durationMinutes: defaultDurationMinutes,
      matchDate: matchDate.value,
      occupiedSlots,
      ranges: selectedCourt.availability[selectedDayKey],
    });
  }, [
    challengeIdToIgnore,
    defaultDurationMinutes,
    matchDate?.value,
    occupiedSlots,
    selectedCourt,
    selectedDayKey,
  ]);

  useEffect(() => {
    if (!selectedDayKey) {
      setCourtId("");
      setStartMinute(undefined);
      return;
    }

    if (!availableCourts.some((court) => court.id === courtId)) {
      setCourtId("");
      setStartMinute(undefined);
    }
  }, [availableCourts, courtId, selectedDayKey]);

  useEffect(() => {
    if (!(selectedCourt && selectedDayKey)) {
      setStartMinute(undefined);
      return;
    }

    if (
      startMinute &&
      !startTimeOptions.some(
        (option) => option.value === startMinute && !option.isDisabled
      )
    ) {
      setStartMinute(undefined);
    }
  }, [selectedCourt, selectedDayKey, startMinute, startTimeOptions]);

  async function handleSubmit() {
    if (!(matchDate?.value && courtId) || startMinute === undefined) {
      setErrorMessage("Preencha data, quadra e horário.");
      return;
    }

    const selectedStartTimeOption = startTimeOptions.find(
      (option) => option.value === startMinute
    );

    if (selectedStartTimeOption?.isDisabled) {
      setErrorMessage("Esse horário já está reservado para outro desafio.");
      return;
    }

    setErrorMessage("");
    await onSubmit({
      courtId,
      endMinute: Number(startMinute) + defaultDurationMinutes,
      matchDate: matchDate.value,
      startMinute: Number(startMinute),
    });
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
            <Dialog.Close className="absolute top-4 right-4 z-100" />
          )}
          <Dialog.Title>{title}</Dialog.Title>
          <Description>
            Preencha{" "}
            <Text color="foreground" variant="description" weight="semibold">
              data
            </Text>
            ,{" "}
            <Text color="foreground" variant="description" weight="semibold">
              horário
            </Text>{" "}
            e{" "}
            <Text color="foreground" variant="description" weight="semibold">
              quadra
            </Text>{" "}
            para combinar o desafio com{" "}
            <Text color="foreground" variant="description" weight="semibold">
              {opponentName}
            </Text>
            .
          </Description>

          <DatePicker
            formatDate={formatMatchDate}
            isRequired
            locale={MATCH_DATE_LOCALE}
            onValueChange={(nextValue) => {
              if (!nextValue || Array.isArray(nextValue)) {
                setMatchDate(undefined);
                return;
              }

              setMatchDate({
                label: nextValue.label,
                value: String(nextValue.value),
              });
            }}
            value={matchDate}
          >
            <Label>Data</Label>
            <DatePicker.Select isDisabled={isPending} presentation="popover">
              <DatePicker.Trigger className="bg-surface-secondary">
                <DatePicker.Value
                  className="font-normal"
                  placeholder="Selecione uma data"
                />
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
              <DatePicker.Portal>
                <DatePicker.Overlay />
                <DatePicker.Content presentation="popover" width="trigger">
                  <DatePicker.Calendar
                    locale={MATCH_DATE_LOCALE}
                    minValue={today(getLocalTimeZone())}
                  >
                    <Calendar.Header>
                      <Calendar.Heading />
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell day={day} />}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                  </DatePicker.Calendar>
                </DatePicker.Content>
              </DatePicker.Portal>
            </DatePicker.Select>
          </DatePicker>

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
                <Select.Content presentation="popover" width="trigger">
                  {availableCourts.length === 0 ? (
                    <EmptyState
                      description="Escolha outra data ou cadastre disponibilidade nas quadras da liga."
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
                </Select.Content>
              </Select.Portal>
            </Select>
          </TextField>

          <View className="flex-row gap-3">
            <TextField className="flex-1" isRequired>
              <Label>Horário</Label>
              <Select
                isDisabled={isPending || !selectedCourt}
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

          <View className="self-end">
            <Button
              isDisabled={isPending}
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
