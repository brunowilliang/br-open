import { DatePicker } from "heroui-native-pro";
import { Calendar } from "heroui-native-pro";
import { FieldError } from "heroui-native";
import { Text } from "@/components/core/text";
import { parseDate } from "@internationalized/date";

const SCHEDULE_DATE_LOCALE = "pt-BR";

export type ScheduleDateValue = { label: string; value: string };

/**
 * "13 de out. de 2026" ancorado em UTC: o rótulo mostra o MESMO dia da chave
 * (misturar o fuso do aparelho mostraria um dia que a disponibilidade da quadra
 * não conhece).
 */
export function formatScheduleDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(SCHEDULE_DATE_LOCALE, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function toScheduleDateValue(
  value?: null | string
): ScheduleDateValue | undefined {
  return value ? { label: formatScheduleDateLabel(value), value } : undefined;
}

type ScheduleDateFieldProps = {
  /** Erro do submit no próprio campo (o chamador valida o obrigatório). */
  error?: string;
  isDisabled?: boolean;
  label?: string;
  maxDayKey?: null | string;
  minDayKey?: null | string;
  onChange: (dayKey: string) => void;
  placeholder?: string;
  value?: null | string;
};

/** Campo de DATA do agendamento: o mesmo calendário do diálogo de horário, com
 * o par min/max recortando a janela do torneio. */
export function ScheduleDateField(props: ScheduleDateFieldProps) {
  return (
    <DatePicker
      formatDate={(date) => formatScheduleDateLabel(String(date))}
      isRequired
      locale={SCHEDULE_DATE_LOCALE}
      onValueChange={(nextValue) => {
        if (!nextValue || Array.isArray(nextValue)) {
          return;
        }

        props.onChange(String(nextValue.value));
      }}
      value={toScheduleDateValue(props.value)}
    >
      <Text weight="medium">{props.label ?? "Data"}</Text>
      <DatePicker.Select isDisabled={props.isDisabled} presentation="popover">
        <DatePicker.Trigger className="bg-surface-secondary">
          <DatePicker.Value
            className="font-normal"
            placeholder={props.placeholder ?? "Selecione uma data"}
          />
          <DatePicker.TriggerIndicator />
        </DatePicker.Trigger>
        <DatePicker.Portal>
          <DatePicker.Overlay />
          <DatePicker.Content presentation="popover" width="trigger">
            <DatePicker.Calendar
              locale={SCHEDULE_DATE_LOCALE}
              maxValue={
                props.maxDayKey ? parseDate(props.maxDayKey) : undefined
              }
              minValue={
                props.minDayKey ? parseDate(props.minDayKey) : undefined
              }
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
      {props.error ? <FieldError isInvalid>{props.error}</FieldError> : null}
    </DatePicker>
  );
}
