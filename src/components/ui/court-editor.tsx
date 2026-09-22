import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { getSelectedOption } from "@/lib/collections";
import {
  applyCourtRange,
  buildCourtTimeOptions,
  COURT_DAYS,
  type CourtTimeRange,
} from "@/lib/courts/court-availability";
import { formatMinuteToHHMM } from "@/lib/format/time";
import type {
  LeagueCourt,
  LeagueCourtDay,
} from "@convex/domains/league/contract";
import {
  Add01Icon,
  Cancel01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionLayoutTransition,
  Button,
  Chip,
  Description,
  Dialog,
  FieldError,
  Input,
  Label,
  ListGroup,
  Select,
  Separator,
  Tabs,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/core/text";

const DAY_LABELS: Record<LeagueCourtDay, string> = {
  fri: "Sex",
  mon: "Seg",
  sat: "Sab",
  sun: "Dom",
  thu: "Qui",
  tue: "Ter",
  wed: "Qua",
};

const DAY_OPTIONS = COURT_DAYS.map((day) => ({
  key: day,
  label: DAY_LABELS[day],
}));

const TIME_OPTIONS = buildCourtTimeOptions();

function normalizeCourtName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function buildEmptyAvailability() {
  return {
    fri: [],
    mon: [],
    sat: [],
    sun: [],
    thu: [],
    tue: [],
    wed: [],
  } satisfies LeagueCourt["availability"];
}

let courtIdCounter = 0;
function buildCourtId(): string {
  // Monotonic counter + timestamp + random suffix. Avoids the collision risk
  // of Date.now()+Math.random() under fast double-tap (same millisecond +
  // short random suffix) without needing the `crypto` global, which is not
  // available in the Hermes runtime by default.
  courtIdCounter += 1;
  return `court-${Date.now()}-${courtIdCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getDayLabel(day: LeagueCourtDay) {
  return DAY_OPTIONS.find((option) => option.key === day)?.label ?? "";
}

function getCourtAvailabilityDescription(court: LeagueCourt) {
  const rangeCount = DAY_OPTIONS.reduce(
    (total, day) => total + court.availability[day.key].length,
    0
  );

  if (rangeCount === 0) {
    return "Nenhum horário cadastrado.";
  }

  if (rangeCount === 1) {
    return "1 horário disponível.";
  }

  return `${rangeCount} horários disponíveis.`;
}

type CourtsFormValues = {
  courts: LeagueCourt[];
};

/** Escreve no campo `courts` do RHF context do form hospedeiro: header, menu
 * "Salvar" e estados de submit ficam na rota de cada wizard. */
export function CourtEditor(props: { isDisabled: boolean }) {
  const isDisabled = props.isDisabled;
  const { control, getValues, setValue } = useFormContext<CourtsFormValues>();
  const { errors: formStateErrors } = useFormState({
    control,
    name: "courts",
  });
  const value = useWatch({
    control,
    defaultValue: getValues("courts"),
    name: "courts",
  });
  const error =
    typeof formStateErrors.courts?.message === "string"
      ? formStateErrors.courts.message
      : undefined;
  const [activeDayByCourt, setActiveDayByCourt] = useState<
    Partial<Record<string, LeagueCourtDay>>
  >({});
  const [draftName, setDraftName] = useState("");
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [isCourtDialogOpen, setIsCourtDialogOpen] = useState(false);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rangeCourtId, setRangeCourtId] = useState<string | null>(null);
  const [rangeDay, setRangeDay] = useState<LeagueCourtDay | null>(null);
  const [rangeDays, setRangeDays] = useState<LeagueCourtDay[]>([]);
  const [rangeEndMinute, setRangeEndMinute] = useState<string | undefined>();
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [editingRange, setEditingRange] = useState<{
    endMinute: number;
    startMinute: number;
  } | null>(null);
  const [rangeStartMinute, setRangeStartMinute] = useState<
    string | undefined
  >();

  const editingCourt =
    editingCourtId === null
      ? null
      : (value.find((court) => court.id === editingCourtId) ?? null);
  const isEditingCourt = editingCourt !== null;

  const rangeDialogCourt =
    rangeCourtId === null
      ? null
      : (value.find((court) => court.id === rangeCourtId) ?? null);
  const isEditingRange = editingRange !== null;
  const allDaysSelected = rangeDays.length === DAY_OPTIONS.length;
  const rangeActionLabel = isEditingRange ? "Editar" : "Adicionar";
  const endTimeOptions = rangeStartMinute
    ? TIME_OPTIONS.filter(
        (option) => Number(option.value) > Number(rangeStartMinute)
      )
    : TIME_OPTIONS;
  const rangeDialogTitle =
    isEditingRange && rangeDay !== null
      ? `${rangeActionLabel} Horário · ${getDayLabel(rangeDay)}`
      : `${rangeActionLabel} Horário`;

  function onChange(nextValue: LeagueCourt[]) {
    setValue("courts", nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function getActiveDay(courtId: string) {
    return activeDayByCourt[courtId] ?? "mon";
  }

  function resetCourtDialogState() {
    setDraftName("");
    setEditingCourtId(null);
    setNameError(null);
  }

  function closeCourtDialog() {
    setIsCourtDialogOpen(false);
    resetCourtDialogState();
  }

  function openCreateCourtDialog() {
    resetCourtDialogState();
    setIsCourtDialogOpen(true);
  }

  function openEditCourtDialog(court: LeagueCourt) {
    setDraftName(court.name);
    setEditingCourtId(court.id);
    setNameError(null);
    setIsCourtDialogOpen(true);
  }

  function handleDraftNameChange(nextValue: string) {
    setDraftName(nextValue);

    if (nameError && nextValue.trim()) {
      setNameError(null);
    }
  }

  function handleSaveCourt() {
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setNameError("Informe o nome da quadra.");
      return;
    }

    const normalizedName = normalizeCourtName(trimmedName);
    const hasDuplicateName = value.some(
      (court) =>
        court.id !== editingCourtId &&
        normalizeCourtName(court.name) === normalizedName
    );

    if (hasDuplicateName) {
      setNameError("Já existe uma quadra com esse nome.");
      return;
    }

    if (editingCourtId !== null) {
      onChange(
        value.map((court) =>
          court.id === editingCourtId ? { ...court, name: trimmedName } : court
        )
      );
      closeCourtDialog();
      return;
    }

    onChange([
      ...value,
      {
        availability: buildEmptyAvailability(),
        id: buildCourtId(),
        name: trimmedName,
      },
    ]);
    closeCourtDialog();
  }

  function handleRemoveCourt(courtId: string) {
    onChange(value.filter((court) => court.id !== courtId));
    closeCourtDialog();
  }

  function resetRangeDialogState() {
    setRangeCourtId(null);
    setRangeDay(null);
    setRangeDays([]);
    setRangeStartMinute(undefined);
    setRangeEndMinute(undefined);
    setRangeError(null);
    setEditingRange(null);
  }

  function closeRangeDialog() {
    setIsRangeDialogOpen(false);
    resetRangeDialogState();
  }

  function openRangeDialog(
    courtId: string,
    day: LeagueCourtDay,
    range?: {
      endMinute: number;
      startMinute: number;
    }
  ) {
    setRangeCourtId(courtId);
    setRangeDay(day);
    setRangeDays([day]);
    setRangeStartMinute(range ? String(range.startMinute) : undefined);
    setRangeEndMinute(range ? String(range.endMinute) : undefined);
    setRangeError(null);
    setEditingRange(range ?? null);
    setIsRangeDialogOpen(true);
  }

  function applyDayPreset(days: readonly LeagueCourtDay[]) {
    setRangeError(null);
    setRangeDays(
      DAY_OPTIONS.map((option) => option.key).filter((day) =>
        days.includes(day)
      )
    );
  }

  function toggleRangeDay(day: LeagueCourtDay) {
    setRangeError(null);
    setRangeDays((currentDays) => {
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day];

      return DAY_OPTIONS.map((option) => option.key).filter((orderedDay) =>
        nextDays.includes(orderedDay)
      );
    });
  }

  function handleAddRange() {
    if (!(rangeDialogCourt && rangeDay)) {
      return;
    }

    if (!(rangeStartMinute && rangeEndMinute)) {
      setRangeError("Selecione o horário inicial e final.");
      return;
    }

    if (rangeDays.length === 0) {
      setRangeError("Selecione pelo menos um dia.");
      return;
    }

    const startMinute = Number(rangeStartMinute);
    const endMinute = Number(rangeEndMinute);

    if (Number.isNaN(startMinute) || Number.isNaN(endMinute)) {
      setRangeError("Selecione horários válidos.");
      return;
    }

    if (startMinute >= endMinute) {
      setRangeError("O horário inicial deve ser menor que o horário final.");
      return;
    }

    const result = applyCourtRange({
      court: rangeDialogCourt,
      days: rangeDays,
      endMinute,
      replacing: editingRange
        ? {
            day: rangeDay,
            range: editingRange satisfies CourtTimeRange,
          }
        : undefined,
      startMinute,
    });

    if (result.status === "conflict") {
      setRangeError(
        `Esse horário conflita com horários já cadastrados em: ${result.conflictDays
          .map(getDayLabel)
          .join(", ")}.`
      );
      return;
    }

    onChange(
      value.map((court) =>
        court.id === rangeDialogCourt.id ? result.court : court
      )
    );
    closeRangeDialog();
  }

  function handleRemoveRange(
    courtId: string,
    day: LeagueCourtDay,
    startMinute: number,
    endMinute: number
  ) {
    onChange(
      value.map((court) =>
        court.id === courtId
          ? {
              ...court,
              availability: {
                ...court.availability,
                [day]: court.availability[day].filter(
                  (range) =>
                    !(
                      range.startMinute === startMinute &&
                      range.endMinute === endMinute
                    )
                ),
              },
            }
          : court
      )
    );
  }

  return (
    <>
      {value.length === 0 && (
        <EmptyState
          buttonIsDisabled={isDisabled}
          buttonLabel="Adicionar Quadra"
          buttonOnPress={openCreateCourtDialog}
          description="Adicione uma quadra para configurar os horários disponíveis."
          title="Nenhuma quadra cadastrada"
        />
      )}
      {error && <ErrorMessage message={error} />}

      {value.length > 0 && (
        <Animated.View className="gap-5" layout={AccordionLayoutTransition}>
          <Accordion
            classNames={{ container: "gap-3 overflow-visible" }}
            hideSeparator
            selectionMode="multiple"
          >
            {value.map((court) => (
              <Accordion.Item
                className="rounded-3xl border border-surface bg-surface shadow-surface"
                key={court.id}
                value={court.id}
              >
                <Accordion.Trigger className="px-3 py-3">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text pointerEvents="none" weight="medium">
                        {court.name}
                      </Text>
                      <Text color="muted" variant="description">
                        {getCourtAvailabilityDescription(court)}
                      </Text>
                    </View>
                    <Button
                      isDisabled={isDisabled}
                      isIconOnly
                      onPress={(event) => {
                        event.stopPropagation();
                        openEditCourtDialog(court);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <HugeIcons className="size-4.5" icon={Edit02Icon} />
                    </Button>
                    <Accordion.Indicator />
                  </View>
                </Accordion.Trigger>
                <Accordion.Content>
                  <View className="gap-4 pt-2">
                    <Tabs
                      onValueChange={(nextValue) => {
                        if (typeof nextValue !== "string") {
                          return;
                        }

                        setActiveDayByCourt((currentValue) => ({
                          ...currentValue,
                          [court.id]: nextValue as LeagueCourtDay,
                        }));
                      }}
                      value={getActiveDay(court.id)}
                    >
                      <Tabs.List className="w-full">
                        <Tabs.ScrollView>
                          <Tabs.Indicator />
                          {DAY_OPTIONS.map((day) => (
                            <Tabs.Trigger
                              className="flex-1"
                              key={`${court.id}-${day.key}`}
                              value={day.key}
                            >
                              <Tabs.Label>{day.label}</Tabs.Label>
                            </Tabs.Trigger>
                          ))}
                        </Tabs.ScrollView>
                      </Tabs.List>

                      {DAY_OPTIONS.map((day) => {
                        const dayRanges = court.availability[day.key];

                        return (
                          <Tabs.Content
                            className="gap-4 pt-2"
                            key={`${court.id}-${day.key}-content`}
                            value={day.key}
                          >
                            {dayRanges.length === 0 ? (
                              <EmptyState
                                buttonIcon={null}
                                buttonIsDisabled={isDisabled}
                                buttonLabel="Adicionar Horário"
                                buttonOnPress={() => {
                                  openRangeDialog(court.id, day.key);
                                }}
                                buttonVariant="secondary"
                                description="Adicione os horários disponíveis para este dia."
                                title="Nenhum horário cadastrado"
                              />
                            ) : (
                              <View className="gap-3">
                                <ListGroup>
                                  {dayRanges.map((range, index) => (
                                    <View
                                      key={`${court.id}-${day.key}-${range.startMinute}-${range.endMinute}`}
                                    >
                                      {index > 0 ? (
                                        <Separator className="mx-4" />
                                      ) : null}
                                      <ListGroup.Item
                                        className="bg-surface-secondary"
                                        disabled
                                      >
                                        <ListGroup.ItemContent>
                                          <ListGroup.ItemTitle>
                                            {formatMinuteToHHMM(
                                              range.startMinute
                                            )}{" "}
                                            ·{" "}
                                            {formatMinuteToHHMM(
                                              range.endMinute
                                            )}
                                          </ListGroup.ItemTitle>
                                        </ListGroup.ItemContent>
                                        <ListGroup.ItemSuffix className="flex-row gap-1">
                                          <Button
                                            isDisabled={isDisabled}
                                            isIconOnly
                                            onPress={() => {
                                              openRangeDialog(
                                                court.id,
                                                day.key,
                                                {
                                                  endMinute: range.endMinute,
                                                  startMinute:
                                                    range.startMinute,
                                                }
                                              );
                                            }}
                                            size="sm"
                                            variant="secondary"
                                          >
                                            <HugeIcons
                                              className="size-4.5"
                                              icon={Edit02Icon}
                                            />
                                          </Button>
                                          <Button
                                            isDisabled={isDisabled}
                                            isIconOnly
                                            onPress={() => {
                                              handleRemoveRange(
                                                court.id,
                                                day.key,
                                                range.startMinute,
                                                range.endMinute
                                              );
                                            }}
                                            size="sm"
                                            variant="danger-soft"
                                          >
                                            <HugeIcons
                                              className="size-4.5 text-danger"
                                              icon={Cancel01Icon}
                                            />
                                          </Button>
                                        </ListGroup.ItemSuffix>
                                      </ListGroup.Item>
                                    </View>
                                  ))}
                                </ListGroup>

                                <Button
                                  className="self-center"
                                  isDisabled={isDisabled}
                                  onPress={() => {
                                    openRangeDialog(court.id, day.key);
                                  }}
                                  variant="secondary"
                                >
                                  Adicionar Horário
                                </Button>
                              </View>
                            )}
                          </Tabs.Content>
                        );
                      })}
                    </Tabs>
                  </View>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion>

          <Animated.View layout={AccordionLayoutTransition}>
            <Button
              className="self-center"
              isDisabled={isDisabled}
              onPress={openCreateCourtDialog}
              variant="secondary"
            >
              <Button.Label>Adicionar Nova Quadra</Button.Label>
              <HugeIcons className="text-accent" icon={Add01Icon} />
            </Button>
          </Animated.View>
        </Animated.View>
      )}
      <Dialog
        isOpen={isCourtDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsCourtDialogOpen(nextOpen);

          if (!nextOpen) {
            resetCourtDialogState();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <KeyboardAvoidingView behavior="padding">
            <Dialog.Content className="gap-4 p-5">
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
              <Dialog.Title>
                {isEditingCourt ? "Editar Quadra" : "Criar Quadra"}
              </Dialog.Title>

              <TextField isInvalid={Boolean(nameError)} isRequired>
                <Label>Nome da quadra</Label>
                <Input
                  autoCapitalize="words"
                  className="bg-surface-secondary"
                  editable={!isDisabled}
                  onChangeText={handleDraftNameChange}
                  onSubmitEditing={handleSaveCourt}
                  placeholder="Ex.: Quadra 1"
                  returnKeyType="done"
                  value={draftName}
                  variant="secondary"
                />
                <Description>
                  {isEditingCourt
                    ? "Atualize o nome da quadra para ajustar a identificação."
                    : "A quadra será criada e os horários podem ser configurados depois."}
                </Description>
                <FieldError>{nameError ?? ""}</FieldError>
              </TextField>

              <View className="flex-row gap-2 self-end">
                {isEditingCourt ? (
                  <Button
                    isDisabled={isDisabled || !editingCourtId}
                    onPress={() => {
                      if (!editingCourtId) {
                        return;
                      }

                      handleRemoveCourt(editingCourtId);
                    }}
                    size="sm"
                    variant="danger-soft"
                  >
                    <Button.Label>Remover</Button.Label>
                  </Button>
                ) : null}
                <Button
                  isDisabled={isDisabled}
                  onPress={handleSaveCourt}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>
                    {isEditingCourt ? "Salvar" : "Adicionar"}
                  </Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </KeyboardAvoidingView>
        </Dialog.Portal>
      </Dialog>
      <Dialog
        isOpen={isRangeDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsRangeDialogOpen(nextOpen);

          if (!nextOpen) {
            resetRangeDialogState();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <KeyboardAvoidingView behavior="padding">
            <Dialog.Content className="gap-4 p-5">
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
              <Dialog.Title>{rangeDialogTitle}</Dialog.Title>

              <Text color="muted" variant="description">
                {rangeDialogCourt
                  ? `Adicione um horário disponível para ${rangeDialogCourt.name}.`
                  : "Selecione o horário disponível."}
              </Text>
              {isEditingRange ? null : (
                <View className="gap-2">
                  <Text weight="medium">Dias</Text>
                  <ScrollShadow color="surface">
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View className="flex-row gap-1">
                        <Chip
                          color={allDaysSelected ? "accent" : "default"}
                          disabled={isDisabled}
                          onPress={() => {
                            applyDayPreset(allDaysSelected ? [] : COURT_DAYS);
                          }}
                          size="md"
                          variant="soft"
                        >
                          <Chip.Label>Todos</Chip.Label>
                        </Chip>
                        {DAY_OPTIONS.map((option) => {
                          const isDaySelected = rangeDays.includes(option.key);

                          return (
                            <Chip
                              color={isDaySelected ? "accent" : "default"}
                              disabled={isDisabled}
                              key={option.key}
                              onPress={() => {
                                toggleRangeDay(option.key);
                              }}
                              size="md"
                              variant="soft"
                            >
                              <Chip.Label>{option.label}</Chip.Label>
                            </Chip>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </ScrollShadow>
                </View>
              )}

              <View className="flex-row gap-3">
                <TextField className="flex-1" isRequired>
                  <Label>Hora inicial</Label>
                  <Select
                    isDisabled={isDisabled}
                    onValueChange={(nextValue) => {
                      if (!nextValue || Array.isArray(nextValue)) {
                        return;
                      }

                      setRangeError(null);
                      setRangeStartMinute(nextValue.value);

                      if (
                        rangeEndMinute &&
                        Number(rangeEndMinute) <= Number(nextValue.value)
                      ) {
                        setRangeEndMinute(undefined);
                      }
                    }}
                    presentation="popover"
                    selectionMode="single"
                    value={getSelectedOption(TIME_OPTIONS, rangeStartMinute)}
                  >
                    <Select.Trigger className="bg-surface-secondary">
                      <Select.Value
                        className="font-normal"
                        placeholder="--:--"
                      />
                      <Select.TriggerIndicator />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Overlay />
                      <SelectScrollContent label="Hora inicial" width="trigger">
                        {TIME_OPTIONS.map((option) => (
                          <SelectOptionItem
                            key={`range-start-${option.value}`}
                            label={option.label}
                            value={option.value}
                          />
                        ))}
                      </SelectScrollContent>
                    </Select.Portal>
                  </Select>
                </TextField>

                <TextField className="flex-1" isRequired>
                  <Label>Hora final</Label>
                  <Select
                    isDisabled={isDisabled}
                    onValueChange={(nextValue) => {
                      if (!nextValue || Array.isArray(nextValue)) {
                        return;
                      }

                      setRangeError(null);
                      setRangeEndMinute(nextValue.value);
                    }}
                    presentation="popover"
                    selectionMode="single"
                    value={getSelectedOption(TIME_OPTIONS, rangeEndMinute)}
                  >
                    <Select.Trigger className="bg-surface-secondary">
                      <Select.Value
                        className="font-normal"
                        placeholder="--:--"
                      />
                      <Select.TriggerIndicator />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Overlay />
                      <SelectScrollContent label="Hora final" width="trigger">
                        {endTimeOptions.map((option) => (
                          <SelectOptionItem
                            key={`range-end-${option.value}`}
                            label={option.label}
                            value={option.value}
                          />
                        ))}
                      </SelectScrollContent>
                    </Select.Portal>
                  </Select>
                </TextField>
              </View>

              <FieldError isInvalid={Boolean(rangeError)}>
                {rangeError ?? ""}
              </FieldError>

              <View className="flex-row gap-2 self-end">
                <Button
                  isDisabled={isDisabled}
                  onPress={handleAddRange}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>
                    {isEditingRange ? "Salvar" : "Adicionar"}
                  </Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </KeyboardAvoidingView>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
