import { Page } from "@/components/core/NewPage";
import {
  CompetitionCard,
  CreateCompetitionCard,
} from "@/components/ui/competition-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import type { Tournament } from "@convex/domains/tournament/contract";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Tabs } from "heroui-native";
import { useMemo, useState } from "react";
import { View } from "react-native";

const CREATE_LEAGUE_CARD_ID = "__create_new_league__";
const CREATE_TOURNAMENT_CARD_ID = "__create_new_tournament__";

type LeagueListItem = {
  chipLabel: "Liga";
  city: null | string;
  coverUrl: null | string;
  id: null | string;
  kind: "league";
  name: null | string;
  state: null | string;
};

type TournamentListItem = {
  chipLabel: "Torneio";
  city: null | string;
  coverUrl: null | string;
  id: null | string;
  kind: "tournament";
  name: null | string;
  state: null | string;
};

type CompetitionListItem =
  | { id: typeof CREATE_LEAGUE_CARD_ID; kind: "create-league" }
  | { id: typeof CREATE_TOURNAMENT_CARD_ID; kind: "create-tournament" }
  | LeagueListItem
  | TournamentListItem;

function toLeagueItems(
  leagues: ReadonlyArray<{
    city: null | string;
    coverUrl?: null | string;
    id: string;
    name: null | string;
    state: null | string;
  }>
): LeagueListItem[] {
  return leagues.map((league) => ({
    chipLabel: "Liga",
    city: league.city,
    coverUrl: league.coverUrl ?? null,
    id: league.id,
    kind: "league",
    name: league.name,
    state: league.state,
  }));
}

function toTournamentItems(
  tournaments: readonly Tournament[]
): TournamentListItem[] {
  return tournaments.map((tournament) => ({
    chipLabel: "Torneio",
    city: tournament.city,
    coverUrl: tournament.coverUrl ?? null,
    id: tournament.id,
    kind: "tournament",
    name: tournament.name,
    state: tournament.state,
  }));
}

function openLeague(leagueId: string) {
  router.navigate({
    params: { leagueId },
    pathname: "/leagues/[leagueId]",
  });
}
function editLeague(leagueId: string) {
  router.navigate({
    params: { leagueId, mode: "edit" },
    pathname: "/settings/leagues/[mode]",
  });
}

function editTournament(tournamentId: string) {
  router.navigate({
    params: { mode: "edit", tournamentId },
    pathname: "/settings/tournaments/[mode]",
  });
}

