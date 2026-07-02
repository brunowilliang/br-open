import { describe, expect, it } from "bun:test";

// Import the verification helpers from the payment domain.
// We test the pure functions directly since they don't depend on Convex.
import {
  ABACATEPAY_PUBLIC_KEY,
  verifyWebhookSignature,
} from "../webhook-signature";

/**
 * Signs a body with the AbacatePay public key the same way AbacatePay does
 * on the wire — HMAC-SHA256, base64-encoded.
 */
async function sign(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ABACATEPAY_PUBLIC_KEY);
  const bodyData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, bodyData);
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid HMAC-SHA256 signature over the raw body", async () => {
    const body = JSON.stringify({ event: "transparent.completed" });
    const sig = await sign(body);
    expect(await verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("rejects a signature computed over a different body", async () => {
    const sig = await sign(JSON.stringify({ original: true }));
    expect(
      await verifyWebhookSignature(JSON.stringify({ event: "tampered" }), sig)
    ).toBe(false);
  });

  it("rejects an empty signature", async () => {
    expect(await verifyWebhookSignature("{}", "")).toBe(false);
  });

  it("rejects a signature computed with the wrong key", async () => {
    const body = "{}";

    // Sign with a key that is NOT the AbacatePay public key.
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode("wrong-key"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const bytes = new Uint8Array(sig);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const wrongSig = btoa(binary);

    expect(await verifyWebhookSignature(body, wrongSig)).toBe(false);
  });
});
