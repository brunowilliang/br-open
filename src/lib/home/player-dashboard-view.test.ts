import { describe, expect, it } from "bun:test";

import {
  buildPlayerResultsChart,
  formatDashboardMonthLabel,
} from "./player-dashboard-view";

describe("formatDashboardMonthLabel", () => {
  it("renders the short pt-BR month of the key", () => {
    expect(formatDashboardMonthLabel("2026-09")).toBe("set.");
    expect(formatDashboardMonthLabel("2026-01")).toBe("jan.");
  });

  it("returns the raw key when it is not parseable", () => {
    expect(formatDashboardMonthLabel("livre")).toBe("livre");
  });
});

describe("buildPlayerResultsChart", () => {
  it("maps month keys to short labels keeping wins and losses", () => {
    expect(
      buildPlayerResultsChart([
        { losses: 1, month: "2026-08", wins: 0 },
        { losses: 0, month: "2026-09", wins: 3 },
      ])
    ).toEqual([
      { label: "ago.", losses: 1, wins: 0 },
      { label: "set.", losses: 0, wins: 3 },
    ]);
  });
});
