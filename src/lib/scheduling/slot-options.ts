import { formatMinuteToHHMM } from "@/lib/format/time";

type ScheduleSlot = {
  courtId: string;
  endMinute: number;
  matchDate: string;
  slotId: string;
  startMinute: number;
};

type TimeRange = {
  endMinute: number;
  startMinute: number;
};

export type SlotTimeOption = {
  description?: string;
  isDisabled: boolean;
  label: string;
  value: string;
};

function rangesOverlap(input: {
  leftEndMinute: number;
  leftStartMinute: number;
  rightEndMinute: number;
  rightStartMinute: number;
}) {
  return (
    input.leftStartMinute < input.rightEndMinute &&
    input.rightStartMinute < input.leftEndMinute
  );
}

export function buildSlotTimeOptions(input: {
  courtId: string;
  durationMinutes: number;
  matchDate: string;
  occupiedSlots: ScheduleSlot[];
  ranges: TimeRange[];
  /** Slot da própria linha em edição — não pode bloquear o próprio horário. */
  slotIdToIgnore?: string | null;
}): SlotTimeOption[] {
  const options: SlotTimeOption[] = [];
  const relevantSlots = input.occupiedSlots.filter(
    (slot) =>
      slot.courtId === input.courtId &&
      slot.matchDate === input.matchDate &&
      slot.slotId !== input.slotIdToIgnore
  );

  for (const range of input.ranges) {
    for (
      let minute = range.startMinute;
      minute + input.durationMinutes <= range.endMinute;
      minute += 30
    ) {
      const endMinute = minute + input.durationMinutes;
      const isDisabled = relevantSlots.some((slot) =>
        rangesOverlap({
          leftEndMinute: endMinute,
          leftStartMinute: minute,
          rightEndMinute: slot.endMinute,
          rightStartMinute: slot.startMinute,
        })
      );

      options.push({
        description: isDisabled ? "Horário já reservado" : undefined,
        isDisabled,
        label: formatMinuteToHHMM(minute),
        value: String(minute),
      });
    }
  }

  return options;
}
