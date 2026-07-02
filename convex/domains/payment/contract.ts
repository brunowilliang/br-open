import { z } from "zod";

// ---------------------------------------------------------------------------
// PIX key types (provider-agnostic)
// ---------------------------------------------------------------------------

export const PIX_KEY_TYPES = [
  "cpf",
  "cnpj",
  "email",
  "phone",
  "random",
  "evp",
] as const;

export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const pixKeyTypeSchema = z.enum([...PIX_KEY_TYPES]);

// ---------------------------------------------------------------------------
// Payment charge statuses
// ---------------------------------------------------------------------------

export const PAYMENT_CHARGE_STATUSES = [
  "PENDING",
  "PAID",
  "EXPIRED",
  "REFUNDED",
  "FAILED",
] as const;

export type PaymentChargeStatus = (typeof PAYMENT_CHARGE_STATUSES)[number];

export const paymentChargeStatusSchema = z.enum([...PAYMENT_CHARGE_STATUSES]);

// ---------------------------------------------------------------------------
// Charge output (returned to client after creating a PIX charge)
// ---------------------------------------------------------------------------

export const createChargeOutputSchema = z.object({
  brCode: z.string(),
  brCodeBase64: z.string(),
  chargeId: z.string(),
  expiresAt: z.string().nullable(),
  status: paymentChargeStatusSchema,
});

export type CreateChargeOutput = z.infer<typeof createChargeOutputSchema>;
