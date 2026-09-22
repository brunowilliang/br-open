import {
  Calendar03Icon,
  Home01Icon,
  HierarchySquare01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";

import {
  FloatingTabBar,
  type FloatingTabBarItem,
} from "@/components/navigation/floating-tab-bar";
import { useCRPC } from "@/lib/convex/crpc";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import type { TournamentNavigationTabValue } from "@/lib/tournaments/tournament-details-derived";

const TOURNAMENT_TAB_ICONS = {
  bracket: HierarchySquare01Icon,
  entries: UserMultipleIcon,
  overview: Home01Icon,
  schedule: Calendar03Icon,
} satisfies Record<TournamentNavigationTabValue, FloatingTabBarItem["icon"]>;

const TOURNAMENT_TAB_ROUTE_NAMES = {
  bracket: "bracket",
  entries: "entries",
  overview: "index",
  schedule: "schedule",
} satisfies Record<TournamentNavigationTabValue, string>;

const TOURNAMENT_DETAIL_SCREEN_NAMES = [
  "index",
  "bracket",
  "entries",
  "schedule",
] as const;

export default function TournamentDetailsLayout() {
  // Parametro LOCAL da rota (nunca useGlobalSearchParams): o global segue a rota
  // FOCADA, então um detalhe empilhado leria o tournamentId de cima e trocaria
  // de bucket no meio da pilha.
  const { tournamentId: rawTournamentId } = useLocalSearchParams<{
    tournamentId?: string | string[];
  }>();
  const tournamentId = Array.isArray(rawTournamentId)
    ? rawTournamentId[0]
    : rawTournamentId;

  if (!tournamentId) {
    return <TournamentDetailsTabs tournamentId={undefined} />;
  }

  return <TournamentDetailsLayoutContent tournamentId={tournamentId} />;
}

function TournamentDetailsLayoutContent(props: { tournamentId: string }) {
  const { tournamentId } = props;
  const crpc = useCRPC();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const resetVersion = useValue(bucket$.identity.resetVersion);

  const viewerQuery = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const tournamentQuery = useQuery(
    crpc.tournament.discovery.getById.staticQueryOptions({ tournamentId })
  );
  const shouldFetchMatches = useValue(bucket$.derived.shouldFetchMatches);
  const matchesQuery = useQuery({
    ...crpc.tournament.matches.listForTournament.staticQueryOptions({
      tournamentId,
    }),
    enabled: shouldFetchMatches,
  });
  const entriesQuery = useQuery(
    crpc.tournament.entries.listForTournament.staticQueryOptions({
      tournamentId,
    })
  );
  // Os DOIS escopos, sem gate de papel: o servidor devolve items: [] no escopo
  // que não é do ator, então a casa serve jogador e organizador igual.
  const playerPendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "player" })
  );
  const organizationPendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "organization" })
  );

  useEffect(() => {
    // O reset incrementa identity.resetVersion: é dela que a hidratação abaixo
    // depende.
    bucket$.actions.reset();
  }, [bucket$]);

  useEffect(() => {
    if (viewerQuery.data) {
      bucket$.actions.hydrateViewer(
        viewerQuery.data.activeActor?.kind === "player"
          ? viewerQuery.data.activeActor.id
          : null
      );
    }
  }, [bucket$, viewerQuery.data]);

  useEffect(() => {
    if (resetVersion === 0) {
      return;
    }

    if (tournamentQuery.data) {
      bucket$.actions.hydrateDiscovery(tournamentQuery.data);
      bucket$.actions.setBootstrapStatus("ready");
    }
  }, [bucket$, resetVersion, tournamentQuery.data]);

  useEffect(() => {
    if (tournamentQuery.isError) {
      bucket$.actions.setBootstrapStatus("error");
    }
  }, [bucket$, tournamentQuery.isError]);

  // Sem entries o role caía pra guest e a tela virava null sem estado.
  useEffect(() => {
    if (entriesQuery.isError) {
      bucket$.actions.setBootstrapStatus("error");
    }
  }, [bucket$, entriesQuery.isError]);

  useEffect(() => {
    if (entriesQuery.data) {
      bucket$.actions.hydrateEntries(entriesQuery.data);
    }
  }, [bucket$, entriesQuery.data]);

  useEffect(() => {
    bucket$.actions.setEntriesLoading(entriesQuery.isPending);
  }, [bucket$, entriesQuery.isPending]);

  // A query de partidas é gated, então o gate entra junto.
  useEffect(() => {
    bucket$.actions.setMatchesLoading(
      shouldFetchMatches && matchesQuery.isPending
    );
  }, [bucket$, matchesQuery.isPending, shouldFetchMatches]);

  useEffect(() => {
    if (matchesQuery.data) {
      bucket$.actions.hydrateMatches(matchesQuery.data);
    }
  }, [bucket$, matchesQuery.data]);

  useEffect(() => {
    // Só um dos escopos tem item; a concatenação preserva a ordem do servidor.
    bucket$.actions.hydratePendings({
      items: [
        ...(playerPendingsQuery.data?.items ?? []),
        ...(organizationPendingsQuery.data?.items ?? []),
      ],
      status:
        playerPendingsQuery.isPending || organizationPendingsQuery.isPending
          ? "loading"
          : playerPendingsQuery.isError || organizationPendingsQuery.isError
            ? "error"
            : "ready",
    });
  }, [
    bucket$,
    organizationPendingsQuery.data,
    organizationPendingsQuery.isError,
    organizationPendingsQuery.isPending,
    playerPendingsQuery.data,
    playerPendingsQuery.isError,
    playerPendingsQuery.isPending,
  ]);

  return <TournamentDetailsTabs tournamentId={tournamentId} />;
}

function TournamentDetailsTabs(props: { tournamentId?: string }) {
  const backgroundColor = useThemeColor("background");

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        animation: "fade",
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}
      tabBar={(tabBarProps) =>
        props.tournamentId ? (
          <TournamentTabsWithFloatingTabBar
            tabBarProps={tabBarProps}
            tournamentId={props.tournamentId}
          />
        ) : null
      }
    >
      {TOURNAMENT_DETAIL_SCREEN_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

function TournamentTabsWithFloatingTabBar(props: {
  tabBarProps: Parameters<
    NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
  >[0];
  tournamentId: string;
}) {
  const { tabBarProps, tournamentId } = props;
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const tabItems = useValue(bucket$.derived.tabItems);
  const items = tabItems.map((item) => ({
    ...item,
    icon: TOURNAMENT_TAB_ICONS[item.value],
  }));

  return (
    <FloatingTabBar
      {...tabBarProps}
      getNavigationParams={(input) => ({
        ...input.routeParams,
        tournamentId,
      })}
      items={items}
      resolveValueFromRouteName={resolveTournamentTabValueFromRouteName}
      routeNames={TOURNAMENT_TAB_ROUTE_NAMES}
    />
  );
}

function resolveTournamentTabValueFromRouteName(
  routeName: string
): TournamentNavigationTabValue | null {
  switch (routeName) {
    case "bracket":
      return "bracket";
    case "entries":
      return "entries";
    case "index":
      return "overview";
    case "schedule":
      return "schedule";
    default:
      return null;
  }
}
