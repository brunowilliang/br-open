import { describe, expect, it } from "bun:test";

import {
  BILLING_INTERVALS,
  LeaguePaymentStatusOptions,
  OrganizationWooviAccountStatusOptions,
  buildPaymentCorrelationId,
  computeSplit,
} from "../contract";

describe("payment contract", () => {
  describe("computeSplit", () => {
    it("splits the amount by the platform fee percent, rounding to cents", () => {
      expect(
        computeSplit({ amountCents: 5000, platformFeePercent: 10 })
      ).toEqual({
        brOpenCents: 500,
        organizerCents: 4500,
      });
    });

    it("floors the platform cut to avoid overcharging the organizer", () => {
      // 33% of 1001 = 330.33 -> 330, organizer gets 671
      expect(
        computeSplit({ amountCents: 1001, platformFeePercent: 33 })
      ).toEqual({
        brOpenCents: 330,
        organizerCents: 671,
      });
    });

    it("assigns the whole amount to the organizer when the fee is 0%", () => {
      expect(
        computeSplit({ amountCents: 5000, platformFeePercent: 0 })
      ).toEqual({
        brOpenCents: 0,
        organizerCents: 5000,
      });
    });

    it("assigns the whole amount to the platform when the fee is 100%", () => {
      expect(
        computeSplit({ amountCents: 5000, platformFeePercent: 100 })
      ).toEqual({
        brOpenCents: 5000,
        organizerCents: 0,
      });
    });

    it("throws on a negative amount or percent", () => {
      expect(() =>
        computeSplit({ amountCents: -1, platformFeePercent: 10 })
      ).toThrow();
      expect(() =>
        computeSplit({ amountCents: 100, platformFeePercent: -1 })
      ).toThrow();
    });

    it("throws on a percent above 100", () => {
      expect(() =>
        computeSplit({ amountCents: 100, platformFeePercent: 101 })
      ).toThrow();
    });
  });

  describe("buildPaymentCorrelationId", () => {
    it("is deterministic for a membership + cycle anchor", () => {
      expect(
        buildPaymentCorrelationId({
          leagueMembershipId: "mem-1",
          cycleAnchor: "2026-07-01",
        })
      ).toBe("mem:mem-1:2026-07-01");
    });

    it("produces different ids for different cycles of the same membership", () => {
      const a = buildPaymentCorrelationId({
        leagueMembershipId: "mem-1",
        cycleAnchor: "2026-07-01",
      });
      const b = buildPaymentCorrelationId({
        leagueMembershipId: "mem-1",
        cycleAnchor: "2026-08-01",
      });
      expect(a).not.toBe(b);
    });
  });

  describe("LeaguePaymentStatusOptions", () => {
    it("lists the four lifecycle states", () => {
      expect(LeaguePaymentStatusOptions).toEqual([
        "pending_payment",
        "paid",
        "expired",
        "failed",
      ]);
    });
  });

  describe("OrganizationWooviAccountStatusOptions", () => {
    it("lists active and rejected (no KYC pending)", () => {
      expect(OrganizationWooviAccountStatusOptions).toEqual([
        "active",
        "rejected",
      ]);
    });
  });

  describe("BILLING_INTERVALS", () => {
    it("lists the four billing intervals", () => {
      expect(BILLING_INTERVALS).toEqual(["week", "month", "quarter", "year"]);
    });
  });
});
