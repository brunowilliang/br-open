/**
 * Woovi (OpenPix) webhook signature verification, Convex-safe.
 *
 * Woovi signs the raw webhook body with RSA-SHA256 using their PRIVATE key
 * and sends the base64 signature in the `x-webhook-signature` header. We
 * verify it with Woovi's PUBLIC key (fixed, same for all merchants — sourced
 * from @woovi/node-sdk `WH_PUBLIC_KEY`).
 *
 * This is the RECOMMENDED method per developers.woovi.com
 * (webhook-signature-validation). It requires no per-merchant secret — the
 * signature proves the request came from Woovi.
 *
 * Uses the Web Crypto API (`crypto.subtle`) because Convex runs in a V8
 * isolate where `node:crypto` (`createVerify`, `Buffer`) is unavailable.
 */

/**
 * Woovi's public RSA key (SPKI, base64 of the PEM). Same for every merchant.
 * Source: @woovi/node-sdk `utils/constants` `WH_PUBLIC_KEY`.
 */
const WOOVI_PUBLIC_KEY_BASE64 =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FDLytOdElranpldnZxRCtJM01NdjNiTFhEdApwdnhCalk0QnNSclNkY2EzcnRBd01jUllZdnhTbmQ3amFnVkxwY3RNaU94UU84aWVVQ0tMU1dIcHNNQWpPL3paCldNS2Jxb0c4TU5waS91M2ZwNnp6MG1jSENPU3FZc1BVVUcxOWJ1VzhiaXM1WloySVpnQk9iV1NwVHZKMGNuajYKSEtCQUE4MkpsbitsR3dTMU13SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";

/** Strip the PEM headers/footers and return the DER/SPKI base64 body. */
function pemToSpkiBase64(pemBase64: string): string {
  const pem = atob(pemBase64);
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
}

/** Decode a base64 string into a fresh ArrayBuffer-backed Uint8Array. */
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedKey: CryptoKey | null = null;

async function getWooviPublicKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }
  const spkiBase64 = pemToSpkiBase64(WOOVI_PUBLIC_KEY_BASE64);
  const spkiBytes = base64ToBytes(spkiBase64);
  cachedKey = await crypto.subtle.importKey(
    "spki",
    spkiBytes.buffer as ArrayBuffer,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"]
  );
  return cachedKey;
}

/**
 * Verifies an inbound Woovi webhook signature (RSA-SHA256).
 *
 * @param rawBody   The exact bytes received (use `c.req.text()`).
 * @param signature The value of the `x-webhook-signature` header (base64).
 * @returns true when the signature was produced by Woovi's private key.
 */
export async function verifyWooviWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }
  try {
    const key = await getWooviPublicKey();
    const signatureBytes = base64ToBytes(signature);
    const dataBytes = new TextEncoder().encode(rawBody);
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureBytes.buffer as ArrayBuffer,
      dataBytes.buffer as ArrayBuffer
    );
  } catch {
    return false;
  }
}
