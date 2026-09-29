import { describe, expect, it } from "bun:test";

import type { TournamentUnavailability } from "@convex/domains/tournament/unavailability-rules";
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
      unavailabilityBlocks: [],
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

  it("offers the whole day and blocks nothing without a court", () => {
    const options = buildSlotTimeOptions({
      courtId: null,
      durationMinutes: 90,
      matchDate: "2026-05-26",
      occupiedSlots: [
        {
          courtId: "court-1",
          endMinute: 1170,
          matchDate: "2026-05-26",
          slotId: "match-1",
          startMinute: 1080,
        },
      ],
      ranges: [{ endMinute: 1440, startMinute: 0 }],
      unavailabilityBlocks: [],
    });

    expect(options[0]).toEqual({
      description: undefined,
      isDisabled: false,
      label: "00:00",
      value: "0",
    });
    expect(options.at(-1)).toEqual({
      description: undefined,
      isDisabled: false,
      label: "22:30",
      value: "1350",
    });
    expect(options.every((option) => !option.isDisabled)).toBe(true);
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
      unavailabilityBlocks: [],
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
      unavailabilityBlocks: [],
    });

    expect(options.every((option) => !option.isDisabled)).toBe(true);
  });
});

describe("buildSlotTimeOptions com bloqueios de indisponibilidade", () => {
  // Funcionamento 08:00 às 12:00 (480..720); 60 min de duração → 7 opções.
  const ranges = [{ endMinute: 720, startMinute: 480 }];
  const allTimes = ["480", "510", "540", "570", "600", "630", "660"];

  function buildOptions(input: {
    courtId: null | string;
    unavailabilityBlocks: TournamentUnavailability[];
  }) {
    return buildSlotTimeOptions({
      courtId: input.courtId,
      durationMinutes: 60,
      matchDate: "2026-05-26",
      occupiedSlots: [],
      ranges,
      unavailabilityBlocks: input.unavailabilityBlocks,
    }).map((option) => option.value);
  }

  function block(
    overrides: Partial<TournamentUnavailability> = {}
  ): TournamentUnavailability {
    return {
      courtId: null,
      date: "2026-05-26",
      endMinute: 720,
      id: "block-1",
      reason: "Chuva",
      startMinute: 600,
      ...overrides,
    };
  }

  it("sem bloqueio a lista fica intacta", () => {
    expect(
      buildOptions({ courtId: "court-1", unavailabilityBlocks: [] })
    ).toEqual(allTimes);
  });

  it("bloqueio de UMA quadra só esconde aquele horário naquela quadra", () => {
    const doCourtTwo = [block({ courtId: "court-2" })];

    expect(
      buildOptions({ courtId: "court-1", unavailabilityBlocks: doCourtTwo })
    ).toEqual(allTimes);
    // 10:00 às 12:00 na quadra 2 esconde 09:30 (cruza o início), 10:00, 10:30
    // e 11:00; 09:00 termina no minuto do início e continua na lista.
    expect(
      buildOptions({ courtId: "court-2", unavailabilityBlocks: doCourtTwo })
    ).toEqual(["480", "510", "540"]);
  });

  it("bloqueio de TODAS as quadras esconde em qualquer quadra", () => {
    const everyCourt = [block()];

    expect(
      buildOptions({ courtId: "court-1", unavailabilityBlocks: everyCourt })
    ).toEqual(["480", "510", "540"]);
    expect(
      buildOptions({ courtId: "court-2", unavailabilityBlocks: everyCourt })
    ).toEqual(["480", "510", "540"]);
  });

  it("quadra ainda não escolhida: só o bloqueio de todas as quadras barra", () => {
    expect(
      buildOptions({
        courtId: null,
        unavailabilityBlocks: [block({ courtId: "court-1" })],
      })
    ).toEqual(allTimes);
    expect(
      buildOptions({ courtId: null, unavailabilityBlocks: [block()] })
    ).toEqual(["480", "510", "540"]);
  });

  it("dia inteiro (sem faixa) esconde o dia todo", () => {
    expect(
      buildOptions({
        courtId: "court-1",
        unavailabilityBlocks: [block({ endMinute: null, startMinute: null })],
      })
    ).toEqual([]);
  });

  it("faixa que cruza os limites do funcionamento esconde o dia todo", () => {
    expect(
      buildOptions({
        courtId: "court-1",
        unavailabilityBlocks: [block({ endMinute: 840, startMinute: 240 })],
      })
    ).toEqual([]);
  });

  it("o minuto do fim não bloqueia: mesma leitura do servidor", () => {
    // 08:00 às 09:00 barra 08:00 e 08:30 (08:30+60 = 09:30 cruza); 09:00
    // (09:00..10:00) começa no minuto do fim e continua na lista.
    expect(
      buildOptions({
        courtId: "court-1",
        unavailabilityBlocks: [block({ endMinute: 540, startMinute: 480 })],
      })
    ).toEqual(["540", "570", "600", "630", "660"]);
  });

  it("bloqueio fora do funcionamento não esconde nada", () => {
    expect(
      buildOptions({
        courtId: "court-1",
        unavailabilityBlocks: [block({ endMinute: 840, startMinute: 720 })],
      })
    ).toEqual(allTimes);
  });
});
