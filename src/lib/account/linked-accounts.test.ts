import { describe, expect, test } from "bun:test";

import {
  buildLinkedAccountRows,
  hasCredentialAccount,
} from "./linked-accounts";

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
