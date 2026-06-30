import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies an inbound Woovi webhook signature.
 *
 * Woovi signs the raw request body with HMAC-SHA256 using the shared webhook
 * secret and sends the BASE64 digest in the `x-webhook-signature` header.
 * Returns false (never throws) so the caller can map any failure to a 401
 * without leaking whether the secret is missing, the body is malformed, etc.
 *
 * Reference: github.com/woovibr/woovi-prompts `webhooks.md`.
 */
export function verifyWooviWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!(signature && secret)) {
    return false;
  }
  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    const received = Buffer.from(signature, "base64");
    const computed = Buffer.from(expected, "base64");
    if (received.length !== computed.length || received.length === 0) {
      return false;
    }
    return timingSafeEqual(received, computed);
  } catch {
    return false;
  }
}