export default function CompetitionsTab() {
  const crpc = useCRPC();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const canManageLeagues =
    viewerContext.data?.capabilities?.canManageLeagues ?? false;

  const myLeagues = useQuery({
    ...crpc.league.management.listMine.queryOptions(),
    enabled: canManageLeagues,
  });
  const myTournaments = useQuery({
    ...crpc.tournament.management.listMine.queryOptions(),
    enabled: canManageLeagues,
  });
  const participatingLeagues = useQuery({
    ...crpc.league.discovery.listParticipating.queryOptions(),
    enabled: !canManageLeagues,
  });
  const participatingTournaments = useQuery({
    ...crpc.tournament.discovery.listParticipating.queryOptions(),
    enabled: !canManageLeagues,
  });

  const [activeTab, setActiveTab] = useState<"leagues" | "tournaments">(
    "leagues"
  );

  const myLeagueItems = useMemo(
    () => toLeagueItems(myLeagues.data ?? []),
    [myLeagues.data]
  );
  const myTournamentItems = useMemo(
    () => toTournamentItems(myTournaments.data ?? []),
    [myTournaments.data]
  );

  function renderCompetitionItem(item: CompetitionListItem) {
    if (item.kind === "create-league") {
      return (
        <CreateCompetitionCard
          description="Toque para criar uma nova liga"
          label="Nova liga"
          onPress={() => {
            router.navigate({
              params: { mode: "new" },
              pathname: "/settings/leagues/[mode]",
            });
          }}
        />
      );
    }

    if (item.kind === "create-tournament") {
      return (
        <CreateCompetitionCard
          description="Toque para criar um novo torneio"
          label="Novo torneio"
          onPress={() => {
            router.navigate({
              params: { mode: "new" },
              pathname: "/settings/tournaments/[mode]",
            });
          }}
        />
      );
    }
    const isLeague = item.kind === "league";
    const competitionId = item.id;

    return (
      <CompetitionCard
        chipLabel={item.chipLabel}
        city={item.city}
        name={item.name}
        onEditPress={
          competitionId === null
            ? undefined
            : () => {
                if (isLeague) {
                  editLeague(competitionId);
                  return;
                }

                editTournament(competitionId);
              }
        }
        onPress={() => {
          if (competitionId === null) {
            return;
          }

          if (isLeague) {
            openLeague(competitionId);
            return;
          }

          router.push(`/tournaments/${competitionId}` as Href);
        }}
        state={item.state}
      />
    );
  }

  const isViewerStatus = viewerContext.isPending || viewerContext.isError;
  const isListLoading = canManageLeagues
    ? myLeagues.isPending || myTournaments.isPending
    : participatingLeagues.isPending || participatingTournaments.isPending;
  const isListError = canManageLeagues
    ? myLeagues.isError || myTournaments.isError
    : participatingLeagues.isError || participatingTournaments.isError;
  const listError = canManageLeagues
    ? myLeagues.isError
      ? myLeagues.error
      : myTournaments.error
    : participatingLeagues.isError
      ? participatingLeagues.error
      : participatingTournaments.error;
  const showStatusState = isViewerStatus || isListLoading || isListError;

  const listItems = useMemo<CompetitionListItem[]>(() => {
    if (canManageLeagues) {
      return activeTab === "leagues"
        ? [
            ...myLeagueItems,
            { id: CREATE_LEAGUE_CARD_ID, kind: "create-league" },
          ]
        : [
            ...myTournamentItems,
            { id: CREATE_TOURNAMENT_CARD_ID, kind: "create-tournament" },
          ];
    }

    return [
      ...toLeagueItems(participatingLeagues.data ?? []),
      ...toTournamentItems(participatingTournaments.data ?? []),
    ];
  }, [
    activeTab,
    canManageLeagues,
    myLeagueItems,
    myTournamentItems,
    participatingLeagues.data,
    participatingTournaments.data,
  ]);

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row">
            <Page.Header.Left />
            <Page.Header.Center>
              <Page.Header.Title>Minhas Competições</Page.Header.Title>
            </Page.Header.Center>
            <Page.Header.Right />
          </View>
          {canManageLeagues ? (
            <Tabs
              onValueChange={(value) => {
                setActiveTab(value as typeof activeTab);
              }}
              value={activeTab}
            >
              <Tabs.List>
                <Tabs.ScrollView>
                  <Tabs.Indicator />
                  <Tabs.Trigger value="leagues">
                    <Tabs.Label>Ligas</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="tournaments">
                    <Tabs.Label>Torneios</Tabs.Label>
                  </Tabs.Trigger>
                </Tabs.ScrollView>
              </Tabs.List>
            </Tabs>
          ) : null}
        </View>
      </Page.Header>
      {showStatusState ? (
        <ScrollShadow className="flex-1" color="background" size={100}>
          <Page.ScrollView
            contentContainerClassName="grow gap-2 px-4 pb-floating-tab-bar-4"
            showsVerticalScrollIndicator={false}
          >
            {viewerContext.isPending && <LoadingState />}
            {viewerContext.isError && (
              <ErrorState
                error={viewerContext.error}
                message="Não foi possível carregar seu modo de acesso."
              />
            )}
            {!isViewerStatus && isListLoading && <LoadingState />}
            {!isViewerStatus && isListError && (
              <ErrorState
                error={listError ?? null}
                message="Não foi possível carregar suas competições."
              />
            )}
          </Page.ScrollView>
        </ScrollShadow>
      ) : (
        <ScrollShadow className="flex-1" color="background" size={100}>
          <Page.LegendList
            columnWrapperStyle={{ gap: 8 }}
            contentContainerClassName="grow px-4 pb-floating-tab-bar-4"
            data={listItems}
            estimatedItemSize={220}
            keyExtractor={(item) => item.id ?? ""}
            ListEmptyComponent={
              <EmptyState
                buttonLabel="Buscar competições"
                buttonOnPress={() => {
                  router.navigate("/search");
                }}
                description="Encontre ligas e torneios para participar."
                title="Nenhuma competição"
              />
            }
            numColumns={2}
            recycleItems
            renderItem={({ item }) => renderCompetitionItem(item)}
            showsVerticalScrollIndicator={false}
          />
        </ScrollShadow>
      )}
    </Page>
  );
}
