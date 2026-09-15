import { describe, expect, test } from "bun:test";

import {
  buildBracketPlaceholder,
  buildEntryRoundOptions,
  buildTournamentDetailsAccess,
  buildTournamentDetailsRole,
  buildTournamentNavigationTabItems,
  formatBracketStage,
  formatEntryRoundLabel,
  formatMatchScheduleSummary,
  isBracketPublic,
} from "./tournament-details-derived";

describe("buildTournamentDetailsRole", () => {
  test("organizer beats any entry", () => {
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: true,
        viewerEntryIds: ["e-1"],
      })
    ).toBe("organizer");
  });

  test("player with entry, guest without", () => {
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: false,
        viewerEntryIds: ["e-1"],
      })
    ).toBe("player");
    expect(
      buildTournamentDetailsRole({
        isTournamentOrganizer: false,
        viewerEntryIds: [],
      })
    ).toBe("guest");
  });
});

describe("isBracketPublic / buildTournamentDetailsAccess", () => {
  test("bracket public only in ongoing/finished", () => {
    expect(isBracketPublic("ongoing")).toBeTrue();
    expect(isBracketPublic("finished")).toBeTrue();
    expect(isBracketPublic("draft")).toBeFalse();
    expect(isBracketPublic("published")).toBeFalse();
    expect(isBracketPublic("drawn")).toBeFalse();
  });

  test("organizer sees everything in any status (including private draft)", () => {
    for (const status of [
      "draft",
      "published",
      "drawn",
      "ongoing",
      "finished",
    ]) {
      expect(
        buildTournamentDetailsAccess({ role: "organizer", status })
      ).toEqual({
        canManage: true,
        canOpenBracket: true,
        canOpenEntries: true,
        canOpenSchedule: true,
      });
    }
  });

  test("non-organizer without public bracket: bracket/schedule closed, entries open", () => {
    for (const status of ["draft", "published", "drawn"]) {
      expect(buildTournamentDetailsAccess({ role: "player", status })).toEqual({
        canManage: false,
        canOpenBracket: false,
        canOpenEntries: true,
        canOpenSchedule: false,
      });
    }
  });

  test("non-organizer in ongoing/finished: bracket/schedule open, no manage", () => {
    for (const status of ["ongoing", "finished"]) {
      expect(buildTournamentDetailsAccess({ role: "guest", status })).toEqual({
        canManage: false,
        canOpenBracket: true,
        canOpenEntries: true,
        canOpenSchedule: true,
      });
    }
  });
});

describe("buildTournamentNavigationTabItems", () => {
  test("guest in published sees Overview and Entries (bracket/schedule hidden)", () => {
    const access = buildTournamentDetailsAccess({
      role: "guest",
      status: "published",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "entries"]);
  });

  test("player in ongoing sees all tabs in league order (overview first)", () => {
    const access = buildTournamentDetailsAccess({
      role: "player",
      status: "ongoing",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "bracket", "schedule", "entries"]);
  });

  test("organizer in draft sees all tabs", () => {
    const access = buildTournamentDetailsAccess({
      role: "organizer",
      status: "draft",
    });

    expect(
      buildTournamentNavigationTabItems(access).map((item) => item.value)
    ).toEqual(["overview", "bracket", "schedule", "entries"]);
  });
});

describe("formatMatchScheduleSummary", () => {
  test("null while any schedule field is missing", () => {
    expect(
      formatMatchScheduleSummary({
        courtName: null,
        matchDate: "2026-09-12",
        startMinute: 840,
      })
    ).toBeNull();
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: null,
        startMinute: 840,
      })
    ).toBeNull();
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: "2026-09-12",
        startMinute: null,
      })
    ).toBeNull();
  });

  test("scheduled match renders day · time · court", () => {
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 2",
        matchDate: "2026-09-12",
        startMinute: 840,
      })
    ).toBe("12 de set. · 14:00 · Quadra 2");
  });

  test("date renders in UTC, immune to the local timezone", () => {
    // 2026-09-01T00:00Z is 31 de ago. 21:00 in America/Sao_Paulo: a local
    // formatter would render the previous day.
    expect(
      formatMatchScheduleSummary({
        courtName: "Quadra 1",
        matchDate: "2026-09-01",
        startMinute: 0,
      })
    ).toBe("1 de set. · 00:00 · Quadra 1");
  });
});

