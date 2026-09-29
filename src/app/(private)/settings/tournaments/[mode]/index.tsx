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
import {
  Calendar,
  DatePicker,
  DateRangePicker,
  RangeCalendar,
} from "heroui-native-pro";
import { useMemo, useRef, useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import {
  buildTournamentRangeOption,
  formatTournamentDateRangeLabel,
  parseTournamentRangeValue,
  type TournamentScreenValues,
} from "@/components/pages/tournaments/form-schema";
import { brazilDayKey } from "@convex/domains/tournament/window-rules";
import { HugeIcons } from "@/components/ui/huge-icons";
import { MediaConfirmDialog } from "@/components/ui/media-confirm-dialog";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";
import {
  buildAutoBracketReleaseDate,
  buildAutoRegistrationDeadline,
  resolveTournamentEndDate,
  shouldDateFollowStartDate,
} from "@/lib/tournaments/tournament-window-defaults";

const DATE_LOCALE = "pt-BR";

function formatDateLabel(date: CalendarDate) {
  const [year, month, day] = date.toString().split("-");

  return `${day}/${month}/${year}`;
}

function parseCalendarDate(value: string): CalendarDate {
  // `parseDate` é o parse canônico de "YYYY-MM-DD": `today().set({ day, month,
  // year })` muta campo a campo e trunca em silêncio intermediários fora de
  // faixa (dia 31 num mês de 30 dias), corrompendo a data.
  return parseDate(value);
}

type TournamentDatePickerFieldProps = {
  description: string;
  error?: string;
  isDisabled: boolean;
  isRequired?: boolean;
  label: string;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  name: "registrationDeadlineAt" | "bracketReleaseAt";
};

function TournamentDatePickerField(props: TournamentDatePickerFieldProps) {
  const { control } = useFormContext<TournamentScreenValues>();
  const { field, fieldState } = useController({ control, name: props.name });
  const isRequired = props.isRequired ?? true;

  // minValue > maxValue não é definido na state machine do calendário: a data
  // focada alterna entre os limites e o loop de update derruba o React, então
  // com limites contraditórios descartamos ambos — o refine do form exige o prazo.
  const boundsAreConsistent =
    !(props.minValue && props.maxValue) ||
    props.minValue.compare(props.maxValue) <= 0;
  return (
    <TextField isInvalid={Boolean(fieldState.error)} isRequired={isRequired}>
      <DatePicker
        formatDate={formatDateLabel}
        isRequired={isRequired}
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

type TournamentRangePickerFieldProps = {
  endError?: string;
  isDisabled: boolean;
  startError?: string;
};

/** Início e fim num campo SÓ: o DateRangePicker do pro fecha a janela do
 * torneio numa seleção (dois toques), e o form guarda as duas datas como
 * sempre. */
function TournamentRangePickerField(props: TournamentRangePickerFieldProps) {
  const { control, getValues, setValue } =
    useFormContext<TournamentScreenValues>();
  // Últimos valores aplicados AUTOMATICAMENTE por este campo: enquanto o form
  // guardar cada um (ou nada), prazo e divulgação seguem o início.
  const autoDeadlineRef = useRef("");
  const autoReleaseRef = useRef("");
  const startDateValue = useWatch({ control, name: "startDate" });
  const endDateValue = useWatch({ control, name: "endDate" });
  const rangeOption = useMemo(
    () =>
      buildTournamentRangeOption({
        endDate: endDateValue,
        startDate: startDateValue,
      }),
    [endDateValue, startDateValue]
  );
  const error = props.startError ?? props.endError;

  return (
    <DateRangePicker
      formatDateRange={(start, end) =>
        formatTournamentDateRangeLabel(String(start), String(end))
      }
      isDisabled={props.isDisabled}
      isInvalid={Boolean(error)}
      isRequired
      locale={DATE_LOCALE}
      onValueChange={(nextValue) => {
        const next = nextValue
          ? parseTournamentRangeValue(nextValue.value)
          : null;

        if (!next) {
          return;
        }

        setValue("startDate", next.startDate, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setValue(
          "endDate",
          resolveTournamentEndDate({
            endDate: next.endDate,
            startDate: next.startDate,
          }),
          { shouldDirty: true, shouldValidate: true }
        );

        const deadline = getValues("registrationDeadlineAt");

        if (
          shouldDateFollowStartDate({
            lastAutoValue: autoDeadlineRef.current,
            value: deadline,
          })
        ) {
          const autoDeadline = buildAutoRegistrationDeadline({
            startDate: next.startDate,
            todayDayKey: brazilDayKey(Date.now()),
          });

          autoDeadlineRef.current = autoDeadline;
          // Sem `shouldDirty`: os automáticos não contam como edição do
          // organizador nem sujam o form pro aviso de sair sem salvar.
          setValue("registrationDeadlineAt", autoDeadline, {
            shouldDirty: false,
            shouldValidate: true,
          });
        }

        const release = getValues("bracketReleaseAt");

        if (
          shouldDateFollowStartDate({
            lastAutoValue: autoReleaseRef.current,
            value: release,
          })
        ) {
          const autoRelease = buildAutoBracketReleaseDate({
            startDate: next.startDate,
            todayDayKey: brazilDayKey(Date.now()),
          });

          autoReleaseRef.current = autoRelease;
          setValue("bracketReleaseAt", autoRelease, {
            shouldDirty: false,
            shouldValidate: true,
          });
        }
      }}
      value={rangeOption}
    >
      <Label>Início e fim do torneio</Label>
      <DateRangePicker.Select
        isDisabled={props.isDisabled}
        presentation="popover"
      >
        <DateRangePicker.Trigger className="bg-surface-secondary">
          <DateRangePicker.Value
            className="font-normal"
            placeholder="Selecione o período"
          />
          <DateRangePicker.TriggerIndicator />
        </DateRangePicker.Trigger>
        <DateRangePicker.Portal>
          <DateRangePicker.Overlay />
          <DateRangePicker.Content presentation="popover" width="trigger">
            <DateRangePicker.Calendar
              locale={DATE_LOCALE}
              minValue={today(getLocalTimeZone())}
            >
              <RangeCalendar.Header>
                <RangeCalendar.Heading />
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell day={day} />}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </DateRangePicker.Calendar>
          </DateRangePicker.Content>
        </DateRangePicker.Portal>
      </DateRangePicker.Select>
      <Description>
        Toque no dia de início e depois no dia do fim. O fim fica pelo menos no
        dia seguinte ao início.
      </Description>
      <FieldError>{error ?? ""}</FieldError>
    </DateRangePicker>
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
  const endDateState = getFieldState("endDate", control._formState);
  const deadlineState = getFieldState(
    "registrationDeadlineAt",
    control._formState
  );
  const startDateValue = useWatch({ control, name: "startDate" });
  const deadlineValue = useWatch({ control, name: "registrationDeadlineAt" });
  const deadlineMaxValue = startDateValue
    ? parseCalendarDate(startDateValue).subtract({ days: 1 })
    : undefined;
  const releaseState = getFieldState("bracketReleaseAt", control._formState);
  const releaseMinValue = deadlineValue
    ? parseCalendarDate(deadlineValue)
    : today(getLocalTimeZone());
  const releaseMaxValue = startDateValue
    ? parseCalendarDate(startDateValue)
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

        <TournamentRangePickerField
          endError={endDateState.error?.message}
          isDisabled={isDisabled}
          startError={startDateState.error?.message}
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

        <TournamentDatePickerField
          description="Nesse dia a chave abre para os jogadores. Se ainda não houver sorteio, ele acontece automaticamente."
          error={releaseState.error?.message}
          isDisabled={isDisabled}
          isRequired={false}
          label="Divulgação da chave"
          maxValue={releaseMaxValue}
          minValue={releaseMinValue}
          name="bracketReleaseAt"
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
