/**
 * Abacate Pay v2 client built on the official low-level REST client
 * (`@abacatepay/rest`) and the official types (`@abacatepay/types/v2`).
 *
 * Why not `@abacatepay/sdk`? Its published tarball is missing
 * `dist/index.d.ts` and its `./v1` / `./v2` subpath exports point to
 * non-existent files, so every import degrades to `any`. The REST client +
 * types pair ships correct typings and uses only the global `fetch`
 * (Convex-safe — no `node:crypto` / `Buffer`).
 *
 * Why manual webhook verification (see `webhook-signature.ts`)? The helper
 * in `@abacatepay/types` (`verifyWebhookSignature`) uses `node:crypto` +
 * `Buffer`, which are unavailable in Convex V8 isolates. The Web Crypto
 * reimplementation in `webhook-signature.ts` is the correct one for this
 * environment.
 *
 * @see https://docs.abacatepay.com/pages/ecosystem/rest
 */

import { AbacatePayError, REST } from "@abacatepay/rest";
import type {
  APIQRCodePIX,
  RESTGetCheckQRCodePixStatusData,
  RESTPostCreateQRCodePixBody,
} from "@abacatepay/types/v2";
import { Routes } from "@abacatepay/types/v2";
import { getEnv } from "../../lib/get-env";

export { AbacatePayError };

// ---------------------------------------------------------------------------
// Client — single instance, reads the API key from env at module load.
// ---------------------------------------------------------------------------

const client = new REST({
  secret: getEnv().ABACATEPAY_API_KEY,
  version: 2,
});

// ---------------------------------------------------------------------------
// Public API — uses official types and route constants, nothing invented.
// ---------------------------------------------------------------------------

/**
 * Creates a transparent PIX charge.
 *
 * The body must be wrapped as `{ method: "PIX", data: {...} }` per the v2
 * endpoint contract — see https://docs.abacatepay.com/pages/transparents/create.
 */
export function createTransparentPixCharge(
  data: RESTPostCreateQRCodePixBody
): Promise<APIQRCodePIX> {
  return client.post<APIQRCodePIX>(Routes.transparents.createQRCode, {
    body: { data, method: "PIX" },
  });
}

/**
 * Simulates the payment of a transparent PIX charge.
 *
 * Dev-mode only on AbacatePay's side (key created in Dev mode). After this
 * call the charge is `PAID` on AbacatePay's side too, keeping both systems
 * consistent (fixes the previous divergence where the local row was `PAID`
 * but AbacatePay showed `Expirado`).
 *
 * `Routes.transparents.simulatePayment(id)` already embeds `?id=` in the URL,
 * so no query param is passed separately.
 *
 * @see https://docs.abacatepay.com/pages/transparents/simulate-payment
 */
export function simulateTransparentPixCharge(
  providerChargeId: string
): Promise<APIQRCodePIX> {
  return client.post<APIQRCodePIX>(
    Routes.transparents.simulatePayment(providerChargeId)
  );
}

/**
 * Checks the status of a transparent PIX charge.
 *
 * @see https://docs.abacatepay.com/pages/transparents/check
 */
export function checkTransparentChargeStatus(
  chargeId: string
): Promise<RESTGetCheckQRCodePixStatusData> {
  return client.get<RESTGetCheckQRCodePixStatusData>(
    Routes.transparents.checkStatus(chargeId)
  );
}
