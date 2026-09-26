import { observable } from "@legendapp/state";
import type { ApiOutputs } from "@convex/shared/api";
import type { PendingItem } from "@convex/domains/pendings/contract";

import { resolvePendingsForTournament } from "@/lib/pendings/pendings-view";

import {
  buildTournamentDetailsAccess,
  buildTournamentDetailsRole,
  buildTournamentDetailsScreenState,
  buildTournamentNavigationTabItems,
  isBracketPublic,
  type TournamentDetailsAccess,
  type TournamentDetailsRole,
} from "./tournament-details-derived";
import { buildTournamentRulesView } from "./tournament-rules-derived";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";

type TournamentDiscovery = ApiOutputs["tournament"]["discovery"]["getById"];
type TournamentMatch =
  ApiOutputs["tournament"]["matches"]["listForTournament"][number];

export type TournamentDetailsRoute =
  | "bracket"
  | "entries"
  | "index"
  | "rules"
  | "schedule";

export type TournamentPendingsStatus = "error" | "idle" | "loading" | "ready";

type TournamentDetailsBucket = ReturnType<typeof createTournamentDetailsBucket>;

const tournamentDetailsBuckets = new Map<string, TournamentDetailsBucket>();

function createTournamentDetailsBucket(tournamentId: string) {
  const bucket$ = observable({
    actions: {
      hydrateDiscovery: (discovery: TournamentDiscovery, updatedAt: number) => {
        bucket$.data.tournament.set(discovery);
        // Marca d'água monotônica do payload: nunca anda para trás (um push
        // velho re-hidratado não pode baixar o piso do ator).
        bucket$.identity.payloadUpdatedAt.set(
          Math.max(bucket$.identity.payloadUpdatedAt.get(), updatedAt)
        );
      },
      hydrateEntries: (entries: TournamentEntryWithPlayers[]) => {
        bucket$.data.entries.set(entries);
      },
      hydrateMatches: (matches: TournamentMatch[]) => {
        bucket$.data.matches.set(matches);
      },
      /** O outro escopo volta vazio: o layout mescla e a tela recorta. */
      hydratePendings: (input: {
        items: PendingItem[];
        status: TournamentPendingsStatus;
      }) => {
        bucket$.data.pendings.set(input.items);
        bucket$.identity.pendingsStatus.set(input.status);
      },
      hydrateViewer: (playerProfileId: null | string) => {
        bucket$.viewer.playerProfileId.set(playerProfileId);
      },
      // Incrementa identity.resetVersion: é a dependência dos efeitos que
      // re-hidratam — um reset com valor fixo deixava o bucket vazio. A marca
      // d'água do payload (`payloadUpdatedAt`) NÃO é zerada: é ela que num
      // re-mount com outro ator denuncia o payload do ator anterior.
      reset: () => {
        bucket$.data.tournament.set(null);
        bucket$.data.entries.set([]);
        bucket$.data.matches.set([]);
        bucket$.data.pendings.set([]);
        bucket$.viewer.playerProfileId.set(null);
        bucket$.identity.bootstrapStatus.set("loading");
        bucket$.identity.entriesLoading.set(false);
        bucket$.identity.matchesLoading.set(false);
        bucket$.identity.pendingsStatus.set("idle");
        bucket$.identity.resetVersion.set(
          bucket$.identity.resetVersion.get() + 1
        );
        bucket$.identity.activeRoute.set("index");
      },
      setActiveRoute: (route: TournamentDetailsRoute) => {
        bucket$.identity.activeRoute.set(route);
      },
      /**
       * Amarra o bucket ao ator ATIVO (o MODO decide a superfície). Trocar de
       * ator invalida o payload: o do cache TanStack é do ator anterior, então o
       * piso de geração sobe e só um dado hidratado DEPOIS da troca libera a
       * tela. O piso sai da marca d'água do PRÓPRIO bucket (o carimbo do último
       * payload hidratado), nunca do carimbo da query: num switch com o detalhe
       * montado as duas subscriptions voltam na mesma transição e o carimbo da
       * query já é o do ator novo — usá-lo armava o piso no mesmo valor que a
       * hidratação seguinte gravaria, e a tela ficava em loading para sempre.
       * Chave e piso sobrevivem ao `reset` — é assim que um re-mount com outro
       * ator ainda sabe que trocou.
       */
      setActorKey: (input: { actorKey: string }) => {
        const previousActorKey = bucket$.identity.actorKey.get();

        if (previousActorKey === input.actorKey) {
          return;
        }

        bucket$.identity.actorKey.set(input.actorKey);

        if (previousActorKey === null) {
          return;
        }

        bucket$.data.tournament.set(null);
        bucket$.identity.bootstrapStatus.set("loading");
        bucket$.identity.actorSwitchAt.set(
          Math.max(
            bucket$.identity.actorSwitchAt.get(),
            bucket$.identity.payloadUpdatedAt.get()
          )
        );
      },
      setBootstrapStatus: (status: "error" | "loading" | "ready") => {
        bucket$.identity.bootstrapStatus.set(status);
      },
      setEntriesLoading: (isLoading: boolean) => {
        bucket$.identity.entriesLoading.set(isLoading);
      },
      setMatchesLoading: (isLoading: boolean) => {
        bucket$.identity.matchesLoading.set(isLoading);
      },
    },
    data: {
      entries: [] as TournamentEntryWithPlayers[],
      matches: [] as TournamentMatch[],
      /** Itens de pendings.list, escopos player + organization. */
      pendings: [] as PendingItem[],
      tournament: null as TournamentDiscovery | null,
    },
    derived: {
      access: () => {
        const tournament = bucket$.data.tournament.get();

        if (!tournament) {
          return null;
        }

        const role = buildTournamentDetailsRole({
          isTournamentOrganizer: tournament.isTournamentOrganizer,
          viewerEntryIds: tournament.viewerEntryIds,
        });

        return {
          ...buildTournamentDetailsAccess({
            role,
            status: tournament.status,
          }),
          role,
        };
      },
      categoriesById: () => {
        const tournament = bucket$.data.tournament.get();

        if (!tournament) {
          return {} as Record<
            string,
            TournamentDiscovery["categories"][number]
          >;
        }

        return Object.fromEntries(
          tournament.categories.map((category) => [category.id, category])
        );
      },
      entriesById: () =>
        Object.fromEntries(
          bucket$.data.entries.get().map((entry) => [entry.id, entry])
        ) as Record<string, TournamentEntryWithPlayers>,
      /** Recortadas para este torneio, na ordem do servidor. */
      pendings: () =>
        resolvePendingsForTournament({
          items: bucket$.data.pendings.get(),
          tournamentId: bucket$.identity.tournamentId.get(),
        }),
      role: () => {
        const access = bucket$.derived.access.get();

        return access?.role ?? null;
      },
      rulesView: () => {
        const tournament = bucket$.data.tournament.get();

        return tournament
          ? buildTournamentRulesView(tournament.matchConfig)
          : null;
      },
      /** Fonte única do gate da tela: papel não resolvido não vira superfície. */
      screenState: () =>
        buildTournamentDetailsScreenState({
          actorKey: bucket$.identity.actorKey.get(),
          actorSwitchAt: bucket$.identity.actorSwitchAt.get(),
          bootstrapStatus: bucket$.identity.bootstrapStatus.get(),
          hasTournament: bucket$.data.tournament.get() !== null,
          payloadUpdatedAt: bucket$.identity.payloadUpdatedAt.get(),
        }),
      shouldFetchMatches: () => {
        const access = bucket$.derived.access.get();
        const tournament = bucket$.data.tournament.get();

        if (!(access && tournament)) {
          return false;
        }

        return access.canManage || isBracketPublic(tournament.status);
      },
      tabItems: () => {
        const access = bucket$.derived.access.get();

        return access ? buildTournamentNavigationTabItems(access) : [];
      },
    },
    identity: {
      activeRoute: "index" as TournamentDetailsRoute,
      /** Ator ATIVO (MODO) a que o bucket está amarrado; `null` = ainda não resolveu. */
      actorKey: null as null | string,
      /** Piso de geração: marca d'água do payload no momento da troca de ator. */
      actorSwitchAt: 0,
      bootstrapStatus: "loading" as "error" | "loading" | "ready",
      entriesLoading: false,
      matchesLoading: false,
      /** Marca d'água do carimbo do payload hidratado; não é zerada no `reset`. */
      payloadUpdatedAt: 0,
      pendingsStatus: "idle" as TournamentPendingsStatus,
      resetVersion: 0,
      tournamentId,
    },
    viewer: {
      playerProfileId: null as null | string,
    },
  });

  return bucket$;
}

export function getTournamentDetailsBucket$(tournamentId: string) {
  const existing = tournamentDetailsBuckets.get(tournamentId);

  if (existing) {
    return existing;
  }

  const bucket$ = createTournamentDetailsBucket(tournamentId);
  tournamentDetailsBuckets.set(tournamentId, bucket$);

  return bucket$;
}

export type TournamentDetailsAccessWithRole = TournamentDetailsAccess & {
  role: TournamentDetailsRole;
};
