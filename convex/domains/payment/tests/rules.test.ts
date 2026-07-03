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
  normalizeWooviStatus,
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

    it("rejects charging an active membership", () => {
      expect(canMembershipBeCharged({ status: "active" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // normalizeWooviStatus — map Woovi ACTIVE/COMPLETED/EXPIRED onto our enum
  // -------------------------------------------------------------------------

  describe("normalizeWooviStatus", () => {
    type Case = {
      input: string | null | undefined;
      expected: PaymentChargeStatus;
    };
    const cases: Case[] = [
      // Woovi uses ACTIVE for a charge awaiting payment.
      { input: "ACTIVE", expected: CHARGE_STATUS_PENDING },
      { input: "COMPLETED", expected: CHARGE_STATUS_PAID },
      { input: "EXPIRED", expected: CHARGE_STATUS_EXPIRED },
      // Unknown / missing — default to PENDING so the charge stays payable.
      { input: undefined, expected: CHARGE_STATUS_PENDING },
      { input: null, expected: CHARGE_STATUS_PENDING },
      { input: "SOMETHING_UNDOCUMENTED", expected: CHARGE_STATUS_PENDING },
    ];

    for (const { input, expected } of cases) {
      it(`maps ${JSON.stringify(input)} -> ${expected}`, () => {
        expect(normalizeWooviStatus(input)).toBe(expected);
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
});
