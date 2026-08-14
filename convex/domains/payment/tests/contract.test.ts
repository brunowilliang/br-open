import { describe, expect, it } from "bun:test";

import {
  PAYMENT_CHARGE_STATUSES,
  PAYMENT_ACCOUNT_STATUSES,
  createChargeOutputSchema,
  paymentAccountSchema,
  paymentChargeStatusSchema,
  splitConfigSchema,
  paymentAccountStatusSchema,
  withdrawBalanceSchema,
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

  describe("paymentAccountSchema", () => {
    it("accepts a snapshot with an account name (IBX-0002)", () => {
      const result = paymentAccountSchema.parse({
        accountName: "Liga do Bruno",
        name: "Bola na Rede LTDA",
        onboardedAt: "2026-08-11T12:00:00Z",
        pixKey: "org@example.com",
        status: "active",
      });
      expect(result.accountName).toBe("Liga do Bruno");
      expect(result.name).toBe("Bola na Rede LTDA");
    });

    it("parses legacy snapshots without accountName as null", () => {
      const result = paymentAccountSchema.parse({
        name: "Bola na Rede LTDA",
        onboardedAt: "2026-07-22T12:00:00Z",
        pixKey: "org@example.com",
        status: "active",
      });
      expect(result.accountName).toBeNull();
    });

    it("rejects an empty pix key", () => {
      expect(() =>
        paymentAccountSchema.parse({
          accountName: null,
          name: "Bola na Rede LTDA",
          onboardedAt: null,
          pixKey: "",
          status: "active",
        })
      ).toThrow();
    });
  });

  describe("withdrawBalanceSchema", () => {
    it("accepts a balance with withdraw destination (IBX-0002)", () => {
      const result = withdrawBalanceSchema.parse({
        accountName: "Liga do Bruno",
        balanceCents: 15_000,
        feeTiers: [{ feeCents: 500, upToCents: 100_000 }],
        freeFromCents: 300_000,
        minWithdrawCents: 2000,
        pixKey: "or********om",
      });
      expect(result.accountName).toBe("Liga do Bruno");
      expect(result.pixKey).toBe("or********om");
    });

    it("accepts a null account name for legacy keys", () => {
      const result = withdrawBalanceSchema.parse({
        accountName: null,
        balanceCents: 0,
        feeTiers: [],
        freeFromCents: 300_000,
        minWithdrawCents: 2000,
        pixKey: "or********om",
      });
      expect(result.accountName).toBeNull();
    });

    it("requires the destination pix key", () => {
      expect(() =>
        withdrawBalanceSchema.parse({
          accountName: null,
          balanceCents: 0,
          feeTiers: [],
          freeFromCents: 300_000,
          minWithdrawCents: 2000,
        })
      ).toThrow();
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