describe("buildEntryRoundOptions", () => {
  test("short draw: the first round is already a named stage", () => {
    // Chave de 16 (16 inscritos) = 4 rodadas. O exemplo do PLN-0004
    // ("16 jogadores, Bruno e Vitor direto nas oitavas") tem as oitavas na
    // RODADA 1 — a lista fixa mandava a rodada 2 (quartas de verdade).
    expect(buildEntryRoundOptions(16)).toEqual([
      { label: "Oitavas de final", round: 1 },
      { label: "Quartas de final", round: 2 },
      { label: "Semifinal", round: 3 },
      { label: "Final", round: 4 },
    ]);
  });

  test("32-slot draw: oitavas on round 2", () => {
    expect(buildEntryRoundOptions(17)).toEqual([
      { label: "Rodada 1", round: 1 },
      { label: "Oitavas de final", round: 2 },
      { label: "Quartas de final", round: 3 },
      { label: "Semifinal", round: 4 },
      { label: "Final", round: 5 },
    ]);
  });

  test("60 inscritos (chave de 64): oitavas on round 3", () => {
    const options = buildEntryRoundOptions(60);

    expect(options).toHaveLength(6);
    expect(options[0]).toEqual({ label: "Rodada 1", round: 1 });
    expect(options[2]).toEqual({ label: "Oitavas de final", round: 3 });
    expect(options[5]).toEqual({ label: "Final", round: 6 });
  });

  test("80 inscritos (chave de 128): oitavas on round 4", () => {
    const options = buildEntryRoundOptions(80);

    expect(options).toHaveLength(7);
    expect(options[3]).toEqual({ label: "Oitavas de final", round: 4 });
    expect(options[6]).toEqual({ label: "Final", round: 7 });
  });

  test("round count follows the next power of two", () => {
    expect(buildEntryRoundOptions(32)).toHaveLength(5);
    expect(buildEntryRoundOptions(33)).toHaveLength(6);
    expect(buildEntryRoundOptions(64)).toHaveLength(6);
    expect(buildEntryRoundOptions(65)).toHaveLength(7);
    // categoria ainda sem inscrição ativa: só a final mínima existe
    expect(buildEntryRoundOptions(0)).toEqual([{ label: "Final", round: 1 }]);
  });
});

describe("formatEntryRoundLabel", () => {
  test("null and 1 are the first round of the current draw", () => {
    expect(formatEntryRoundLabel(null, 6)).toBe("Rodada 1");
    expect(formatEntryRoundLabel(1, 6)).toBe("Rodada 1");
    // chave de 16: a primeira rodada já é as oitavas de final
    expect(formatEntryRoundLabel(null, 4)).toBe("Oitavas de final");
  });

  test("names the phase on the draw the picker offered", () => {
    expect(formatEntryRoundLabel(3, 6)).toBe("Oitavas de final");
    expect(formatEntryRoundLabel(6, 7)).toBe("Semifinal");
    expect(formatEntryRoundLabel(4, 4)).toBe("Final");
  });

  test("round beyond the current draw falls back to Rodada N", () => {
    expect(formatEntryRoundLabel(5, 4)).toBe("Rodada 5");
  });
});
describe("buildBracketPlaceholder", () => {
  test("no access: placeholder with the start date", () => {
    const placeholder = buildBracketPlaceholder({
      access: buildTournamentDetailsAccess({
        role: "guest",
        status: "published",
      }),
      startDateMs: new Date(2026, 7, 25).getTime(),
    });

    expect(placeholder).toContain("Chave disponível a partir de");
    expect(placeholder).toContain("25 de ago");
  });

  test("with access: null (bracket renders)", () => {
    expect(
      buildBracketPlaceholder({
        access: buildTournamentDetailsAccess({
          role: "player",
          status: "ongoing",
        }),
        startDateMs: Date.now(),
      })
    ).toBeNull();
  });
});

describe("formatBracketStage", () => {
  test("names stages by draw size", () => {
    // 8-slot draw: three rounds (Quartas, Semi, Final).
    expect(formatBracketStage(1, 3)).toBe("Quartas de final");
    expect(formatBracketStage(2, 3)).toBe("Semifinal");
    expect(formatBracketStage(3, 3)).toBe("Final");

    // 16-slot draw: four rounds.
    expect(formatBracketStage(1, 4)).toBe("Oitavas de final");
    expect(formatBracketStage(4, 4)).toBe("Final");
  });

  test("falls back to round number for uncommon draw sizes", () => {
    // 64-slot draw: first two rounds have no named stage.
    expect(formatBracketStage(1, 6)).toBe("Rodada 1");
    expect(formatBracketStage(2, 6)).toBe("Rodada 2");
  });
});
