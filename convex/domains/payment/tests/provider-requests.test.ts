import { afterEach, describe, expect, it } from "bun:test";

import {
  DEBIT_FEE_DESCRIPTION,
  buildDebitRequest,
  buildWithdrawRequest,
  providerFetch,
  resolveWithdrawalProviderId,
} from "../provider-requests";

describe("provider requests (Woovi withdraw/debit)", () => {
  describe("resolveWithdrawalProviderId", () => {
    it("prefers correlationID when both ids are present", () => {
      expect(
        resolveWithdrawalProviderId({
          correlationID: "corr-1",
          endToEndId: "e2e-1",
        })
      ).toBe("corr-1");
    });

    it("falls back to endToEndId when correlationID is absent", () => {
      expect(resolveWithdrawalProviderId({ endToEndId: "e2e-1" })).toBe(
        "e2e-1"
      );
    });

    it("returns null when neither id is present", () => {
      expect(resolveWithdrawalProviderId({})).toBeNull();
    });
  });

  describe("buildWithdrawRequest", () => {
    it("uses the pix key registered on the subaccount as the path param", () => {
      expect(buildWithdrawRequest("org@email.com", 15_000).path).toBe(
        "/api/v1/subaccount/org%40email.com/withdraw"
      );
    });

    it("sends exactly the passed (liquid) value in cents", () => {
      expect(buildWithdrawRequest("org@email.com", 14_500).body).toEqual({
        value: 14_500,
      });
    });
  });

  describe("buildDebitRequest", () => {
    it("debits from the subaccount to the main account (BR-Open)", () => {
      expect(buildDebitRequest("org@email.com", 500).path).toBe(
        "/api/v1/subaccount/org%40email.com/debit"
      );
      expect(buildDebitRequest("org@email.com", 500).body).toEqual({
        description: DEBIT_FEE_DESCRIPTION,
        value: 500,
      });
    });
  });

  describe("providerFetch (BUG-0007)", () => {
    // bun-types requires `fetch.preconnect`; a plain async fn doesn't
    // satisfy `typeof fetch`, so the partial mocks cast via unknown.
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });
    it("returns the response on success", async () => {
      const response = new Response("{}", { status: 200 });
      globalThis.fetch = (async () => response) as unknown as typeof fetch;
      await expect(providerFetch("https://provider.test/api")).resolves.toBe(
        response
      );
    });

    it("surfaces a legible pt-BR error on timeout", async () => {
      globalThis.fetch = (() => {
        const error = new Error("signal timed out");
        error.name = "TimeoutError";
        return Promise.reject(error);
      }) as unknown as typeof fetch;
      await expect(
        providerFetch("https://provider.test/api", {}, 20_000)
      ).rejects.toThrow(
        "Provedor de pagamento não respondeu em 20s (timeout)."
      );
    });

    it("rethrows non-timeout network errors untouched", async () => {
      globalThis.fetch = (() =>
        Promise.reject(
          new TypeError("fetch failed")
        )) as unknown as typeof fetch;
      await expect(providerFetch("https://provider.test/api")).rejects.toThrow(
        "fetch failed"
      );
    });
  });
});
