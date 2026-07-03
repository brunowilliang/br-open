import { describe, expect, it } from "bun:test";

import {
  PAYMENT_CHARGE_STATUSES,
  WOOVI_ACCOUNT_STATUSES,
  createChargeOutputSchema,
  paymentChargeStatusSchema,
  splitConfigSchema,
  wooviAccountStatusSchema,
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

  describe("WOOVI_ACCOUNT_STATUSES", () => {
    it("lists the woovi account lifecycle states", () => {
      expect(WOOVI_ACCOUNT_STATUSES).toEqual(["pending", "active", "rejected"]);
    });
  });

  describe("wooviAccountStatusSchema", () => {
    it("accepts valid statuses", () => {
      expect(wooviAccountStatusSchema.parse("active")).toBe("active");
      expect(wooviAccountStatusSchema.parse("pending")).toBe("pending");
    });

    it("rejects invalid statuses", () => {
      expect(() => wooviAccountStatusSchema.parse("onboarding")).toThrow();
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
        brCodeBase64: "https://api.woovi.com/charge/image/abc.png",
        chargeId: "charge-123",
        expiresAt: "2026-07-01T12:00:00Z",
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
