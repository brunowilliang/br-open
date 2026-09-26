import { describe, expect, it } from "bun:test";

import {
  buildRevenueSeries,
  organizerCentsOf,
  type RevenueCharge,
} from "../dashboard-rules";
import {
  buildBrazilMonthKey,
  buildRecentMonthKeys,
  monthKeyWindowStartMs,
} from "../rules";

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

const charge = (overrides: Partial<RevenueCharge>): RevenueCharge => ({
  amountCents: 10_000,
  paidAtMs: null,
  sourceId: "entry-1",
  sourceLabel: null,
  sourceType: "tournament_entry",
  splitConfig: null,
  status: "PAID",
  ...overrides,
});

describe("brazil calendar helpers", () => {
  it("buckets the month by the Brazilian day boundary", () => {
    // 02:59 UTC de 01/05 = 23:59 BRT de 30/04 -> abril.
    expect(buildBrazilMonthKey(Date.UTC(2026, 4, 1, 2, 59))).toBe("2026-04");
    // 03:00 UTC de 01/05 = 00:00 BRT de 01/05 -> maio.
    expect(buildBrazilMonthKey(Date.UTC(2026, 4, 1, 3, 0))).toBe("2026-05");
  });

  it("builds ascending month keys ending at the current month", () => {
    expect(
      buildRecentMonthKeys({ months: 3, nowMs: Date.UTC(2026, 8, 19, 12) })
    ).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("wraps the year walking months back", () => {
    expect(
      buildRecentMonthKeys({ months: 3, nowMs: Date.UTC(2026, 0, 15, 12) })
    ).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("starts a month window at midnight BRT", () => {
    expect(monthKeyWindowStartMs("2026-04")).toBe(
      Date.UTC(2026, 3, 1) - BRT_OFFSET_MS
    );
  });
});

describe("organizerCentsOf", () => {
  it("uses the split snapshot organizer cents when present", () => {
    expect(
      organizerCentsOf({
        amountCents: 10_000,
        splitConfig: { organizerCents: 9000 },
      })
    ).toBe(9000);
  });

  it("falls back to the full amount without a split", () => {
    expect(organizerCentsOf({ amountCents: 10_000, splitConfig: null })).toBe(
      10_000
    );
    expect(organizerCentsOf({ amountCents: 10_000, splitConfig: {} })).toBe(
      10_000
    );
  });
});

describe("buildRevenueSeries", () => {
  const nowMs = Date.UTC(2026, 8, 19, 12);

  it("sums only PAID charges inside the window, per Brazilian month", () => {
    const series = buildRevenueSeries({
      charges: [
        charge({
          paidAtMs: Date.UTC(2026, 8, 5),
          splitConfig: { organizerCents: 9000 },
        }),
        // 20:00 BRT de 31/08 -> agosto.
        charge({ paidAtMs: Date.UTC(2026, 7, 31, 23), sourceId: "entry-2" }),
        // 00:30 UTC de 01/09 = 21:30 BRT de 31/08 -> AINDA agosto.
        charge({ paidAtMs: Date.UTC(2026, 8, 1, 0, 30), sourceId: "entry-2" }),
        // Fora da janela (maio).
        charge({ paidAtMs: Date.UTC(2026, 4, 10) }),
        // Ignorados: não pago / estornado / sem paidAt.
        charge({ paidAtMs: Date.UTC(2026, 8, 6), status: "PENDING" }),
        charge({ paidAtMs: Date.UTC(2026, 8, 6), status: "REFUNDED" }),
        charge({ status: "PAID" }),
      ],
      months: 3,
      nowMs,
    });

    expect(series.series).toEqual([
      { month: "2026-07", receivedCents: 0 },
      { month: "2026-08", receivedCents: 20_000 },
      { month: "2026-09", receivedCents: 9000 },
    ]);
    expect(series.totalCents).toBe(29_000);
  });

  it("groups by competition and sorts by revenue, keeping the label snapshot", () => {
    const series = buildRevenueSeries({
      charges: [
        charge({
          paidAtMs: Date.UTC(2026, 8, 5),
          sourceId: "entry-1",
          sourceLabel: "Copa Vila",
          sourceType: "tournament_entry",
        }),
        charge({
          paidAtMs: Date.UTC(2026, 8, 6),
          sourceId: "entry-1",
          sourceLabel: "Copa Vila",
          sourceType: "tournament_entry",
        }),
        charge({
          paidAtMs: Date.UTC(2026, 8, 7),
          sourceId: "entry-2",
          sourceLabel: "Copa Norte",
        }),
      ],
      months: 2,
      nowMs,
    });

    expect(series.bySource).toEqual([
      {
        sourceId: "entry-1",
        sourceLabel: "Copa Vila",
        sourceType: "tournament_entry",
        totalCents: 20_000,
      },
      {
        sourceId: "entry-2",
        sourceLabel: "Copa Norte",
        sourceType: "tournament_entry",
        totalCents: 10_000,
      },
    ]);
  });
});
