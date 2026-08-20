import { describe, expect, test } from "bun:test";

import { shouldSendOtpOnOpen } from "./otp-open-send";

describe("shouldSendOtpOnOpen", () => {
  const NOW = 1_800_000_000_000;

  test("sem timestamp persistido (primeira abertura) envia", () => {
    expect(shouldSendOtpOnOpen(60, null, NOW)).toBe(true);
  });

  test("timestamp inválido é tratado como ausente (envia)", () => {
    expect(shouldSendOtpOnOpen(60, "não-numérico", NOW)).toBe(true);
  });

  test("cooldown ativo (menos de 60s do envio anterior) NÃO envia", () => {
    expect(shouldSendOtpOnOpen(60, String(NOW - 30_000), NOW)).toBe(false);
    expect(shouldSendOtpOnOpen(60, NOW - 59_999, NOW)).toBe(false);
  });

  test("na fronteira exata do cooldown (60s) envia", () => {
    expect(shouldSendOtpOnOpen(60, String(NOW - 60_000), NOW)).toBe(true);
  });

  test("cooldown expirado envia e resetará o balde", () => {
    expect(shouldSendOtpOnOpen(60, String(NOW - 61_000), NOW)).toBe(true);
  });

  test("timestamp no futuro (clock skew) é tratado como ativo", () => {
    expect(shouldSendOtpOnOpen(60, String(NOW + 5000), NOW)).toBe(false);
  });
});
