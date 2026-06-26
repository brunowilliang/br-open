import { describe, expect, it } from "bun:test";

import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  formatDateToUtcKey,
  formatScheduleMinute,
  type ScheduleDayView,
} from "./schedule-view";

type ScheduleItem = ScheduleDayView["morning"][number];

function scheduleItem(input: {
  id: string;
  matchDate: string;
  startMinute: number;
}): ScheduleItem {
  return {
    challenged: {
      avatarUrl: null,
      fullName: "Maria",
    },
    challenger: {
      avatarUrl: null,
      fullName: "João",
    },
    courtName: "Quadra 1",
    id: input.id,
    matchDate: input.matchDate,
    startMinute: input.startMinute,
  };
}

describe("buildScheduleDateTabs", () => {
  it("generates 7 tabs starting at today with friendly labels", () => {
    const today = new Date(Date.UTC(2026, 5, 26)); // 2026-06-26 UTC
    const tabs = buildScheduleDateTabs({ today, windowDays: 7 });

    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toMatchObject({
      isToday: true,
      isTomorrow: false,
      label: "Hoje",
      matchDate: "2026-06-26",
    });
    expect(tabs[1]).toMatchObject({
      isToday: false,
      isTomorrow: true,
      label: "Amanhã",
    });
    expect(tabs[2].isToday).toBe(false);
    expect(tabs[2].isTomorrow).toBe(false);
  });

  it("generates 15 tabs when window is 15", () => {
    const today = new Date(Date.UTC(2026, 5, 26));
    const tabs = buildScheduleDateTabs({ today, windowDays: 15 });
    expect(tabs).toHaveLength(15);
  });
});

describe("buildScheduleDayView", () => {
  const matchDate = "2026-06-26";

  it("groups challenges into morning/afternoon/evening by startMinute", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate, startMinute: 540 }), // 09:00 manhã
        scheduleItem({ id: "2", matchDate, startMinute: 840 }), // 14:00 tarde
        scheduleItem({ id: "3", matchDate, startMinute: 1140 }), // 19:00 noite
        scheduleItem({ id: "4", matchDate, startMinute: 360 }), // 06:00 manhã
      ],
      matchDate,
    });

    expect(view.morning.map((c) => c.id)).toEqual(["4", "1"]);
    expect(view.afternoon.map((c) => c.id)).toEqual(["2"]);
    expect(view.evening.map((c) => c.id)).toEqual(["3"]);
  });

  it("sorts each period by startMinute ascending", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "a", matchDate, startMinute: 600 }),
        scheduleItem({ id: "b", matchDate, startMinute: 480 }),
      ],
      matchDate,
    });

    expect(view.morning.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("excludes challenges from other days", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate: "2026-06-27", startMinute: 540 }),
      ],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(0);
  });

  it("treats 12:00 (720) as afternoon start", () => {
    const view = buildScheduleDayView({
      challenges: [scheduleItem({ id: "1", matchDate, startMinute: 720 })],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(1);
  });

  it("treats 18:00 (1080) as evening start", () => {
    const view = buildScheduleDayView({
      challenges: [scheduleItem({ id: "1", matchDate, startMinute: 1080 })],
      matchDate,
    });

    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(1);
  });
});

describe("formatScheduleMinute", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(formatScheduleMinute(540)).toBe("09:00");
    expect(formatScheduleMinute(0)).toBe("00:00");
    expect(formatScheduleMinute(1140)).toBe("19:00");
  });
});

describe("formatDateToUtcKey", () => {
  it("formats a Date as YYYY-MM-DD using UTC", () => {
    expect(formatDateToUtcKey(new Date(Date.UTC(2026, 5, 26)))).toBe(
      "2026-06-26"
    );
  });
});
