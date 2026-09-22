import { describe, expect, test } from "bun:test";

import type { ApiOutputs } from "@convex/shared/api";

import { getTournamentDetailsBucket$ } from "./tournament-details-store";

type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];

function matchFixture(id: string) {
  return { id } as unknown as TournamentMatch;
}

describe("tournament details bucket", () => {
  test("keeps one bucket per tournament id", () => {
    expect(getTournamentDetailsBucket$("bucket-a")).toBe(
      getTournamentDetailsBucket$("bucket-a")
    );
    expect(getTournamentDetailsBucket$("bucket-a")).not.toBe(
      getTournamentDetailsBucket$("bucket-b")
    );
  });

  test("reset clears the data and bumps the version so hydration re-runs", () => {
    const bucket$ = getTournamentDetailsBucket$("reset-cycle");
    const versionBefore = bucket$.identity.resetVersion.get();

    bucket$.actions.hydrateMatches([matchFixture("m-1")]);
    bucket$.actions.setBootstrapStatus("ready");
    bucket$.actions.setEntriesLoading(true);
    bucket$.actions.setMatchesLoading(true);

    bucket$.actions.reset();

    expect(bucket$.data.matches.get()).toEqual([]);
    expect(String(bucket$.identity.bootstrapStatus)).toBe("loading");
    // Flag de carga preso em true = esqueleto eterno nos KPIs.
    expect(bucket$.identity.entriesLoading.get()).toBe(false);
    expect(bucket$.identity.matchesLoading.get()).toBe(false);
    expect(bucket$.identity.resetVersion.get()).toBe(versionBefore + 1);

    // Monotonica, nunca um binario que volta ao mesmo valor: e a mudanca
    // que um efeito de hidratacao dependente da versao precisa enxergar.
    bucket$.actions.reset();

    expect(bucket$.identity.resetVersion.get()).toBe(versionBefore + 2);
  });

  test("hydrating again after a reset restores the bucket", () => {
    const bucket$ = getTournamentDetailsBucket$("rehydrate-cycle");

    bucket$.actions.hydrateMatches([matchFixture("m-1")]);
    bucket$.actions.reset();
    bucket$.actions.hydrateMatches([matchFixture("m-2")]);

    expect(bucket$.data.matches.get().map((match) => match.id)).toEqual([
      "m-2",
    ]);
  });
});
