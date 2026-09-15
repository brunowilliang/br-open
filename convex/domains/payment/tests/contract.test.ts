import { describe, expect, it } from "bun:test";

import {
  PAYMENT_CHARGE_STATUSES,
  PAYMENT_ACCOUNT_STATUSES,
  checkoutContextSchema,
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

  describe("checkoutContextSchema", () => {
    const base = {
      amountCents: 1000,
      brCode: "pix-br-code",
      chargeId: "charge-123",
      expiresAt: "2026-07-01T12:00:00Z",
      pendingCharge: null,
      qrCodeUrl: "https://api.woovi.com/charge/image/abc.png",
      sourceId: "membership-1",
      sourceLabel: "Liga do Bruno",
      sourceType: "league_membership",
      status: "PAID" as const,
    };

    it("carries the live membership state of the source", () => {
      const parsed = checkoutContextSchema.parse({
        ...base,
        canRenew: true,
        membershipDueAt: 1_700_000_000_000,
        membershipStatus: "payment_due",
      });

      expect(parsed.canRenew).toBe(true);
      expect(parsed.membershipDueAt).toBe(1_700_000_000_000);
      expect(parsed.membershipStatus).toBe("payment_due");
      // The charge's own status is still reported as stored.
      expect(parsed.status).toBe("PAID");
      // Nothing pending for the source: the screen keeps its previous behaviour.
      expect(parsed.pendingCharge).toBeNull();
    });

    it("accepts a source without a membership (nulls)", () => {
      const parsed = checkoutContextSchema.parse({
        ...base,
        canRenew: false,
        membershipDueAt: null,
        membershipStatus: null,
        sourceType: "tournament_entry",
      });

      expect(parsed.membershipStatus).toBeNull();
      expect(parsed.canRenew).toBe(false);
    });

    it("reports a live pending charge next to a terminal link charge (BUG-0025)", () => {
      const parsed = checkoutContextSchema.parse({
        ...base,
        canRenew: true,
        membershipDueAt: 1_700_000_000_000,
        membershipStatus: "payment_due",
        pendingCharge: {
          amountCents: 2500,
          brCode: "pix-br-code-new",
          chargeId: "charge-456",
          expiresAt: "2026-09-15T11:57:04Z",
          qrCodeUrl: "https://api.woovi.com/charge/image/def.png",
          status: "PENDING",
        },
        status: "EXPIRED" as const,
      });

      // The link's charge stays historical (the screen's header decides on the
      // membership); the pending charge is the PIX actually being shown.
      expect(parsed.status).toBe("EXPIRED");
      expect(parsed.pendingCharge?.chargeId).toBe("charge-456");
      expect(parsed.pendingCharge?.status).toBe("PENDING");
      expect(parsed.pendingCharge?.expiresAt).toBe("2026-09-15T11:57:04Z");
    });

    it("rejects a pending charge with an unknown status", () => {
      expect(() =>
        checkoutContextSchema.parse({
          ...base,
          canRenew: false,
          membershipDueAt: null,
          membershipStatus: null,
          pendingCharge: {
            amountCents: 1000,
            brCode: "pix-br-code",
            chargeId: "charge-456",
            expiresAt: null,
            qrCodeUrl: "https://api.woovi.com/charge/image/def.png",
            status: "ACTIVE",
          },
        })
      ).toThrow();
    });
  });
});
