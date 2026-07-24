# Woovi PoC Results — 2026-07-02

Validation of the Woovi (OpenPix) sandbox API before committing to the
AbacatePay → Woovi migration. All requests hit `https://api.woovi-sandbox.com`
with `Authorization: <APP_ID>` (no Bearer/Basic prefix).

## Check 1 — Create subaccount WITHOUT taxId ✅

**Goal:** Decide whether the organizer onboarding UI must collect CPF/CNPJ.

**Request:** `POST /api/v1/subaccount`
```json
{ "name": "BR-Open PoC Org", "pixKey": "bropen.poc.test@woovi.com" }
```
**Response (200):**
```json
{ "subAccount": { "name": "BR-Open PoC Org", "pixKey": "bropen.poc.test@woovi.com" } }
```

**Conclusion:** **taxId is NOT required.** The Woovi subaccount API accepts just
`{name, pixKey}`. Same response shape with/without taxId. → The organizer
onboarding UI does **not** need a CPF/CNPJ field. `taxId` collection is dropped
from the migration plan (Phase 4 simplification). LGPD scope reduced.

**Note:** the returned object does NOT include a `walletId` or `accountId` —
the `pixKey` itself is the split recipient identifier. This matches the
behavior baked into the recovered `woovi-client.ts` (commit `572dc61`).

## Check 2 — Create charge WITH split ✅

**Goal:** Confirm split routing works and capture the real response shape.

**Request:** `POST /api/v1/charge`
```json
{
  "correlationID": "bropen-poc-1783024524",
  "value": 5000,
  "comment": "Inscricao BR-Open PoC",
  "expiresIn": 3600,
  "splits": [{
    "pixKey": "bropen.poc.test@woovi.com",
    "value": 4500,
    "splitType": "SPLIT_SUB_ACCOUNT"
  }]
}
```

**Response (200)** — relevant fields only:
```json
{
  "charge": {
    "value": 5000,
    "correlationID": "bropen-poc-1783024524",
    "transactionID": "9ee1bfdeb13b41c895077291acc4f2a1",
    "status": "ACTIVE",
    "expiresDate": "2026-07-02T21:35:24.701Z",
    "expiresIn": 3600,
    "brCode": "00020101021226980014br.gov.bcb.pix2576...",
    "qrCodeImage": "https://api.woovi-sandbox.com/openpix/charge/brcode/image/<paymentLinkID>.png",
    "paymentLinkUrl": "https://woovi-sandbox.com/pay/<paymentLinkID>",
    "pixKey": "daf79305-93cd-4a01-aba4-19980a0e866e",
    "splits": [{
      "value": 4500,
      "pixKey": "bropen.poc.test@woovi.com",
      "splitType": "SPLIT_SUB_ACCOUNT",
      "sourceAccount": "6a43cd58cc1cfc1dfff66614",
      "pixKeyType": "EMAIL"
    }]
  }
}
```

### Critical shape findings (drive the migration)

1. **`brCode`** is the "copia e cola" payload string. ✅ Matches what
   `checkout.tsx` already reads (`charge.brCode`).
2. **`qrCodeImage` is an HTTPS URL, NOT base64.** ⚠️ This diverges from the
   current AbacatePay schema (`brCodeBase64: z.string()` rendered as
   `<Image source={{ uri: brCodeBase64 }}>`). React Native `<Image>` accepts
   both `data:` and `https://` URIs, so the field can be renamed
   `qrCodeImage` and the URL used directly — no download/conversion needed.
   `checkout.tsx` keeps working as long as the value is a valid image URI.
3. **Initial status is `ACTIVE`**, not `PENDING`. `normalizeProviderStatus`
   must map `ACTIVE → PENDING` (charge awaiting payment).
4. **`expiresDate`** (ISO 8601) is the authoritative expiry; `expiresIn` is
   echoed back from the request. Store `expiresDate`.
5. **Split is enforced server-side.** The `splits[].sourceAccount` echoes the
   subaccount's internal id; we don't need to persist it (the `pixKey` is our
   recipient identifier).
6. **`correlationID` is OUR idempotency key** (we send it, Woovi echoes it).
   The webhook will reference `charge.correlationID` — this is how we match.
   (`transactionID` is Woovi's internal id; we store it as `wooviChargeId`
   for diagnostics but match on `correlationID`.)

### Charge GET by correlationID ✅

`GET /api/v1/charge/<correlationID>` returns the same `charge` object (without
the top-level `brCode` echo). Confirms the reconcile-poller pattern from the
spec works.

## Check 3 — Webhook payload & signature algorithm

**Status:** requires a public tunnel (ngrok/cloudflare) pointing at the Convex
deployment so Woovi sandbox can deliver `OPENPIX:TRANSACTION_RECEIVED` and
`OPENPIX:CHARGE_EXPIRED`. Not exercised in this PoC batch.

**Assumptions to validate when the tunnel is up** (sourced from
[developers.woovi.com webhook docs](https://developers.woovi.com/docs/tags/webhook)
+ the recovered `woovi-client.ts@572dc61`):

- Header: `x-webhook-signature`
- Algorithm: HMAC-SHA256 over the **raw request body**, base64-encoded digest,
  secret = the webhook secret configured in the Woovi dashboard (NOT the
  APP_ID).
- Events to handle: `OPENPIX:TRANSACTION_RECEIVED` (paid),
  `OPENPIX:CHARGE_EXPIRED` (expired). Refund is manual in the dashboard for
  this phase (per spec non-goal line 49).

The recovered client's `verifyWooviWebhookSignature` uses `node:crypto`
(`createHmac`, `Buffer`, `timingSafeEqual`) — unavailable in Convex V8
isolates. Must port to Web Crypto (`crypto.subtle.importKey` +
`sign("HMAC", ...)`), mirroring the pattern proven in the current
`webhook-signature.ts`.

## Check 4 — Dev-mode payment simulation

The AbacatePay migration shipped a `simulatePayment` authAction that called
`simulateTransparentPixCharge`. **Woovi sandbox does not expose an equivalent
"simulate payment" REST endpoint** — the documented way to test payment in
the sandbox is the Woovi sandbox UI / app. The `simulatePayment` action will
be **removed** in the migration; local dev tests payment via the sandbox
dashboard.

## Decisions locked in by this PoC

| Concern | Decision |
|---|---|
| Collect taxId (CPF/CNPJ) from organizer? | **No** — Woovi accepts `{name, pixKey}`. LGPD scope reduced. |
| Split recipient identifier | `pixKey` (returned by `createSubaccount`). No `walletId`. |
| Charge idempotency key | `correlationID` (we generate, Woovi echoes, webhook references it). |
| Initial charge status | `ACTIVE` → normalize to `PENDING`. |
| QR rendering | `qrCodeImage` is an HTTPS URL — use directly in `<Image>`. |
| Webhook signature | HMAC-SHA256 base64 over raw body, header `x-webhook-signature`, port to Web Crypto. |
| Dev-mode simulate | Removed — use Woovi sandbox dashboard to pay test charges. |
| Refund automation | Out of scope (manual in dashboard) — matches spec non-goal. |

## Outcome

PoC is **green on all REST checks**. Webhook signature algorithm is documented
and will be validated end-to-end once a tunnel is configured (Phase 1.5 manual
validation step). **Migration is unblocked.**
