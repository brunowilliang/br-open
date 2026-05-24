import { describe, expect, it } from "bun:test";

import { buildChallengeTimeOptions } from "./challenge-schedule";

describe("buildChallengeTimeOptions", () => {
  it("marks overlapping slots as disabled", () => {
    const options = buildChallengeTimeOptions({
      courtId: "court-1",
      durationMinutes: 90,
      matchDate: "2026-05-26",
      occupiedSlots: [
        {
          challengeId: "challenge-1",
          courtId: "court-1",
          endMinute: 1170,
          matchDate: "2026-05-26",
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

  it("ignores the current challenge slot when editing the same challenge", () => {
    const options = buildChallengeTimeOptions({
      challengeIdToIgnore: "challenge-1",
      courtId: "court-1",
      durationMinutes: 90,
      matchDate: "2026-05-26",
      occupiedSlots: [
        {
          challengeId: "challenge-1",
          courtId: "court-1",
          endMinute: 1170,
          matchDate: "2026-05-26",
          startMinute: 1080,
        },
      ],
      ranges: [{ endMinute: 1260, startMinute: 1020 }],
    });

    expect(options.every((option) => !option.isDisabled)).toBe(true);
  });
});
