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
  computeWooviFeeCents,
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

  describe("computeWooviFeeCents", () => {
    it("clamps to the R$0.50 minimum below 0.8% of the ticket", () => {
      expect(computeWooviFeeCents(500)).toBe(50); // R$5.00 -> min
      expect(computeWooviFeeCents(6250)).toBe(50); // R$62.50 boundary
      expect(computeWooviFeeCents(6251)).toBe(50);
    });

    it("applies 0.8% between the minimum and maximum", () => {
      expect(computeWooviFeeCents(7000)).toBe(56); // 0.8% of R$70.00
    });

    it("clamps to the R$5.00 maximum at R$625.00 and above", () => {
      expect(computeWooviFeeCents(62_500)).toBe(500);
      expect(computeWooviFeeCents(62_501)).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // computeSplit — organizer vs BR-Open split math (DECISAO-004)
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
      expect(split.wooviFeeCents).toBe(50);
      // Platform nets fee - Woovi fee: R$5.00 - R$0.50.
      expect(split.brOpenCents - split.wooviFeeCents).toBe(450);
    });

    it("at 0% fee the margin floor still applies (DECISAO-004)", () => {
      const split = computeSplit({
        amountCents: 9000,
        feePercent: 0,
        recipientPixKey: "k",
      });
      // fee = max(0, Woovi fee + R$1.00) = 72 + 100.
      expect(split.brOpenCents).toBe(172);
      expect(split.organizerCents).toBe(8828);
      expect(split.wooviFeeCents).toBe(72);
      expect(split.brOpenCents - split.wooviFeeCents).toBe(100);
    });

    it("rounds so organizer + brOpen always sums exactly to amountCents", () => {
      // R$33.33 at 10% would be 333.3 — must round and stay exact.
      const split = computeSplit({
        amountCents: 3333,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(split.brOpenCents).toBe(333);
      expect(split.organizerCents).toBe(3000);
      expect(split.organizerCents + split.brOpenCents).toBe(3333);
      expect(split.wooviFeeCents).toBe(50);
    });

    it("applies the R$1.50 floor below R$15 and 10% from R$15 up (DECISAO-004 table)", () => {
      const cases = [
        { amountCents: 500, fee: 150, net: 100, organizer: 350, wooviFee: 50 },
        {
          amountCents: 1000,
          fee: 150,
          net: 100,
          organizer: 850,
          wooviFee: 50,
        },
        {
          amountCents: 1500,
          fee: 150,
          net: 100,
          organizer: 1350,
          wooviFee: 50,
        },
        {
          amountCents: 2000,
          fee: 200,
          net: 150,
          organizer: 1800,
          wooviFee: 50,
        },
        {
          amountCents: 9000,
          fee: 900,
          net: 828,
          organizer: 8100,
          wooviFee: 72,
        },
        {
          amountCents: 20_000,
          fee: 2000,
          net: 1840,
          organizer: 18_000,
          wooviFee: 160,
        },
        {
          amountCents: 62_500,
          fee: 6250,
          net: 5750,
          organizer: 56_250,
          wooviFee: 500,
        },
      ] as const;

      for (const c of cases) {
        const split = computeSplit({
          amountCents: c.amountCents,
          feePercent: 10,
          recipientPixKey: "k",
        });
        expect(split.brOpenCents).toBe(c.fee);
        expect(split.organizerCents).toBe(c.organizer);
        expect(split.wooviFeeCents).toBe(c.wooviFee);
        expect(split.brOpenCents - split.wooviFeeCents).toBe(c.net);
      }
    });

    it("handles the boundary tickets exactly", () => {
      // Floor boundary: R$14.99 still pays the R$1.50 floor.
      const at1499 = computeSplit({
        amountCents: 1499,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(at1499.brOpenCents).toBe(150);
      expect(at1499.organizerCents).toBe(1349);

      // Woovi fee minimum boundary: 0.8% kicks in at R$62.50.
      const at6249 = computeSplit({
        amountCents: 6249,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(at6249.wooviFeeCents).toBe(50);
      expect(at6249.brOpenCents).toBe(625); // round(624.9)
      expect(at6249.organizerCents).toBe(5624);

      const at6250 = computeSplit({
        amountCents: 6250,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(at6250.wooviFeeCents).toBe(50);
      expect(at6250.brOpenCents).toBe(625);
      expect(at6250.organizerCents).toBe(5625);

      // Woovi fee maximum boundary: capped at R$5.00 from R$625.00.
      const at62499 = computeSplit({
        amountCents: 62_499,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(at62499.wooviFeeCents).toBe(500);
      expect(at62499.brOpenCents).toBe(6250); // round(6249.9)
      expect(at62499.organizerCents).toBe(56_249);

      const at62500 = computeSplit({
        amountCents: 62_500,
        feePercent: 10,
        recipientPixKey: "k",
      });
      expect(at62500.wooviFeeCents).toBe(500);
      expect(at62500.brOpenCents).toBe(6250);
      expect(at62500.organizerCents).toBe(56_250);
    });

    it("keeps the platform net >= R$1.00 for any ticket", () => {
      for (let t = 100; t <= 100_000; t += 997) {
        const split = computeSplit({
          amountCents: t,
          feePercent: 10,
          recipientPixKey: "k",
        });
        expect(split.organizerCents).toBeGreaterThanOrEqual(0);
        expect(split.brOpenCents + split.organizerCents).toBe(t);
        expect(split.wooviFeeCents).toBeGreaterThanOrEqual(50);
        expect(split.wooviFeeCents).toBeLessThanOrEqual(500);
        if (t >= 150) {
          // Floor guarantees the R$1.00 net margin for real tickets.
          expect(
            split.brOpenCents - split.wooviFeeCents
          ).toBeGreaterThanOrEqual(100);
        } else {
          // Ticket below the floor: fee clamps to the ticket, organizer 0.
          expect(split.brOpenCents).toBe(t);
          expect(split.organizerCents).toBe(0);
        }
      }
    });

    it("per-league override replaces the percentage but keeps the floor", () => {
      // 5% of R$10.00 is R$0.50 < floor R$1.50 -> floor applies.
      const low = computeSplit({
        amountCents: 1000,
        feePercent: 5,
        recipientPixKey: "k",
      });
      expect(low.brOpenCents).toBe(150);
      expect(low.organizerCents).toBe(850);
      expect(low.wooviFeeCents).toBe(50);

      // 5% of R$200.00 is R$10.00 > floor -> percentage wins.
      const high = computeSplit({
        amountCents: 20_000,
        feePercent: 5,
        recipientPixKey: "k",
      });
      expect(high.brOpenCents).toBe(1000);
      expect(high.organizerCents).toBe(19_000);
      expect(high.wooviFeeCents).toBe(160);
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
