import { afterEach, describe, expect, it } from "bun:test";

import {
  DEBIT_FEE_DESCRIPTION,
  buildChargeDeleteRequest,
  buildDebitRequest,
  buildWithdrawRequest,
  isProviderMissingMessage,
  providerErrorMessage,
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

  describe("buildChargeDeleteRequest", () => {
    it("deletes by correlationID, not by the provider transaction id", () => {
      // Provado no sandbox (26/09/2026): `DELETE /charge/{transactionID}` responde
      // 400 "Cobrança não encontrada"; o endereço que funciona é o NOSSO
      // correlationID.
      expect(
        buildChargeDeleteRequest("bropen:tournament_entry:entry-1:123").path
      ).toBe("/api/v1/charge/bropen%3Atournament_entry%3Aentry-1%3A123");
      expect(buildChargeDeleteRequest("corr-1").body).toBeNull();
    });
  });

  describe("providerErrorMessage", () => {
    // Corpos reais capturados do sandbox da Woovi.
    it("reads the DELETE 400 body (nested error.message)", () => {
      expect(
        providerErrorMessage({
          charge: null,
          error: { data: "corr-1", message: "Cobrança não encontrada" },
          status: "ERROR",
        })
      ).toBe("Cobrança não encontrada");
    });

    it("reads the GET 400 body (error as a plain string)", () => {
      expect(providerErrorMessage({ error: "Cobrança não encontrada" })).toBe(
        "Cobrança não encontrada"
      );
    });

    it("falls back to the top-level message and gives up on unknown shapes", () => {
      expect(providerErrorMessage({ message: "sem permissão" })).toBe(
        "sem permissão"
      );
      expect(providerErrorMessage(null)).toBeNull();
      expect(providerErrorMessage({ error: { code: "X" } })).toBeNull();
    });
  });

  describe("isProviderMissingMessage", () => {
    it("recognizes the provider's not-found message in both spellings", () => {
      expect(isProviderMissingMessage("Cobrança não encontrada")).toBe(true);
      expect(isProviderMissingMessage("Cobranca nao encontrada")).toBe(true);
    });

    it("does not treat other provider errors as not-found", () => {
      expect(isProviderMissingMessage("Saldo insuficiente na subconta.")).toBe(
        false
      );
      expect(isProviderMissingMessage(null)).toBe(false);
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
