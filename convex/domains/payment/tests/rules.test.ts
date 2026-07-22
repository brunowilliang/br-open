import { describe, expect, it } from "bun:test";

import type { PaymentChargeStatus } from "../contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  CHARGE_STATUS_EXPIRED,
  CHARGE_STATUS_PAID,
  CHARGE_STATUS_PENDING,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  computeSplit,
  normalizeProviderStatus,
  shouldMarkPaymentDue,
  shouldSendRenewalReminder,
  shouldSuspend,
} from "../rules";

describe("payment rules", () => {
  describe("CHARGE_EXPIRES_IN_SECONDS", () => {
    it("is exactly 1 hour in seconds", () => {
      expect(CHARGE_EXPIRES_IN_SECONDS).toBe(3600);
    });
  });

  // -------------------------------------------------------------------------
  // canChargeBePaid — only PENDING can transition to PAID
  // -------------------------------------------------------------------------

  describe("canChargeBePaid", () => {
    it("allows PAID transition from PENDING", () => {
      expect(canChargeBePaid({ status: "PENDING" })).toBe(true);
    });

    it("rejects double-payment of an already-PAID charge", () => {
      expect(canChargeBePaid({ status: "PAID" })).toBe(false);
    });

    it("rejects payment of an EXPIRED charge (late webhook)", () => {
      expect(canChargeBePaid({ status: "EXPIRED" })).toBe(false);
    });

    it("rejects payment of a REFUNDED charge", () => {
      expect(canChargeBePaid({ status: "REFUNDED" })).toBe(false);
    });

    it("rejects payment of a FAILED charge", () => {
      expect(canChargeBePaid({ status: "FAILED" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canChargeBeExpired / canChargeBeRefunded
  // -------------------------------------------------------------------------

  describe("canChargeBeExpired", () => {
    it("allows EXPIRED transition from PENDING", () => {
      expect(canChargeBeExpired({ status: "PENDING" })).toBe(true);
    });

    it("rejects expiring an already-PAID charge", () => {
      expect(canChargeBeExpired({ status: "PAID" })).toBe(false);
    });
  });

  describe("canChargeBeRefunded", () => {
    it("allows REFUNDED transition from PAID", () => {
      expect(canChargeBeRefunded({ status: "PAID" })).toBe(true);
    });

    it("defensively allows refunding an EXPIRED charge (late webhook)", () => {
      expect(canChargeBeRefunded({ status: "EXPIRED" })).toBe(true);
    });

    it("rejects refunding a still-PENDING charge (nothing to refund)", () => {
      expect(canChargeBeRefunded({ status: "PENDING" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canMembershipBeCharged
  // -------------------------------------------------------------------------

  describe("canMembershipBeCharged", () => {
    it("allows charging when membership is awaiting_payment", () => {
      expect(canMembershipBeCharged({ status: "awaiting_payment" })).toBe(true);
    });

    it("allows charging when membership is payment_due (grace period)", () => {
      expect(canMembershipBeCharged({ status: "payment_due" })).toBe(true);
    });

    it("allows charging when membership is suspended (re-paying)", () => {
      expect(canMembershipBeCharged({ status: "suspended" })).toBe(true);
    });

    it("rejects charging an active membership", () => {
      expect(canMembershipBeCharged({ status: "active" })).toBe(false);
    });

    it("rejects charging a pending membership", () => {
      expect(canMembershipBeCharged({ status: "pending" })).toBe(false);
    });

    it("rejects charging a left membership", () => {
      expect(canMembershipBeCharged({ status: "left" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // normalizeProviderStatus — map Woovi ACTIVE/COMPLETED/EXPIRED onto our enum
  // -------------------------------------------------------------------------

  describe("normalizeProviderStatus", () => {
    type Case = {
      input: string | null | undefined;
      expected: PaymentChargeStatus;
    };
    const cases: Case[] = [
      // Woovi uses ACTIVE for a charge awaiting payment.
      { expected: CHARGE_STATUS_PENDING, input: "ACTIVE" },
      { expected: CHARGE_STATUS_PAID, input: "COMPLETED" },
      { expected: CHARGE_STATUS_EXPIRED, input: "EXPIRED" },
      // Unknown / missing — default to PENDING so the charge stays payable.
      { expected: CHARGE_STATUS_PENDING, input: undefined },
      { expected: CHARGE_STATUS_PENDING, input: null },
      { expected: CHARGE_STATUS_PENDING, input: "SOMETHING_UNDOCUMENTED" },
    ];

    for (const { input, expected } of cases) {
      it(`maps ${JSON.stringify(input)} -> ${expected}`, () => {
        expect(normalizeProviderStatus(input)).toBe(expected);
      });
    }
  });

  // -------------------------------------------------------------------------
  // computeSplit — organizer vs BR-Open split math
  // -------------------------------------------------------------------------

  describe("computeSplit", () => {
    it("splits R$50 at 10% fee -> organizer gets R$45, BR-Open gets R$5", () => {
      const split = computeSplit({
        amountCents: 5000,
        feePercent: 10,
        recipientPixKey: "org@woovi.com",
      });
      expect(split.brOpenCents).toBe(500);
      expect(split.organizerCents).toBe(4500);
      expect(split.organizerCents + split.brOpenCents).toBe(5000);
      expect(split.recipientPixKey).toBe("org@woovi.com");
    });

    it("at 0% fee the organizer gets the full amount", () => {
      const split = computeSplit({
        amountCents: 9000,
        feePercent: 0,
        recipientPixKey: "k",
      });
      expect(split.brOpenCents).toBe(0);
      expect(split.organizerCents).toBe(9000);
    });

    it("rounds so organizer + brOpen always sums exactly to amountCents", () => {
      // R$33.33 at 10% would be 333.3 — must round and stay exact.
      const split = computeSplit({
        amountCents: 3333,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(split.organizerCents + split.brOpenCents).toBe(3333);
    });
  });

  // -------------------------------------------------------------------------
  // Renewal timeline helpers
  // -------------------------------------------------------------------------

  const DAY = 24 * 60 * 60 * 1000;

  describe("shouldSendRenewalReminder", () => {
    it("fires when within the reminder window before due", () => {
      const now = Date.now();
      const nextDue = now + 2 * DAY;
      expect(
        shouldSendRenewalReminder({
          nextDueMs: nextDue,
          nowMs: now,
          reminderDaysBefore: 3,
        })
      ).toBe(true);
    });

    it("does not fire when too far before due", () => {
      const now = Date.now();
      const nextDue = now + 10 * DAY;
      expect(
        shouldSendRenewalReminder({
          nextDueMs: nextDue,
          nowMs: now,
          reminderDaysBefore: 3,
        })
      ).toBe(false);
    });

    it("does not fire after due date has passed", () => {
      const now = Date.now();
      const nextDue = now - 1 * DAY;
      expect(
        shouldSendRenewalReminder({
          nextDueMs: nextDue,
          nowMs: now,
          reminderDaysBefore: 3,
        })
      ).toBe(false);
    });

    it("fires exactly at the boundary (reminderDaysBefore days before due)", () => {
      const now = Date.now();
      const nextDue = now + 3 * DAY;
      expect(
        shouldSendRenewalReminder({
          nextDueMs: nextDue,
          nowMs: now,
          reminderDaysBefore: 3,
        })
      ).toBe(true);
    });

    it("never fires when reminderDaysBefore is 0", () => {
      const now = Date.now();
      const nextDue = now + 1;
      expect(
        shouldSendRenewalReminder({
          nextDueMs: nextDue,
          nowMs: now,
          reminderDaysBefore: 0,
        })
      ).toBe(false);
    });
  });

  describe("shouldMarkPaymentDue", () => {
    it("returns true when due date has passed", () => {
      const now = Date.now();
      expect(shouldMarkPaymentDue({ nextDueMs: now - 1000, nowMs: now })).toBe(
        true
      );
    });

    it("returns false when due date has not arrived", () => {
      const now = Date.now();
      expect(shouldMarkPaymentDue({ nextDueMs: now + 1000, nowMs: now })).toBe(
        false
      );
    });

    it("returns true at exactly the due date", () => {
      const now = Date.now();
      expect(shouldMarkPaymentDue({ nextDueMs: now, nowMs: now })).toBe(true);
    });
  });

  describe("shouldSuspend", () => {
    it("returns true when grace period has elapsed", () => {
      const now = Date.now();
      const nextDue = now - 8 * DAY;
      expect(
        shouldSuspend({
          gracePeriodDays: 7,
          nextDueMs: nextDue,
          nowMs: now,
        })
      ).toBe(true);
    });

    it("returns false when still within grace period", () => {
      const now = Date.now();
      const nextDue = now - 3 * DAY;
      expect(
        shouldSuspend({
          gracePeriodDays: 7,
          nextDueMs: nextDue,
          nowMs: now,
        })
      ).toBe(false);
    });

    it("returns true at exactly the grace boundary", () => {
      const now = Date.now();
      const nextDue = now - 7 * DAY;
      expect(
        shouldSuspend({
          gracePeriodDays: 7,
          nextDueMs: nextDue,
          nowMs: now,
        })
      ).toBe(true);
    });

    it("suspends immediately when grace is 0", () => {
      const now = Date.now();
      const nextDue = now;
      expect(
        shouldSuspend({
          gracePeriodDays: 0,
          nextDueMs: nextDue,
          nowMs: now,
        })
      ).toBe(true);
    });
  });
});
