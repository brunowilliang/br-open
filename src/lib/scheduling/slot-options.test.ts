import { describe, expect, it } from "bun:test";

import { buildSlotTimeOptions } from "./slot-options";

describe("buildSlotTimeOptions", () => {
  it("marks overlapping slots as disabled", () => {
    const options = buildSlotTimeOptions({
      courtId: "court-1",
      durationMinutes: 90,
      matchDate: "2026-05-26",
      occupiedSlots: [
        {
          courtId: "court-1",
          endMinute: 1170,
          matchDate: "2026-05-26",
          slotId: "challenge-1",
          startMinute: 1080,
        },
      ],
      ranges: [{ endMinute: 1260, startMinute: 1020 }],
    });

    expect(options).toEqual([
      {
        description: "Horário já reservado",
        isDisabled: true,
        label: "17:00",
        value: "1020",
      },
      {
        description: "Horário já reservado",
        isDisabled: true,
        label: "17:30",
        value: "1050",
      },
      {
        description: "Horário já reservado",
        isDisabled: true,
        label: "18:00",
        value: "1080",
      },
      {
        description: "Horário já reservado",
        isDisabled: true,
        label: "18:30",
        value: "1110",
      },
      {
        description: "Horário já reservado",
        isDisabled: true,
        label: "19:00",
        value: "1140",
      },
      {
        description: undefined,
        isDisabled: false,
        label: "19:30",
        value: "1170",
      },
    ]);
  });

  it("ignores the current slot id when rescheduling the same row", () => {
    const options = buildSlotTimeOptions({
      courtId: "court-1",
      durationMinutes: 90,
      matchDate: "2026-05-26",
      occupiedSlots: [
        {
          courtId: "court-1",
          endMinute: 1170,
          matchDate: "2026-05-26",
          slotId: "challenge-1",
          startMinute: 1080,
        },
      ],
      ranges: [{ endMinute: 1260, startMinute: 1020 }],
      slotIdToIgnore: "challenge-1",
    });

    expect(options.every((option) => !option.isDisabled)).toBe(true);
  });

  it("ignores the rescheduled match slot in the tournament vocabulary", () => {
    const options = buildSlotTimeOptions({
      courtId: "court-2",
      durationMinutes: 90,
      matchDate: "2026-05-27",
      occupiedSlots: [
        {
          courtId: "court-2",
          endMinute: 600,
          matchDate: "2026-05-27",
          slotId: "match-9",
          startMinute: 540,
        },
      ],
      ranges: [{ endMinute: 720, startMinute: 480 }],
      slotIdToIgnore: "match-9",
    });

    expect(options.every((option) => !option.isDisabled)).toBe(true);
  });
});
