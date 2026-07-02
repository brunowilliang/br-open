import { describe, expect, it } from "bun:test";

import {
  PAYMENT_CHARGE_STATUSES,
  PIX_KEY_TYPES,
  pixKeyTypeSchema,
  paymentChargeStatusSchema,
  createChargeOutputSchema,
} from "../contract";

describe("payment contract", () => {
  describe("PIX_KEY_TYPES", () => {
    it("lists the six valid PIX key types", () => {
      expect(PIX_KEY_TYPES).toEqual([
        "cpf",
        "cnpj",
        "email",
        "phone",
        "random",
        "evp",
      ]);
    });
  });

  describe("pixKeyTypeSchema", () => {
    it("accepts valid PIX key types", () => {
      for (const type of PIX_KEY_TYPES) {
        expect(pixKeyTypeSchema.parse(type)).toBe(type);
      }
    });

    it("rejects invalid types", () => {
      expect(() => pixKeyTypeSchema.parse("invalid")).toThrow();
    });
  });

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

  describe("createChargeOutputSchema", () => {
    it("accepts a valid charge output", () => {
      const result = createChargeOutputSchema.parse({
        brCode: "pix-br-code",
        brCodeBase64: "base64-string",
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
