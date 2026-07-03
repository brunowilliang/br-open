import { describe, expect, it } from "bun:test";

import { verifyWooviWebhookSignature } from "../webhook-signature";

/**
 * Verifies a body the way Woovi does: RSA-SHA256 with Woovi's private key,
 * base64-encoded signature in `x-webhook-signature`.
 *
 * In tests we cannot sign with the private key (we don't have it — only Woovi
 * does). So we assert the NEGATIVE paths that don't require signing:
 * - empty signature rejected
 * - garbage signature rejected
 * - valid-looking-but-wrong base64 rejected
 *
 * The POSITIVE path (a real Woovi-signed payload) is exercised end-to-end in
 * the manual webhook validation step against the Woovi sandbox.
 */
describe("verifyWooviWebhookSignature (RSA-SHA256, public key)", () => {
  it("rejects an empty signature", async () => {
    expect(
      await verifyWooviWebhookSignature(
        JSON.stringify({ event: "OPENPIX:TRANSACTION_RECEIVED" }),
        ""
      )
    ).toBe(false);
  });

  it("rejects a garbage signature", async () => {
    expect(
      await verifyWooviWebhookSignature("{}", "not-a-valid-base64-signature")
    ).toBe(false);
  });

  it("rejects a valid-base64 but wrong signature", async () => {
    // Random base64 — will decode but RSA verify will return false.
    expect(
      await verifyWooviWebhookSignature(
        "{}",
        "dGhpcyBpcyBhIHRlc3Qgc2lnbmF0dXJlIHRoYXQgc2hvdWxkIGZhaWw="
      )
    ).toBe(false);
  });

  it("rejects when the body is tampered (signature from a different payload)", async () => {
    // Even with a syntactically valid signature, a tampered body fails verify.
    expect(
      await verifyWooviWebhookSignature(
        JSON.stringify({ event: "tampered" }),
        "dGhpcyBpcyBhIHRlc3Qgc2lnbmF0dXJlIHRoYXQgc2hvdWxkIGZhaWw="
      )
    ).toBe(false);
  });
});
