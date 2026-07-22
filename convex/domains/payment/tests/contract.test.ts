import { describe, expect, it } from "bun:test";

import {
  PAYMENT_CHARGE_STATUSES,
  PAYMENT_ACCOUNT_STATUSES,
  createChargeOutputSchema,
  paymentChargeStatusSchema,
  splitConfigSchema,
  paymentAccountStatusSchema,
} from "../contract";

describe("payment contract", () => {
  describe("PAYMENT_CHARGE_STATUSES", () => {
    it("lists the charge lifecycle states", () => {
      expect(PAYMENT_CHARGE_STATUSES).toEqual([
        "PENDING",
        "PAID",
        "EXPIRED",
        "REFUNDED",
        "FAILED",
      ]);
    });
  });

  describe("paymentChargeStatusSchema", () => {
    it("accepts valid statuses", () => {
      expect(paymentChargeStatusSchema.parse("PENDING")).toBe("PENDING");
      expect(paymentChargeStatusSchema.parse("PAID")).toBe("PAID");
    });

    it("rejects invalid statuses", () => {
      expect(() => paymentChargeStatusSchema.parse("PROCESSING")).toThrow();
    });
  });

  describe("PAYMENT_ACCOUNT_STATUSES", () => {
    it("lists the payment account lifecycle states", () => {
      expect(PAYMENT_ACCOUNT_STATUSES).toEqual([
        "pending",
        "active",
        "rejected",
      ]);
    });
  });

  describe("paymentAccountStatusSchema", () => {
    it("accepts valid statuses", () => {
      expect(paymentAccountStatusSchema.parse("active")).toBe("active");
      expect(paymentAccountStatusSchema.parse("pending")).toBe("pending");
    });

    it("rejects invalid statuses", () => {
      expect(() => paymentAccountStatusSchema.parse("onboarding")).toThrow();
    });
  });

  describe("splitConfigSchema", () => {
    it("accepts a valid split snapshot", () => {
      const result = splitConfigSchema.parse({
        brOpenCents: 500,
        feePercent: 10,
        organizerCents: 4500,
        recipientPixKey: "org@woovi.com",
      });
      expect(result.organizerCents).toBe(4500);
    });

    it("rejects a negative organizer share", () => {
      expect(() =>
        splitConfigSchema.parse({
          brOpenCents: 500,
          feePercent: 10,
          organizerCents: -1,
          recipientPixKey: "org@woovi.com",
        })
      ).toThrow();
    });

    it("rejects a missing recipient pix key", () => {
      expect(() =>
        splitConfigSchema.parse({
          brOpenCents: 500,
          feePercent: 10,
          organizerCents: 4500,
          recipientPixKey: "",
        })
      ).toThrow();
    });
  });

  describe("createChargeOutputSchema", () => {
    it("accepts a valid charge output", () => {
      const result = createChargeOutputSchema.parse({
        brCode: "pix-br-code",
        chargeId: "charge-123",
        expiresAt: "2026-07-01T12:00:00Z",
        qrCodeUrl: "https://api.woovi.com/charge/image/abc.png",
        status: "PENDING",
      });
      expect(result.status).toBe("PENDING");
    });

    it("requires brCode and status", () => {
      expect(() =>
        createChargeOutputSchema.parse({
          brCode: "",
          brCodeBase64: "",
          chargeId: "",
          expiresAt: null,
          status: "INVALID",
        })
      ).toThrow();
    });
  });
});
