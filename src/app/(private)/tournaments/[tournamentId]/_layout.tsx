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
  // Parametro LOCAL da rota (nunca useGlobalSearchParams aqui): o global
  // segue a rota FOCADA, entao um detalhe empilhado embaixo de outro
  // passaria a ler o tournamentId de cima e trocaria de bucket no meio da
  // pilha (reset/hidratacao no bucket errado, e na volta o bucket do de
  // baixo ficava vazio). O local vem do proprio Route node, um por
  // instancia (expo-router build/Route.js:34).
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
  // Pendências do cluster (IBX-0076 / PLN-0008): os DOIS escopos são pedidos
  // sem gate de papel — o servidor devolve `items: []` no escopo que não é do
  // ator ativo, e assim a casa do torneio serve o jogador (4 a 7) e o
  // organizador (11 e 12) sem o cliente decidir visibilidade.
  const playerPendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "player" })
  );
  const organizationPendingsQuery = useQuery(
    crpc.pendings.list.list.staticQueryOptions({ scope: "organization" })
  );

  useEffect(() => {
    // O reset e quem destrava a hidratacao: ele INCREMENTA
    // identity.resetVersion, e os efeitos abaixo dependem dela (o gate
    // `resetVersion === 0` protege o bucket recem-criado). Um bootstrap
    // que so devolvia a versao para 1 dentro do mesmo efeito nao mudava
    // dependencia nenhuma e deixava o bucket vazio (BUG-0033).
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

  // entriesQuery em erro não pode ficar silencioso (IBX-0067): sem entries
  // o role caía pra guest com bucket vazio e a tela virava null sem estado.
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
    if (matchesQuery.data) {
      bucket$.actions.hydrateMatches(matchesQuery.data);
    }
  }, [bucket$, matchesQuery.data]);

  useEffect(() => {
    // Só um dos escopos tem item (o outro volta vazio), então a concatenação
    // preserva a ordem que o servidor mandou.
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
