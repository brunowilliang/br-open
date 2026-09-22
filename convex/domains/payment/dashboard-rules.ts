/**
 * Organizer dashboard revenue rules — pure functions only.
 *
 * The series comes from the real `paymentCharge` history (PAID charges,
 * organizer split), so it costs no table and no cron. Month keys follow the
 * product calendar (Brazil, UTC-3 fixed — see `buildBrazilMonthKey`).
 */

import {
  buildBrazilMonthKey,
  buildRecentMonthKeys,
  CHARGE_STATUS_PAID,
} from "./rules";

/**
 * Revenue credited to the organizer of one charge: the split's organizer
 * part when a split snapshot exists, else the full amount. Same math the
 * overview KPIs use — moved here so the series and the KPIs can never
 * diverge.
 */
export function organizerCentsOf(charge: {
  amountCents: number;
  splitConfig: { organizerCents?: number } | null;
}): number {
  return charge.splitConfig?.organizerCents ?? charge.amountCents ?? 0;
}

/** Minimal charge projection the series needs (mapped from the ORM record). */
export type RevenueCharge = {
  amountCents: number;
  paidAtMs: null | number;
  sourceId: string;
  sourceLabel: null | string;
  sourceType: string;
  splitConfig: { organizerCents?: number } | null;
  status: string;
};

export type RevenueSeriesPoint = { month: string; receivedCents: number };

export type RevenueSeriesSource = {
  sourceId: string;
  sourceLabel: null | string;
  sourceType: string;
  totalCents: number;
};

export type RevenueSeries = {
  bySource: RevenueSeriesSource[];
  series: RevenueSeriesPoint[];
  totalCents: number;
};

/**
 * Monthly revenue series + per-competition totals from the charge history.
 * Only PAID charges count, bucketed by the Brazilian month of `paidAt`;
 * anything outside the window is ignored (the window is the contract).
 * `bySource` groups by the polymorphic sourceType+sourceId pair and sorts by
 * revenue, descending — the label snapshot (`sourceLabel`) spares the join.
 */
export function buildRevenueSeries(input: {
  charges: RevenueCharge[];
  months: number;
  nowMs: number;
}): RevenueSeries {
  const monthKeys = buildRecentMonthKeys({
    months: input.months,
    nowMs: input.nowMs,
  });
  const totalsByMonth = new Map<string, number>(
    monthKeys.map((month) => [month, 0])
  );
  const totalsBySource = new Map<string, RevenueSeriesSource>();
  let totalCents = 0;

  for (const charge of input.charges) {
    if (charge.status !== CHARGE_STATUS_PAID || charge.paidAtMs === null) {
      continue;
    }
    const month = buildBrazilMonthKey(charge.paidAtMs);
    const monthTotal = totalsByMonth.get(month);
    if (monthTotal === undefined) {
      continue;
    }
    const cents = organizerCentsOf(charge);
    totalsByMonth.set(month, monthTotal + cents);
    totalCents += cents;

    const sourceKey = `${charge.sourceType}:${charge.sourceId}`;
    const source = totalsBySource.get(sourceKey) ?? {
      sourceId: charge.sourceId,
      sourceLabel: charge.sourceLabel,
      sourceType: charge.sourceType,
      totalCents: 0,
    };
    source.totalCents += cents;
    if (source.sourceLabel === null && charge.sourceLabel !== null) {
      source.sourceLabel = charge.sourceLabel;
    }
    totalsBySource.set(sourceKey, source);
  }

  return {
    bySource: [...totalsBySource.values()].sort(
      (a, b) => b.totalCents - a.totalCents
    ),
    series: monthKeys.map((month) => ({
      month,
      receivedCents: totalsByMonth.get(month) ?? 0,
    })),
    totalCents,
  };
}
