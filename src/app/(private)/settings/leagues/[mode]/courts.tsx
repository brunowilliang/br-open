import { Page } from "@/components/core/page";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";
import type {
  LeagueCourt,
  LeagueCourtDay,
} from "@convex/domains/league/contract";
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Edit02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionLayoutTransition,
  Button,
  Description,
  Dialog,
  FieldError,
  Input,
  Label,
  ListGroup,
  Menu,
  Select,
  Separator,
  Tabs,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

const DAY_OPTIONS: Array<{
  key: LeagueCourtDay;
  label: string;
}> = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sab" },
  { key: "sun", label: "Dom" },
];

const TIME_OPTIONS = Array.from({ length: 49 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return {
    label: `${hours}:${minutes}`,
    value: String(totalMinutes),
  };
});

function normalizeCourtName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function buildEmptyAvailability() {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
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

function formatMinutes(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getSelectedOption(value?: string) {
  if (!value) {
    return;
  }

  return TIME_OPTIONS.find((option) => option.value === value);
}

function getDayLabel(day: LeagueCourtDay) {
  return DAY_OPTIONS.find((option) => option.key === day)?.label ?? "";
}

function hasRangeOverlap(
  ranges: Array<{ endMinute: number; startMinute: number }>
) {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startMinute - right.startMinute
  );

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previousRange = sortedRanges[index - 1];
    const currentRange = sortedRanges[index];

    if (currentRange.startMinute < previousRange.endMinute) {
      return true;
    }
  }

  return false;
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

const LEAGUE_FORM_SUBTITLES = {
  create: "Criar Liga",
  edit: "Editar Liga",
} as const;

export default function LeagueCourtsRoute() {
  const { isSubmitPending, mode, onSubmitPress } = useLeagueFormRoute();
  const isDisabled = isSubmitPending;
  const subtitle = LEAGUE_FORM_SUBTITLES[mode];

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors: formStateErrors } = useFormState({
    control,
    name: "courts",
  });
  const value = useWatch({
    control,
    name: "courts",
    defaultValue: getValues("courts"),
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
  const rangeActionLabel = isEditingRange ? "Editar" : "Adicionar";
  const endTimeOptions = rangeStartMinute
    ? TIME_OPTIONS.filter(
        (option) => Number(option.value) > Number(rangeStartMinute)
      )
    : TIME_OPTIONS;
  const rangeDialogTitle =
    rangeDay === null
      ? `${rangeActionLabel} Horário`
      : `${rangeActionLabel} Horário - ${getDayLabel(rangeDay)}`;

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

  function handleDraftNameChange(value: string) {
    setDraftName(value);

    if (nameError && value.trim()) {
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
        id: buildCourtId(),
        name: trimmedName,
        availability: buildEmptyAvailability(),
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
    setRangeStartMinute(range ? String(range.startMinute) : undefined);
    setRangeEndMinute(range ? String(range.endMinute) : undefined);
    setRangeError(null);
    setEditingRange(range ?? null);
    setIsRangeDialogOpen(true);
  }

  function handleAddRange() {
    if (!(rangeDialogCourt && rangeDay)) {
      return;
    }

    if (!(rangeStartMinute && rangeEndMinute)) {
      setRangeError("Selecione o horário inicial e final.");
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

    const baseRanges = editingRange
      ? rangeDialogCourt.availability[rangeDay].filter(
          (range) =>
            !(
              range.startMinute === editingRange.startMinute &&
              range.endMinute === editingRange.endMinute
            )
        )
      : rangeDialogCourt.availability[rangeDay];

    const nextRanges = [
      ...baseRanges,
      {
        endMinute,
        startMinute,
      },
    ].sort((left, right) => left.startMinute - right.startMinute);

    if (hasRangeOverlap(nextRanges)) {
      setRangeError("Os horários não podem se sobrepor no mesmo dia.");
      return;
    }

    onChange(
      value.map((court) =>
        court.id === rangeDialogCourt.id
          ? {
              ...court,
              availability: {
                ...court.availability,
                [rangeDay]: nextRanges,
              },
            }
          : court
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
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Quadras</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay />
              <Menu.Content presentation="popover">
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle className="flex-none">Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="grow gap-4 px-4 pb-floating-tab-bar-offset-4">
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
                        <Label pointerEvents="none">{court.name}</Label>
                        <Description>
                          {getCourtAvailabilityDescription(court)}
                        </Description>
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
                        // variant="secondary"
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
                                              {formatMinutes(range.startMinute)}{" "}
                                              - {formatMinutes(range.endMinute)}
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
                <Dialog.Close className="absolute top-4 right-4 z-100" />
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
                <Dialog.Close className="absolute top-4 right-4 z-100" />
                <Dialog.Title>{rangeDialogTitle}</Dialog.Title>

                <Description>
                  {rangeDialogCourt
                    ? `Adicione um horário disponível para ${rangeDialogCourt.name}.`
                    : "Selecione o horário disponível."}
                </Description>

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
                      value={getSelectedOption(rangeStartMinute)}
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
                        <Select.Content
                          className="w-full"
                          presentation="popover"
                          width="trigger"
                        >
                          <Select.ListLabel className="mb-2">
                            Hora inicial
                          </Select.ListLabel>
                          <ScrollShadow
                            color="surface"
                            style={{ maxHeight: 450 }}
                          >
                            <ScrollView showsVerticalScrollIndicator={false}>
                              {TIME_OPTIONS.map((option) => (
                                <SelectOptionItem
                                  key={`range-start-${option.value}`}
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
                      value={getSelectedOption(rangeEndMinute)}
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
                        <Select.Content
                          className="w-full"
                          presentation="popover"
                          width="trigger"
                        >
                          <Select.ListLabel className="mb-2">
                            Hora final
                          </Select.ListLabel>
                          <ScrollShadow
                            color="surface"
                            style={{ maxHeight: 450 }}
                          >
                            <ScrollView showsVerticalScrollIndicator={false}>
                              {endTimeOptions.map((option) => (
                                <SelectOptionItem
                                  key={`range-end-${option.value}`}
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
      </Page.ScrollView>
    </Page>
  );
}
