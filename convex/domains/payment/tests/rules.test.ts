import { describe, expect, it } from "bun:test";

import type { PaymentChargeStatus } from "../contract";
import {
  CHARGE_EXPIRES_IN_SECONDS,
  CHARGE_STATUS_EXPIRED,
  CHARGE_STATUS_PAID,
  CHARGE_STATUS_PENDING,
  CHARGE_STATUS_REFUNDED,
  canChargeBeExpired,
  canChargeBePaid,
  canChargeBeRefunded,
  canMembershipBeCharged,
  normalizeProviderStatus,
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
  // canChargeBeExpired — only PENDING can be expired (avoid expiring PAID)
  // -------------------------------------------------------------------------

  describe("canChargeBeExpired", () => {
    it("allows EXPIRED transition from PENDING", () => {
      expect(canChargeBeExpired({ status: "PENDING" })).toBe(true);
    });

    it("rejects expiring an already-PAID charge", () => {
      expect(canChargeBeExpired({ status: "PAID" })).toBe(false);
    });

    it("rejects expiring a REFUNDED charge", () => {
      expect(canChargeBeExpired({ status: "REFUNDED" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canChargeBeRefunded — PAID (and defensively EXPIRED) can be refunded
  // -------------------------------------------------------------------------

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

    it("rejects refunding an already-REFUNDED charge", () => {
      expect(canChargeBeRefunded({ status: "REFUNDED" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canMembershipBeCharged — only awaiting_payment is chargeable
  // -------------------------------------------------------------------------

  describe("canMembershipBeCharged", () => {
    it("allows charging when membership is awaiting_payment", () => {
      expect(canMembershipBeCharged({ status: "awaiting_payment" })).toBe(true);
    });

    it("rejects charging an active membership", () => {
      expect(canMembershipBeCharged({ status: "active" })).toBe(false);
    });

    it("rejects charging a pending membership", () => {
      expect(canMembershipBeCharged({ status: "pending" })).toBe(false);
    });

    it("rejects charging a removed membership", () => {
      expect(canMembershipBeCharged({ status: "removed" })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // normalizeProviderStatus — map AbacatePay strings onto our enum
  // -------------------------------------------------------------------------

  describe("normalizeProviderStatus", () => {
    type Case = {
      input: string | null | undefined;
      expected: PaymentChargeStatus;
    };
    const cases: Case[] = [
      { input: "PENDING", expected: CHARGE_STATUS_PENDING },
      { input: "PAID", expected: CHARGE_STATUS_PAID },
      { input: "EXPIRED", expected: CHARGE_STATUS_EXPIRED },
      { input: "REFUNDED", expected: CHARGE_STATUS_REFUNDED },
      { input: "FAILED", expected: "FAILED" },
      // AbacatePay uses CANCELLED for failed card charges — we collapse to FAILED.
      { input: "CANCELLED", expected: "FAILED" },
      // Unknown / missing — default to PENDING so the charge stays payable.
      { input: undefined, expected: CHARGE_STATUS_PENDING },
      { input: null, expected: CHARGE_STATUS_PENDING },
      { input: "SOMETHING_UNDOCUMENTED", expected: CHARGE_STATUS_PENDING },
    ];

    for (const { input, expected } of cases) {
      it(`maps ${JSON.stringify(input)} → ${expected}`, () => {
        expect(normalizeProviderStatus(input)).toBe(expected);
      });
    }
  });
});
