/**
 * Abacate Pay webhook signature verification.
 *
 * Pure crypto helpers using the Web Crypto API (`crypto.subtle`) so they
 * work in Convex V8 isolates. The official `@abacatepay/types` ships a
 * `verifyWebhookSignature` helper, but it uses `node:crypto` + `Buffer`,
 * which are NOT available in Convex — so we reimplement the same algorithm
 * here. Both use HMAC-SHA256 + base64 + timing-safe compare.
 *
 * Moved out of `functions/payment/webhook.ts` so it can be imported and
 * tested from the domain layer.
 *
 * @see https://docs.abacatepay.com/pages/webhooks
 */

/**
 * Fixed public HMAC key published by AbacatePay for webhook signature
 * verification. This is the SAME value for every merchant — it is not a
 * secret. The webhook secret (query param) is the secret part.
 *
 * Source: https://docs.abacatepay.com/pages/webhooks
 */
export const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

/**
 * Verifies the `X-Webhook-Signature` header against the raw request body.
 * Returns true when the signature matches.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureFromHeader: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ABACATEPAY_PUBLIC_KEY);
  const bodyData = encoder.encode(rawBody);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, bodyData);
  const expected = arrayBufferToBase64(signature);

  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signatureFromHeader);

  return timingSafeEqual(a, b);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional timing-safe XOR comparison
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}
