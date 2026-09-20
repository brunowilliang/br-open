import {
  getLocalTimeZone,
  parseDate,
  today,
  type CalendarDate,
} from "@internationalized/date";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Menu,
  PressableFeedback,
  TextArea,
  TextField,
} from "heroui-native";
import { Calendar, DatePicker } from "heroui-native-pro";
import { useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import { HugeIcons } from "@/components/ui/huge-icons";
import { MediaConfirmDialog } from "@/components/ui/media-confirm-dialog";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

const DATE_LOCALE = "pt-BR";

function formatDateLabel(date: CalendarDate) {
  const [year, month, day] = date.toString().split("-");

  return `${day}/${month}/${year}`;
}

function parseCalendarDate(value: string): CalendarDate {
  // `parseDate` is the canonical "YYYY-MM-DD" parse. The previous
  // `today().set({ day, month, year })` mutated today's date field-by-field
  // and silently constrained out-of-range intermediates (e.g. day 31 into a
  // 30-day target month), corrupting the parsed date.
  return parseDate(value);
}

type TournamentDatePickerFieldProps = {
  description: string;
  error?: string;
  isDisabled: boolean;
  label: string;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  name: "registrationDeadlineAt" | "startDate";
};

function TournamentDatePickerField(props: TournamentDatePickerFieldProps) {
  const { control } = useFormContext<TournamentScreenValues>();
  const { field, fieldState } = useController({ control, name: props.name });

  // BUG-0012: the calendar state machine has no defined behavior for
  // minValue > maxValue — the focused date flip-flops between the bounds on
  // every alignment pass and the update loop takes React down (fatal in
  // prod). Editing a tournament whose window is already in the past built
  // exactly that (minValue=today > maxValue=start-1). When the bounds
  // contradict, drop them: the form's Zod refine still enforces
  // "prazo < início" on submit.
  const boundsAreConsistent =
    !(props.minValue && props.maxValue) ||
    props.minValue.compare(props.maxValue) <= 0;
  return (
    <TextField isInvalid={Boolean(fieldState.error)} isRequired>
      <DatePicker
        formatDate={formatDateLabel}
        isRequired
        locale={DATE_LOCALE}
        onValueChange={(nextValue) => {
          if (!nextValue || Array.isArray(nextValue)) {
            return;
          }

          field.onChange(String(nextValue.value));
          field.onBlur();
        }}
        value={
          field.value
            ? {
                label: formatDateLabel(parseCalendarDate(field.value)),
                value: field.value,
              }
            : undefined
        }
      >
        <Label>{props.label}</Label>
        <DatePicker.Select isDisabled={props.isDisabled} presentation="popover">
          <DatePicker.Trigger className="bg-surface-secondary">
            <DatePicker.Value
              className="font-normal"
              placeholder="Selecione a data"
            />
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
          <DatePicker.Portal>
            <DatePicker.Overlay />
            <DatePicker.Content presentation="popover" width="trigger">
              <DatePicker.Calendar
                locale={DATE_LOCALE}
                maxValue={boundsAreConsistent ? props.maxValue : undefined}
                minValue={boundsAreConsistent ? props.minValue : undefined}
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
      <Description>{props.description}</Description>
      <FieldError>{props.error ?? ""}</FieldError>
    </TextField>
  );
}

export default function TournamentDetailsRoute() {
  const {
    avatarUrl,
    coverUrl,
    isMediaBusy,
    isSubmitPending,
    mode,
    onMediaPress,
    onSubmitPress,
  } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;
  const isMediaUploading = isMediaBusy;
  const subtitle = mode === "create" ? "Criar Torneio" : "Editar Torneio";
  const [mediaTarget, setMediaTarget] = useState<null | "avatar" | "cover">(
    null
  );

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }
  const { control, getFieldState } = useFormContext<TournamentScreenValues>();
  const { field: nameField, fieldState: nameState } = useController({
    control,
    name: "name",
  });
  const { field: descriptionField, fieldState: descriptionState } =
    useController({
      control,
      name: "description",
    });
  const startDateState = getFieldState("startDate", control._formState);
  const deadlineState = getFieldState(
    "registrationDeadlineAt",
    control._formState
  );
  const startDateValue = useWatch({ control, name: "startDate" });
  const deadlineMaxValue = startDateValue
    ? parseCalendarDate(startDateValue).subtract({ days: 1 })
    : undefined;
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Detalhes</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay className="bg-backdrop" />
              <Menu.Content presentation="popover" width={240}>
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle>Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <PressableFeedback
          className="aspect-video w-full overflow-hidden rounded-3xl"
          isDisabled={isDisabled || isMediaUploading}
          onPress={() => setMediaTarget("cover")}
        >
          <Image
            className="size-full"
            contentFit="cover"
            fallback="blue"
            source={coverUrl ?? undefined}
          />
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <PressableFeedback
          className="-mt-20 self-center rounded-full"
          isDisabled={isDisabled || isMediaUploading}
          onPress={() => setMediaTarget("avatar")}
        >
          <Image
            alt="Perfil"
            className="size-30 rounded-full"
            fallback="blue"
            source={avatarUrl ?? undefined}
          />
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <TextField isInvalid={Boolean(nameState.error)} isRequired>
          <Label>Nome do torneio</Label>
          <Input
            editable={!isDisabled}
            onBlur={nameField.onBlur}
            onChangeText={nameField.onChange}
            placeholder="Ex.: Circuito de Tênis de Verão"
            value={nameField.value}
          />
          <FieldError>{nameState.error?.message ?? ""}</FieldError>
        </TextField>
        <TextField isInvalid={Boolean(descriptionState.error)}>
          <Label>Descrição do torneio</Label>
          <TextArea
            editable={!isDisabled}
            onBlur={descriptionField.onBlur}
            onChangeText={descriptionField.onChange}
            placeholder="Conte um pouco sobre o torneio, público e premiação."
            value={descriptionField.value ?? ""}
          />
          <FieldError>{descriptionState.error?.message ?? ""}</FieldError>
        </TextField>

        <TournamentDatePickerField
          description="O torneio começa nesse dia. A chave fica pública quando você iniciar."
          error={startDateState.error?.message}
          isDisabled={isDisabled}
          label="Data de início"
          minValue={today(getLocalTimeZone())}
          name="startDate"
        />

        <TournamentDatePickerField
          description="As inscrições encerram nesse dia. O sorteio vem depois."
          error={deadlineState.error?.message}
          isDisabled={isDisabled}
          label="Prazo de inscrições"
          maxValue={deadlineMaxValue}
          minValue={today(getLocalTimeZone())}
          name="registrationDeadlineAt"
        />

        <MediaConfirmDialog
          isOpen={mediaTarget !== null}
          onConfirm={() => {
            if (mediaTarget) {
              onMediaPress?.(mediaTarget);
            }
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setMediaTarget(null);
            }
          }}
          target={mediaTarget === "cover" ? "banner" : "avatar"}
        />
      </Page.ScrollView>
    </Page>
  );
}
