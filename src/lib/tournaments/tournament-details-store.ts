import { observable } from "@legendapp/state";
import type { ApiOutputs } from "@convex/shared/api";
import type { PendingItem } from "@convex/domains/pendings/contract";

import { resolvePendingsForTournament } from "@/lib/pendings/pendings-view";

import {
  buildTournamentDetailsAccess,
  buildTournamentDetailsRole,
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

/** Estado da leitura de pendências do cluster (mesmo papel do status da liga). */
export type TournamentPendingsStatus = "error" | "idle" | "loading" | "ready";

type TournamentDetailsBucket = ReturnType<typeof createTournamentDetailsBucket>;

const tournamentDetailsBuckets = new Map<string, TournamentDetailsBucket>();

function createTournamentDetailsBucket(tournamentId: string) {
  const bucket$ = observable({
    actions: {
      hydrateDiscovery: (discovery: TournamentDiscovery) => {
        bucket$.data.tournament.set(discovery);
      },
      hydrateEntries: (entries: TournamentEntryWithPlayers[]) => {
        bucket$.data.entries.set(entries);
      },
      hydrateMatches: (matches: TournamentMatch[]) => {
        bucket$.data.matches.set(matches);
      },
      /**
       * Pendências do cluster (IBX-0076 / PLN-0008): o layout mescla os dois
       * escopos (o servidor devolve `items: []` no escopo que não é do ator) e
       * a tela recorta as do torneio. `status` mantém o bloco sem piscar vazio.
       */
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
      /**
       * Zera o bucket e INCREMENTA identity.resetVersion. O incremento e o
       * contrato que os consumidores observam: o layout hidrata por um
       * efeito dependente dessa versao, entao um reset que devolvesse
       * sempre o mesmo valor (0 ou 1) nao disparava a re-hidratacao e o
       * bucket ficava vazio (BUG-0033). Mesmo padrao do
       * league-details-store.
       */
      reset: () => {
        bucket$.data.tournament.set(null);
        bucket$.data.entries.set([]);
        bucket$.data.matches.set([]);
        bucket$.data.pendings.set([]);
        bucket$.viewer.playerProfileId.set(null);
        bucket$.identity.bootstrapStatus.set("loading");
        bucket$.identity.pendingsStatus.set("idle");
        bucket$.identity.resetVersion.set(
          bucket$.identity.resetVersion.get() + 1
        );
        bucket$.identity.activeRoute.set("index");
      },
      setActiveRoute: (route: TournamentDetailsRoute) => {
        bucket$.identity.activeRoute.set(route);
      },
      setBootstrapStatus: (status: "error" | "loading" | "ready") => {
        bucket$.identity.bootstrapStatus.set(status);
      },
    },
    data: {
      entries: [] as TournamentEntryWithPlayers[],
      matches: [] as TournamentMatch[],
      /** Itens de `pendings.list` (escopos player + organization). */
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
      /** Pendências da casa do torneio (a ordem é a do servidor). */
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
      bootstrapStatus: "loading" as "error" | "loading" | "ready",
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
