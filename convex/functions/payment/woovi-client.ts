import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "../../lib/get-env";

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

export type WooviSubaccount = {
  /** The PIX key supplied at creation — it IS the split recipient identifier. */
  pixKey: string;
  name: string;
};

export type WooviCharge = {
  correlationId: string;
  status: string; // "ACTIVE" | "COMPLETED" | "EXPIRED"
  brCode: string; // "copia e cola"
  qrCodeImage: string; // base64 PNG data URL
  paymentLinkUrl: string; // checkout URL
  value: number;
};

function wooviConfig(): { appId: string; baseUrl: string } {
  const { WOOVI_APP_ID, WOOVI_BASE_URL } = getEnv();
  if (!WOOVI_APP_ID) {
    throw new Error("WOOVI_APP_ID must be configured");
  }
  return {
    appId: WOOVI_APP_ID,
    baseUrl: WOOVI_BASE_URL ?? "https://api.woovi-sandbox.com",
  };
}

function wooviHeaders(appId: string): HeadersInit {
  return {
    // App ID verbatim — NO "Bearer"/"Basic" prefix.
    Authorization: appId,
    "Content-Type": "application/json",
  };
}

/**
 * Creates a Woovi subaccount for an organization. The subaccount is created
 * synchronously and is usable immediately — Woovi does NOT run async KYC for
 * subaccounts. The `pixKey` supplied here IS the split recipient identifier.
 *
 * Reference: github.com/woovibr/woovi-prompts `subaccount.md`.
 */
export async function createSubaccount(args: {
  name: string;
  pixKey: string;
}): Promise<WooviSubaccount> {
  const { appId, baseUrl } = wooviConfig();
  const res = await fetch(`${baseUrl}/api/v1/subaccount`, {
    method: "POST",
    headers: wooviHeaders(appId),
    body: JSON.stringify({
      name: args.name,
      pixKey: args.pixKey,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Woovi createSubaccount failed: ${res.status} ${await res.text()}`
    );
  }
  const json = (await res.json()) as {
    subAccount?: { pixKey?: string; name?: string };
  };
  const sub = json.subAccount ?? {};
  return {
    pixKey: sub.pixKey ?? args.pixKey,
    name: sub.name ?? args.name,
  };
}

/**
 * Creates a PIX charge split between the organization (subaccount) and
 * BR-Open (platform fee). The split sends ONE entry — the organizer's share
 * — to their `pixKey`; BR-Open keeps the remainder of the charge as its fee
 * automatically (do NOT declare a platform split entry).
 *
 * Reference: github.com/woovibr/woovi-prompts `charge-pix.md` + `subaccount.md`.
 */
export async function createChargeWithSplit(args: {
  correlationId: string;
  amountCents: number;
  comment: string;
  recipientPixKey: string;
  organizerCents: number;
  expiresInSeconds: number;
}): Promise<WooviCharge> {
  const { appId, baseUrl } = wooviConfig();
  const res = await fetch(`${baseUrl}/api/v1/charge`, {
    method: "POST",
    headers: wooviHeaders(appId),
    body: JSON.stringify({
      correlationID: args.correlationId,
      value: args.amountCents,
      // Woovi rejects non-ASCII punctuation (em-dash counts as "emoji").
      // Caller is responsible for passing an ASCII-safe comment.
      comment: args.comment,
      expiresIn: args.expiresInSeconds,
      splits: [
        {
          pixKey: args.recipientPixKey,
          value: args.organizerCents,
          splitType: "SPLIT_SUB_ACCOUNT",
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Woovi createCharge failed: ${res.status} ${await res.text()}`
    );
  }
  const json = (await res.json()) as {
    charge?: {
      correlationID?: string;
      status?: string;
      brCode?: string;
      qrCodeImage?: string;
      paymentLinkUrl?: string;
      value?: number;
    };
  };
  const charge = json.charge ?? {};
  return {
    correlationId: charge.correlationID ?? args.correlationId,
    status: charge.status ?? "ACTIVE",
    brCode: charge.brCode ?? "",
    qrCodeImage: charge.qrCodeImage ?? "",
    paymentLinkUrl: charge.paymentLinkUrl ?? "",
    value: charge.value ?? args.amountCents,
  };
}

/**
 * Fetches a charge by its correlationID. Used by a reconcile poller, not the
 * happy path (the webhook is the source of truth).
 */
export async function getCharge(correlationId: string): Promise<{
  status: string;
  value: number;
  paidAt: string | null;
}> {
  const { appId, baseUrl } = wooviConfig();
  const res = await fetch(`${baseUrl}/api/v1/charge/${correlationId}`, {
    headers: wooviHeaders(appId),
  });
  if (!res.ok) {
    throw new Error(
      `Woovi getCharge failed: ${res.status} ${await res.text()}`
    );
  }
  const json = (await res.json()) as {
    charge?: { status?: string; value?: number; paidAt?: string };
  };
  const charge = json.charge ?? {};
  return {
    status: charge.status ?? "UNKNOWN",
    value: charge.value ?? 0,
    paidAt: charge.paidAt ?? null,
  };
}
