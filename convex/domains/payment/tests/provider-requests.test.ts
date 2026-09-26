import { afterEach, describe, expect, it } from "bun:test";

import {
  DEBIT_FEE_DESCRIPTION,
  DEBIT_RECOVERY_DESCRIPTION,
  buildChargeDeleteRequest,
  buildDebitRequest,
  buildWithdrawRequest,
  isAlreadyRefundedMessage,
  isProviderMissingMessage,
  providerErrorMessage,
  providerFetch,
  resolveRefundResponseOutcome,
  resolveWithdrawalProviderId,
} from "../provider-requests";
import { resolveRefundOutcome } from "../rules";

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

    it("leva a descricao do debito: taxa por padrao, recolhimento do estorno quando pedido (BUG-0084)", () => {
      expect(
        buildDebitRequest("org@email.com", 350, DEBIT_RECOVERY_DESCRIPTION).body
      ).toEqual({ description: DEBIT_RECOVERY_DESCRIPTION, value: 350 });
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

  describe("isAlreadyRefundedMessage (BUG-0082)", () => {
    it("recognizes the provider's already-refunded message in any spelling", () => {
      expect(
        isAlreadyRefundedMessage(
          "Você já reembolsou todo o valor desta cobrança"
        )
      ).toBe(true);
      expect(
        isAlreadyRefundedMessage(
          "Voce ja reembolsou todo o valor desta cobranca"
        )
      ).toBe(true);
      expect(
        isAlreadyRefundedMessage(
          "VOCÊ JÁ REEMBOLSOU TODO O VALOR DESTA COBRANÇA!"
        )
      ).toBe(true);
      expect(
        isAlreadyRefundedMessage(
          "Erro: você já reembolsou todo o valor desta cobrança."
        )
      ).toBe(true);
    });

    it("never mistakes a refusal or another error for a done refund", () => {
      expect(isAlreadyRefundedMessage("O valor não foi reembolsado")).toBe(
        false
      );
      expect(
        isAlreadyRefundedMessage(
          "Não foi possível reembolsar todo o valor desta cobrança."
        )
      ).toBe(false);
      expect(isAlreadyRefundedMessage("Cobrança não encontrada")).toBe(false);
      expect(isAlreadyRefundedMessage("Saldo insuficiente na subconta.")).toBe(
        false
      );
      expect(isAlreadyRefundedMessage(null)).toBe(false);
      expect(isAlreadyRefundedMessage("")).toBe(false);
    });
  });

  describe("resolveRefundResponseOutcome (BUG-0082)", () => {
    it("relays the provider refund status on a 2xx", () => {
      expect(
        resolveRefundResponseOutcome({ ok: true, providerStatus: "CONFIRMED" })
      ).toEqual({ status: "CONFIRMED" });
      expect(
        resolveRefundResponseOutcome({ ok: true, providerStatus: null })
      ).toEqual({ status: "IN_PROCESSING" });
    });

    it("reads the retry rejection as a DONE refund, not as a failure", () => {
      const outcome = resolveRefundResponseOutcome({
        errorMessage: "Você já reembolsou todo o valor desta cobrança",
        ok: false,
      });
      expect(outcome).toEqual({ status: "CONFIRMED" });
      expect("status" in outcome && resolveRefundOutcome(outcome.status)).toBe(
        "refunded"
      );
    });

    it("keeps every other provider error for the caller to log", () => {
      expect(
        resolveRefundResponseOutcome({
          errorMessage: "Cobrança não encontrada",
          ok: false,
        })
      ).toEqual({ error: "Cobrança não encontrada" });
      expect(resolveRefundResponseOutcome({ ok: false })).toEqual({
        error: "Estorno recusado pelo provedor.",
      });
      expect(resolveRefundOutcome("REJECTED")).toBe("failed");
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
