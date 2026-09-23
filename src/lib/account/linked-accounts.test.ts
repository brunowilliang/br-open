import { describe, expect, test } from "bun:test";

import {
  buildLinkedAccountRows,
  hasCredentialAccount,
  linkAccountVerified,
} from "./linked-accounts";
import {
  getSecurityErrorMessage,
  isSocialAuthCanceledError,
} from "./security-errors";

describe("hasCredentialAccount", () => {
  test("sem contas → sem e-mail e senha", () => {
    expect(hasCredentialAccount([])).toBe(false);
  });

  test("só contas sociais → sem e-mail e senha", () => {
    expect(
      hasCredentialAccount([
        { accountId: "a1", providerId: "apple" },
        { accountId: "g1", providerId: "google" },
      ])
    ).toBe(false);
  });

  test("com conta credential → tem e-mail e senha", () => {
    expect(
      hasCredentialAccount([
        { accountId: "g1", providerId: "google" },
        { accountId: "c1", providerId: "credential" },
      ])
    ).toBe(true);
  });
});

describe("buildLinkedAccountRows", () => {
  test("sempre retorna as 3 linhas na ordem fixa (credential, apple, google)", () => {
    expect(buildLinkedAccountRows([])).toEqual([
      { isLinked: false, provider: "credential" },
      { isLinked: false, provider: "apple" },
      { isLinked: false, provider: "google" },
    ]);
  });

  test("marca conectadas apenas as contas presentes na resposta", () => {
    expect(
      buildLinkedAccountRows([{ accountId: "g1", providerId: "google" }])
    ).toEqual([
      { isLinked: false, provider: "credential" },
      { isLinked: false, provider: "apple" },
      { isLinked: true, provider: "google" },
    ]);
  });

  test("todas conectadas", () => {
    expect(
      buildLinkedAccountRows([
        { accountId: "c1", providerId: "credential" },
        { accountId: "a1", providerId: "apple" },
        { accountId: "g1", providerId: "google" },
      ])
    ).toEqual([
      { isLinked: true, provider: "credential" },
      { isLinked: true, provider: "apple" },
      { isLinked: true, provider: "google" },
    ]);
  });

  test("ignora providers desconhecidos", () => {
    expect(
      buildLinkedAccountRows([
        { accountId: "c1", providerId: "credential" },
        { accountId: "gh1", providerId: "github" },
      ])
    ).toEqual([
      { isLinked: true, provider: "credential" },
      { isLinked: false, provider: "apple" },
      { isLinked: false, provider: "google" },
    ]);
  });
});

describe("linkAccountVerified", () => {
  test("sucesso só com o provider confirmado na lista fresca", async () => {
    const accounts = [{ accountId: "g1", providerId: "google" }];

    await expect(
      linkAccountVerified({
        link: async () => undefined,
        provider: "google",
        readAccounts: async () => accounts,
      })
    ).resolves.toEqual(accounts);
  });

  test("link resolvido sem o provider na lista não vira sucesso", async () => {
    await expect(
      linkAccountVerified({
        link: async () => undefined,
        provider: "google",
        readAccounts: async () => [{ accountId: "a1", providerId: "apple" }],
      })
    ).rejects.toThrow();
  });

  test("erro do provider sobe pro caller sem virar sucesso", async () => {
    const providerError = new Error("email_does_not_match");

    await expect(
      linkAccountVerified({
        link: () => Promise.reject(providerError),
        provider: "google",
        readAccounts: async () => [{ accountId: "g1", providerId: "google" }],
      })
    ).rejects.toBe(providerError);
  });

  test("cancelamento do browser sobe e o app silencia", async () => {
    const canceled = new Error("Authentication did not complete. Try again.");

    await expect(
      linkAccountVerified({
        link: () => Promise.reject(canceled),
        provider: "google",
        readAccounts: async () => [],
      })
    ).rejects.toBe(canceled);
    expect(isSocialAuthCanceledError(canceled)).toBe(true);
  });

  test("recusa do callback sobe com o code e vira a copy neutra", async () => {
    const refused = Object.assign(new Error("email_does_not_match"), {
      code: "email_does_not_match",
    });

    await expect(
      linkAccountVerified({
        link: () => Promise.reject(refused),
        provider: "google",
        readAccounts: async () => [],
      })
    ).rejects.toBe(refused);
    expect(getSecurityErrorMessage(refused, "fallback")).toBe(
      "Esse provedor usa um e-mail diferente do e-mail da sua conta. Entre com o mesmo e-mail para conectar."
    );
  });
});
