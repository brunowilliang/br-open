import { describe, expect, test } from "bun:test";

import type { ApiOutputs } from "@convex/shared/api";

import { getTournamentDetailsBucket$ } from "./tournament-details-store";

type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];
type TournamentDiscovery = ApiOutputs["tournament"]["discovery"]["getById"];

function matchFixture(id: string) {
  return { id } as unknown as TournamentMatch;
}

function discoveryFixture(id: string) {
  return {
    categories: [],
    id,
    isTournamentOrganizer: false,
    viewerEntryIds: [],
  } as unknown as TournamentDiscovery;
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

  test("screenState só libera com ator armado E payload do ator vigente", () => {
    const bucket$ = getTournamentDetailsBucket$("screen-state");

    expect(bucket$.derived.screenState.get()).toBe("loading");

    bucket$.actions.setActorKey({ actorKey: "player:p-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-1"), 100);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.derived.screenState.get()).toBe("ready");

    // Payload velho demais em relação ao piso: tela segue em loading.
    bucket$.actions.setActorKey({ actorKey: "organization:o-1" });

    expect(bucket$.data.tournament.get()).toBeNull();
    expect(bucket$.derived.screenState.get()).toBe("loading");

    // Hidratação com o dado do ator ANTERIOR (stamp igual ao piso) + status
    // ready: o piso é quem barra, não o status.
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-1"), 100);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.derived.screenState.get()).toBe("loading");

    bucket$.actions.hydrateDiscovery(discoveryFixture("t-1"), 101);

    expect(bucket$.derived.screenState.get()).toBe("ready");
  });

  test("troca de ator com o push novo JÁ na mão não prende a tela em loading", () => {
    // Sequência do layout num switch com o detalhe montado: as duas
    // subscriptions voltam na MESMA transição, então o render do switch já traz
    // `dataUpdatedAt` do ator NOVO (200). O piso não pode ser armado com esse
    // carimbo — o payload hidratado no mesmo commit tem exatamente ele.
    const bucket$ = getTournamentDetailsBucket$("actor-switch-wedge");

    bucket$.actions.setActorKey({ actorKey: "player:p-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-3"), 100);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.derived.screenState.get()).toBe("ready");

    bucket$.actions.setActorKey({ actorKey: "organization:o-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-3"), 200);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.derived.screenState.get()).toBe("ready");
  });

  test("setActorKey com a MESMA chave não zera o payload", () => {
    const bucket$ = getTournamentDetailsBucket$("actor-same-key");

    bucket$.actions.setActorKey({ actorKey: "player:p-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-4"), 100);
    bucket$.actions.setBootstrapStatus("ready");

    // Re-arma com a mesma chave (o efeito roda a cada push): payload intacto.
    bucket$.actions.setActorKey({ actorKey: "player:p-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-4"), 300);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.data.tournament.get()?.id).toBe("t-4");
    expect(bucket$.identity.actorSwitchAt.get()).toBe(0);
    expect(bucket$.derived.screenState.get()).toBe("ready");
  });

  test("reset mantém o ator armado: re-mount com outro ator ainda detecta a troca", () => {
    const bucket$ = getTournamentDetailsBucket$("actor-survives-reset");

    bucket$.actions.setActorKey({ actorKey: "player:p-1" });
    bucket$.actions.hydrateDiscovery(discoveryFixture("t-2"), 50);
    bucket$.actions.setBootstrapStatus("ready");
    bucket$.actions.reset();

    expect(bucket$.identity.actorKey.get()).toBe("player:p-1");
    // A marca d'água do payload sobrevive ao reset: é ela que denuncia o dado
    // do ator anterior num re-mount.
    expect(bucket$.identity.payloadUpdatedAt.get()).toBe(50);
    expect(bucket$.derived.screenState.get()).toBe("loading");

    bucket$.actions.setActorKey({ actorKey: "player:p-2" });

    expect(bucket$.identity.actorSwitchAt.get()).toBe(50);
    expect(bucket$.derived.screenState.get()).toBe("loading");

    bucket$.actions.hydrateDiscovery(discoveryFixture("t-2"), 90);
    bucket$.actions.setBootstrapStatus("ready");

    expect(bucket$.derived.screenState.get()).toBe("ready");
  });
});
