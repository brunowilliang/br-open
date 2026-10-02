import { describe, expect, test } from "bun:test";

import { countCalendarDays } from "./relative-time";

describe("countCalendarDays", () => {
  test("same calendar day counts zero even across the day", () => {
    expect(
      countCalendarDays({
        from: new Date(2026, 9, 1, 8).getTime(),
        to: new Date(2026, 9, 1, 23, 59).getTime(),
      })
    ).toBe(0);
  });

  test("tomorrow counts one, regardless of the hour", () => {
    expect(
      countCalendarDays({
        from: new Date(2026, 9, 1, 23).getTime(),
        to: new Date(2026, 9, 2, 0).getTime(),
      })
    ).toBe(1);
  });

  test("counts whole calendar days forward and backward", () => {
    expect(
      countCalendarDays({
        from: new Date(2026, 9, 1).getTime(),
        to: new Date(2026, 9, 13).getTime(),
      })
    ).toBe(12);

    expect(
      countCalendarDays({
        from: new Date(2026, 9, 1).getTime(),
        to: new Date(2026, 8, 28).getTime(),
      })
    ).toBe(-3);
  });

  test("crossing months keeps counting calendar days", () => {
    expect(
      countCalendarDays({
        from: new Date(2026, 8, 30).getTime(),
        to: new Date(2026, 9, 2).getTime(),
      })
    ).toBe(2);
  });
});
