import { describe, expect, it } from "bun:test";

import {
  buildScheduledDate,
  getDayKeyFromMatchDate,
  rangesOverlap,
} from "../challenge-scheduling-rules";

describe("league challenge scheduling rules", () => {
  describe("getDayKeyFromMatchDate", () => {
    it("maps each weekday to its league day key (UTC)", () => {
      // 2026-06-15 is a Monday in UTC.
      expect(getDayKeyFromMatchDate("2026-06-15")).toBe("mon");
      expect(getDayKeyFromMatchDate("2026-06-16")).toBe("tue");
      expect(getDayKeyFromMatchDate("2026-06-17")).toBe("wed");
      expect(getDayKeyFromMatchDate("2026-06-18")).toBe("thu");
      expect(getDayKeyFromMatchDate("2026-06-19")).toBe("fri");
      expect(getDayKeyFromMatchDate("2026-06-20")).toBe("sat");
      expect(getDayKeyFromMatchDate("2026-06-21")).toBe("sun");
    });

    it("throws on an invalid matchDate", () => {
      expect(() => getDayKeyFromMatchDate("not-a-date")).toThrow();
      expect(() => getDayKeyFromMatchDate("")).toThrow();
    });

    it("interprets the date in UTC, not the device timezone", () => {
      // Pinning to UTC means callers west of UTC don't get a shifted weekday.
      const result = getDayKeyFromMatchDate("2026-06-19");
      expect(result).toBe("fri");
    });
  });

  describe("buildScheduledDate", () => {
    it("builds a UTC date from a matchDate + minute offset", () => {
      // 630 minutes = 10:30 UTC.
      const result = buildScheduledDate("2026-06-19", 630);
      expect(result.toISOString()).toBe("2026-06-19T10:30:00.000Z");
    });

    it("rolls the minute offset into hours and minutes", () => {
      // 1440 = 24:00 -> next day 00:00 UTC.
      const result = buildScheduledDate("2026-06-19", 1440);
      expect(result.toISOString()).toBe("2026-06-20T00:00:00.000Z");
    });

    it("throws on an invalid matchDate", () => {
      expect(() => buildScheduledDate("garbage", 0)).toThrow();
    });
  });

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
});
