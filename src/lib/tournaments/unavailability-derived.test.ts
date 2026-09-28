import { describe, expect, it } from "bun:test";

import {
  buildUnavailabilityChipLabel,
  buildUnavailabilityEndOptions,
  buildUnavailabilitySpans,
  buildUnavailabilityStartOptions,
  formatUnavailabilityPeriod,
  formatUnavailabilitySpanLabel,
  resolveReasonPreset,
  selectVisibleUnavailabilityBlocks,
} from "./unavailability-derived";

describe("resolveReasonPreset", () => {
  it("matches a preset ignoring case and spaces", () => {
    expect(resolveReasonPreset(" chuva ")).toBe("Chuva");
    expect(resolveReasonPreset("FALTA DE LUZ")).toBe("Falta de luz");
  });

  it("leaves anything else without a chip (it lives in the Outro field)", () => {
    expect(resolveReasonPreset("Quadra molhada")).toBeNull();
    expect(resolveReasonPreset("Outro")).toBeNull();
  });

  it("has no preset with an empty reason", () => {
    expect(resolveReasonPreset("   ")).toBeNull();
  });
});

describe("buildUnavailabilitySpans", () => {
  it("collapses each day to the first start and the last end", () => {
    const spans = buildUnavailabilitySpans([
      { endMinute: 1200, matchDate: "2026-10-13", startMinute: 1140 },
      { endMinute: 1020, matchDate: "2026-10-13", startMinute: 960 },
      { endMinute: 600, matchDate: "2026-10-14", startMinute: 540 },
    ]);

    expect(spans).toEqual([
      { date: "2026-10-13", endMinute: 1200, startMinute: 960 },
      { date: "2026-10-14", endMinute: 600, startMinute: 540 },
    ]);
  });

  it("returns nothing without cancelled matches", () => {
    expect(buildUnavailabilitySpans([])).toEqual([]);
  });
});

describe("formatUnavailabilityPeriod", () => {
  it("reads the whole day when there is no range", () => {
    expect(
      formatUnavailabilityPeriod({ endMinute: null, startMinute: null })
    ).toBe("Dia todo");
  });

  it("reads the range in HH:MM", () => {
    expect(
      formatUnavailabilityPeriod({ endMinute: 1200, startMinute: 960 })
    ).toBe("16:00 às 20:00");
  });
});

describe("buildUnavailabilityChipLabel", () => {
  it("joins reason, court and range with the app separator", () => {
    expect(
      buildUnavailabilityChipLabel({
        courtName: "Quadra 2",
        endMinute: 1200,
        reason: "Chuva",
        startMinute: 960,
      })
    ).toBe("Chuva | Quadra 2 | 16:00 às 20:00");
    expect(
      buildUnavailabilityChipLabel({
        courtName: null,
        endMinute: null,
        reason: "Chuva",
        startMinute: null,
      })
    ).toBe("Chuva | Todas as quadras | Dia todo");
  });
});

