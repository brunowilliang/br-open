import { describe, expect, it } from "bun:test";

import {
  findDuplicateUnavailability,
  findUnavailabilityConflict,
  formatUnavailabilityConflict,
  type TournamentUnavailability,
} from "../unavailability-rules";

const day = "2026-10-12";

const wholeDay: TournamentUnavailability = {
  date: day,
  id: "block-1",
  reason: "Chuva",
};

const afternoon: TournamentUnavailability = {
  date: day,
  endMinute: 1200,
  id: "block-2",
  reason: "Chuva",
  startMinute: 960,
};

const courtThreeNight: TournamentUnavailability = {
  courtId: "court-3",
  date: day,
  endMinute: 1320,
  id: "block-3",
  reason: "Falta de luz",
  startMinute: 1140,
};

describe("findUnavailabilityConflict", () => {
  const request = {
    courtId: "court-1",
    dayKey: day,
    endMinute: 690,
    startMinute: 600,
  };

  it("dia inteiro bloqueia qualquer horário", () => {
    expect(
      findUnavailabilityConflict({ ...request, blocks: [wholeDay] })?.id
    ).toBe("block-1");
  });

  it("pedaço do dia bloqueia só a faixa com sobreposição", () => {
    expect(
      findUnavailabilityConflict({
        ...request,
        blocks: [afternoon],
        endMinute: 1050,
        startMinute: 960,
      })?.id
    ).toBe("block-2");
    // Encostar no fim da faixa não é sobrepor (janela semiaberta).
    expect(
      findUnavailabilityConflict({
        ...request,
        blocks: [afternoon],
        endMinute: 960,
        startMinute: 900,
      })
    ).toBeNull();
    expect(
      findUnavailabilityConflict({
        ...request,
        blocks: [afternoon],
        endMinute: 1320,
        startMinute: 1200,
      })
    ).toBeNull();
  });

  it("bloqueio por quadra só barra a MESMA quadra", () => {
    const night = { endMinute: 1200, startMinute: 1140 };

    expect(
      findUnavailabilityConflict({
        ...request,
        ...night,
        blocks: [courtThreeNight],
        courtId: "court-3",
      })?.id
    ).toBe("block-3");
    expect(
      findUnavailabilityConflict({
        ...request,
        ...night,
        blocks: [courtThreeNight],
        courtId: "court-1",
      })
    ).toBeNull();
  });

  it("outro dia nunca conflita", () => {
    expect(
      findUnavailabilityConflict({
        ...request,
        blocks: [wholeDay, afternoon],
        dayKey: "2026-10-13",
      })
    ).toBeNull();
  });
});

describe("formatUnavailabilityConflict", () => {
  it("dia inteiro, período e quadra, sempre com o motivo", () => {
    expect(
      formatUnavailabilityConflict({ block: wholeDay, courtName: null })
    ).toBe("O dia 12/10 está indisponível (Chuva).");
    expect(
      formatUnavailabilityConflict({ block: afternoon, courtName: null })
    ).toBe("O período de 12/10 das 16:00 às 20:00 está indisponível (Chuva).");
    expect(
      formatUnavailabilityConflict({
        block: courtThreeNight,
        courtName: "Quadra 3",
      })
    ).toBe(
      "Quadra 3 está indisponível em 12/10 das 19:00 às 22:00 (Falta de luz)."
    );
    // Quadra removida do torneio depois do bloqueio cai no rótulo genérico.
    expect(
      formatUnavailabilityConflict({
        block: { ...courtThreeNight, endMinute: null, startMinute: null },
        courtName: null,
      })
    ).toBe("A quadra está indisponível em 12/10 (Falta de luz).");
  });

  it("sem motivo a copy não deixa parênteses vazio", () => {
    expect(
      formatUnavailabilityConflict({
        block: { ...wholeDay, reason: null },
        courtName: null,
      })
    ).toBe("O dia 12/10 está indisponível.");
    expect(
      formatUnavailabilityConflict({
        block: { ...afternoon, reason: null },
        courtName: null,
      })
    ).toBe("O período de 12/10 das 16:00 às 20:00 está indisponível.");
    expect(
      formatUnavailabilityConflict({
        block: { ...courtThreeNight, reason: null },
        courtName: "Quadra 3",
      })
    ).toBe("Quadra 3 está indisponível em 12/10 das 19:00 às 22:00.");
    // Motivo em branco (linha gravada antes da regra nova) vale como sem motivo.
    expect(
      formatUnavailabilityConflict({
        block: { ...wholeDay, reason: "   " },
        courtName: null,
      })
    ).toBe("O dia 12/10 está indisponível.");
  });
});

describe("findDuplicateUnavailability", () => {
  it("mesma chave natural acha a linha existente", () => {
    expect(
      findDuplicateUnavailability({
        blocks: [wholeDay, afternoon],
        courtId: null,
        date: day,
        endMinute: 1200,
        startMinute: 960,
      })?.id
    ).toBe("block-2");
  });

  it("faixa, quadra ou dia diferente não é o mesmo bloqueio", () => {
    expect(
      findDuplicateUnavailability({
        blocks: [afternoon],
        courtId: "court-3",
        date: day,
        endMinute: 1200,
        startMinute: 960,
      })
    ).toBeNull();
    expect(
      findDuplicateUnavailability({
        blocks: [afternoon],
        courtId: null,
        date: day,
        endMinute: 1201,
        startMinute: 960,
      })
    ).toBeNull();
    expect(
      findDuplicateUnavailability({
        blocks: [afternoon],
        courtId: null,
        date: "2026-10-13",
        endMinute: 1200,
        startMinute: 960,
      })
    ).toBeNull();
  });
});
