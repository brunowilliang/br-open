import { describe, expect, it } from "bun:test";

import {
  getLeagueFormBucket$,
  getEditLeagueFormSessionKey,
  leagueFormStore$,
} from "./league-form-store";

describe("league form store", () => {
  it("shows delete by default while editing a league", () => {
    const bucket$ = getLeagueFormBucket$("test:edit-delete-default");

    bucket$.actions.configure({
      mode: "edit",
      title: "Editar Liga",
    });

    expect(bucket$.identity.showDelete.get()).toBe(true);
  });

  it("keeps delete hidden while creating a league", () => {
    const bucket$ = getLeagueFormBucket$("test:create-delete-default");

    bucket$.actions.configure({
      mode: "create",
      showDelete: true,
      title: "Criar Liga",
    });

    expect(bucket$.identity.showDelete.get()).toBe(false);
  });

  it("marks the configured edit bucket as the active form session", () => {
    const sessionKey = getEditLeagueFormSessionKey("league-test");
    const bucket$ = getLeagueFormBucket$(sessionKey);

    bucket$.actions.configure({
      mode: "edit",
      title: "Editar Liga",
    });

    expect(leagueFormStore$.activeSessionKey.get()).toBe(sessionKey);
  });
});