describe("selectVisibleUnavailabilityBlocks", () => {
  const base = {
    courtId: "court-1",
    createdAt: 1,
    date: "2026-10-13",
  };

  it("hides a range fully inside the whole-day block of the same court", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      {
        ...base,
        endMinute: 210,
        id: "range",
        startMinute: 30,
      },
      {
        ...base,
        createdAt: 2,
        endMinute: null,
        id: "whole-day",
        startMinute: null,
      },
    ]);

    expect(visible.map((block) => block.id)).toEqual(["whole-day"]);
  });

  it("hides a court-specific block inside the all-courts one", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      { ...base, endMinute: 1200, id: "court-1", startMinute: 960 },
      {
        ...base,
        courtId: null,
        endMinute: 1200,
        id: "all-courts",
        startMinute: 960,
      },
    ]);

    expect(visible.map((block) => block.id)).toEqual(["all-courts"]);
  });

  it("keeps the specific block when the wider one is all-courts by period only", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      {
        ...base,
        courtId: null,
        endMinute: 1020,
        id: "all-courts-shorter",
        startMinute: 960,
      },
      { ...base, endMinute: 1200, id: "court-1-longer", startMinute: 960 },
    ]);

    expect(visible.map((block) => block.id)).toEqual([
      "all-courts-shorter",
      "court-1-longer",
    ]);
  });

  it("keeps both when neither period contains the other", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      { ...base, endMinute: 1200, id: "evening", startMinute: 960 },
      { ...base, endMinute: 1320, id: "night", startMinute: 1080 },
    ]);

    expect(visible.map((block) => block.id)).toEqual(["evening", "night"]);
  });

  it("never covers across courts or days", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      {
        ...base,
        endMinute: null,
        id: "court-1-day",
        startMinute: null,
      },
      {
        ...base,
        courtId: "court-2",
        createdAt: 2,
        endMinute: 1200,
        id: "other-court",
        startMinute: 960,
      },
      {
        ...base,
        courtId: "court-2",
        createdAt: 3,
        date: "2026-10-14",
        endMinute: null,
        id: "other-day",
        startMinute: null,
      },
    ]);

    expect(visible.map((block) => block.id)).toEqual([
      "court-1-day",
      "other-court",
      "other-day",
    ]);
  });

  it("reads a block missing one hour as the whole day, like the server does", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      { ...base, endMinute: 210, id: "half-filled", startMinute: null },
      { ...base, endMinute: 1200, id: "evening", startMinute: 960 },
    ]);

    expect(visible.map((block) => block.id)).toEqual(["half-filled"]);
  });

  it("keeps a whole-day block when both are whole-day on different courts", () => {
    const visible = selectVisibleUnavailabilityBlocks([
      { ...base, endMinute: null, id: "court-1-day", startMinute: null },
      {
        ...base,
        courtId: null,
        createdAt: 2,
        endMinute: null,
        id: "all-day",
        startMinute: null,
      },
    ]);

    expect(visible.map((block) => block.id)).toEqual(["all-day"]);
  });

  it("keeps the newest on a tie, regardless of the list order", () => {
    const older = { ...base, endMinute: null, id: "older", startMinute: null };
    const newer = {
      ...base,
      createdAt: 2,
      endMinute: null,
      id: "newer",
      startMinute: null,
    };

    expect(
      selectVisibleUnavailabilityBlocks([older, newer]).map((block) => block.id)
    ).toEqual(["newer"]);
    expect(
      selectVisibleUnavailabilityBlocks([newer, older]).map((block) => block.id)
    ).toEqual(["newer"]);
  });

  it("brings the covered block back once the wider one is gone", () => {
    const range = { ...base, endMinute: 210, id: "range", startMinute: 30 };

    expect(selectVisibleUnavailabilityBlocks([range])).toEqual([range]);
  });
});

describe("formatUnavailabilitySpanLabel", () => {
  it("names the day and the range the cancellation will close", () => {
    expect(
      formatUnavailabilitySpanLabel({
        date: "2026-10-13",
        endMinute: 1200,
        startMinute: 960,
      })
    ).toBe("13 de out., das 16:00 às 20:00");
  });
});

describe("buildUnavailabilityStartOptions", () => {
  it("goes from 00:00 to 23:30 in 30-minute steps", () => {
    const options = buildUnavailabilityStartOptions();

    expect(options[0]).toEqual({ label: "00:00", value: "0" });
    expect(options.at(-1)).toEqual({ label: "23:30", value: "1410" });
    expect(options).toHaveLength(48);
  });

  it("starts the end options right after the chosen start", () => {
    expect(buildUnavailabilityEndOptions(1140)[0]).toEqual({
      label: "19:30",
      value: "1170",
    });
    expect(buildUnavailabilityEndOptions(1410)).toEqual([
      { label: "24:00", value: "1440" },
    ]);
  });
});
