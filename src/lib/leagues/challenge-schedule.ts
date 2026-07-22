import { formatMinuteToHHMM } from "@/lib/format/time";

type OccupiedChallengeSlot = {
  challengeId: string;
  courtId: string;
  endMinute: number;
  matchDate: string;
  startMinute: number;
};

type TimeRange = {
  endMinute: number;
  startMinute: number;
};

export type ChallengeTimeOption = {
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

export function buildChallengeTimeOptions(input: {
  challengeIdToIgnore?: string | null;
  courtId: string;
  durationMinutes: number;
  matchDate: string;
  occupiedSlots: OccupiedChallengeSlot[];
  ranges: TimeRange[];
}): ChallengeTimeOption[] {
  const options: ChallengeTimeOption[] = [];
  const relevantSlots = input.occupiedSlots.filter(
    (slot) =>
      slot.courtId === input.courtId &&
      slot.matchDate === input.matchDate &&
      slot.challengeId !== input.challengeIdToIgnore
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
