import { describe, expect, it } from "bun:test";

import {
  DOUBLES_SEED_AGENDA_DAYS,
  DOUBLES_SEED_COURTS,
  resolveDoublesSeedAgendaSlot,
} from "../doubles-agenda-plan";

const NOW_MS = Date.UTC(2026, 8, 23, 5, 40);

describe("seed: agenda do plantio de duplas", () => {
  it("o primeiro confronto cai HOJE e o segundo AMANHA", () => {
    const today = resolveDoublesSeedAgendaSlot({
      categoryIndex: 0,
      matchIndex: 0,
      nowMs: NOW_MS,
    });
    const tomorrow = resolveDoublesSeedAgendaSlot({
      categoryIndex: 0,
      matchIndex: 1,
      nowMs: NOW_MS,
    });

    expect(today?.matchDate).toBe("2026-09-23");
    expect(tomorrow?.matchDate).toBe("2026-09-24");
  });

  it("as duas categorias jogam no mesmo dia em quadras diferentes", () => {
    const slots = [0, 1].map((categoryIndex) =>
      resolveDoublesSeedAgendaSlot({
        categoryIndex,
        matchIndex: 0,
        nowMs: NOW_MS,
      })
    );

    expect(slots.map((slot) => slot?.courtId)).toEqual([
      DOUBLES_SEED_COURTS[0].id,
      DOUBLES_SEED_COURTS[1].id,
    ]);
    expect(slots[0]?.matchDate).toBe(slots[1]?.matchDate);
    expect(slots[0]?.startMinute).toBe(slots[1]?.startMinute);
  });

  it("nenhum confronto planejado colide de quadra e horario", () => {
    const slots = DOUBLES_SEED_AGENDA_DAYS.flatMap((_, matchIndex) =>
      [0, 1].map((categoryIndex) =>
        resolveDoublesSeedAgendaSlot({
          categoryIndex,
          matchIndex,
          nowMs: NOW_MS,
        })
      )
    );
    const keys = slots.map(
      (slot) => `${slot?.courtId}|${slot?.matchDate}|${slot?.startMinute}`
    );

    expect(slots).toHaveLength(4);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("horario da noite: o card da agenda agrupa por periodo", () => {
    for (const day of DOUBLES_SEED_AGENDA_DAYS) {
      expect(day.startMinute).toBeGreaterThanOrEqual(18 * 60);
      expect(day.startMinute).toBeLessThan(24 * 60);
    }
  });

  it("confronto fora da rodada 1 nao tem plano", () => {
    expect(
      resolveDoublesSeedAgendaSlot({
        categoryIndex: 0,
        matchIndex: 2,
        nowMs: NOW_MS,
      })
    ).toBeNull();
  });
});
