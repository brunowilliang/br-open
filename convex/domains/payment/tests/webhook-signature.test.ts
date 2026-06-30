import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";

import { verifyWooviWebhookSignature } from "../../../functions/payment/woovi-client";

const SECRET = "test-secret";

function sign(body: string): string {
  // Woovi encodes the HMAC-SHA256 digest as BASE64 (not hex).
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

describe("verifyWooviWebhookSignature", () => {
  it("accepts a valid base64 HMAC signature over the raw body", () => {
    const body = JSON.stringify({ event: "OPENPIX:CHARGE_COMPLETED" });
    expect(verifyWooviWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature computed over a different body", () => {
    expect(
      verifyWooviWebhookSignature(
        JSON.stringify({ event: "tampered" }),
        sign(JSON.stringify({ original: true })),
        SECRET
      )
    ).toBe(false);
  });

  it("rejects an empty or malformed signature", () => {
    expect(verifyWooviWebhookSignature("{}", "", SECRET)).toBe(false);
  });

  it("returns false when the secret is empty", () => {
    const body = "{}";
    expect(verifyWooviWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("returns false (never throws) on a non-base64 signature", () => {
    expect(() =>
      verifyWooviWebhookSignature("{}", "not-base64!!", SECRET)
    ).not.toThrow();
    expect(verifyWooviWebhookSignature("{}", "not-base64!!", SECRET)).toBe(
      false
    );
  });
});
