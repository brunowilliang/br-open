import { describe, expect, it } from "bun:test";

import type { MatchConfig } from "../contract";
import { rangesOverlap, resolveMatchOccupiedEndMinute } from "../scheduling";

describe("rangesOverlap", () => {
  it("returns true when ranges intersect in the middle", () => {
    expect(
      rangesOverlap({
        leftEndMinute: 120,
        leftStartMinute: 0,
        rightEndMinute: 150,
        rightStartMinute: 60,
      })
    ).toBe(true);
  });

  it("returns false when ranges are fully disjoint", () => {
    expect(
      rangesOverlap({
        leftEndMinute: 60,
        leftStartMinute: 0,
        rightEndMinute: 150,
        rightStartMinute: 120,
      })
    ).toBe(false);
  });

  it("returns false when ranges only touch at an endpoint (half-open)", () => {
    // [0,60) and [60,120) do NOT overlap.
    expect(
      rangesOverlap({
        leftEndMinute: 60,
        leftStartMinute: 0,
        rightEndMinute: 120,
        rightStartMinute: 60,
      })
    ).toBe(false);
  });

  it("treats identical ranges as overlapping", () => {
    expect(
      rangesOverlap({
        leftEndMinute: 120,
        leftStartMinute: 0,
        rightEndMinute: 120,
        rightStartMinute: 0,
      })
    ).toBe(true);
  });
});

describe("resolveMatchOccupiedEndMinute", () => {
  const matchConfig = { defaultDurationMinutes: 90 } as MatchConfig;

  it("derives the occupied window end from the rules' default duration", () => {
    expect(
      resolveMatchOccupiedEndMinute({ matchConfig, startMinute: 540 })
    ).toBe(630);
  });

  it("falls back to the default duration on old/incomplete configs", () => {
    const absentKey = {
      defaultDurationMinutes: undefined,
    } as unknown as MatchConfig;

    expect(
      resolveMatchOccupiedEndMinute({
        matchConfig: {} as MatchConfig,
        startMinute: 540,
      })
    ).toBe(630);
    expect(
      resolveMatchOccupiedEndMinute({
        matchConfig: absentKey,
        startMinute: 540,
      })
    ).toBe(630);
    expect(
      resolveMatchOccupiedEndMinute({
        matchConfig: {
          defaultDurationMinutes: Number.NaN,
        } as unknown as MatchConfig,
        startMinute: 540,
      })
    ).toBe(630);
    expect(
      resolveMatchOccupiedEndMinute({
        matchConfig: {
          defaultDurationMinutes: 0,
        } as unknown as MatchConfig,
        startMinute: 540,
      })
    ).toBe(630);
  });
});
