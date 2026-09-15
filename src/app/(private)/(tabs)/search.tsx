import { CompetitionCard } from "@/components/ui/competition-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/core/NewPage";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import { filterLeaguesBySearchQuery } from "@convex/domains/league/discovery-list";
import { filterTournamentsBySearchQuery } from "@convex/domains/tournament/discovery-list";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Description, SearchField } from "heroui-native";
import { useCallback, useMemo, useRef, useState } from "react";
import type { TextInput } from "react-native";

type SearchItem =
  | {
      chipLabel: "Liga";
      key: string;
      leagueId: string;
      city: null | string;
      coverUrl: null | string;
      name: null | string;
      state: null | string;
      kind: "league";
    }
  | {
      chipLabel: "Torneio";
      key: string;
      tournamentId: string;
      city: null | string;
      coverUrl: null | string;
      name: null | string;
      state: null | string;
      kind: "tournament";
    };

export default function Search() {
  const crpc = useCRPC();
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const leagues = useQuery(crpc.league.discovery.listAvailable.queryOptions());
  const tournaments = useQuery(
    crpc.tournament.discovery.listAvailable.queryOptions()
  );

  useFocusEffect(
    useCallback(() => {
      const focusTask = requestIdleCallback(() => {
        searchInputRef.current?.focus();
      });

      return () => {
        cancelIdleCallback(focusTask);
      };
    }, [])
  );

  const items = useMemo<SearchItem[]>(() => {
    const leagueItems: SearchItem[] = filterLeaguesBySearchQuery(
      leagues.data ?? [],
      searchQuery
    ).map((league) => ({
      chipLabel: "Liga",
      city: league.city,
      coverUrl: league.coverUrl ?? null,
      key: `league-${league.id}`,
      kind: "league",
      leagueId: league.id,
      name: league.name,
      state: league.state,
    }));
    const tournamentItems: SearchItem[] = filterTournamentsBySearchQuery(
      tournaments.data ?? [],
      searchQuery
    ).map((tournament) => ({
      chipLabel: "Torneio",
      city: tournament.city,
      coverUrl: tournament.coverUrl ?? null,
      key: `tournament-${tournament.id}`,
      kind: "tournament",
      name: tournament.name,
      state: tournament.state,
      tournamentId: tournament.id,
    }));

    return [...leagueItems, ...tournamentItems];
  }, [leagues.data, tournaments.data, searchQuery]);

  const isPending = leagues.isPending || tournaments.isPending;

  function renderListEmptyComponent() {
    if (isPending) {
      return <LoadingState />;
    }

    return (
      <EmptyState
        buttonIcon={null}
        description="Revise os termos da busca ou tente outra cidade, estado ou categoria."
        title="Nenhum resultado encontrado"
      />
    );
  }

  return (
    <Page>
      <Page.Header>
        <SearchField
          className="w-full"
          onChange={setSearchQuery}
          value={searchQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              accessibilityLabel="Buscar competições"
              placeholder="Buscar competições"
              ref={searchInputRef}
            />
            <SearchField.ClearButton />
          </SearchField.Group>
          <Description>
            Encontre competições por nome, cidade, estado ou categoria.
          </Description>
        </SearchField>
      </Page.Header>
      <ScrollShadow color="background" size={200} visibility="bottom">
        <Page.LegendList
          columnWrapperStyle={{ gap: 8 }}
          contentContainerClassName="grow px-4 pb-safe-offset-23"
          data={items}
          estimatedItemSize={220}
          keyExtractor={(item) => item.key}
          ListEmptyComponent={renderListEmptyComponent}
          numColumns={2}
          renderItem={({ item }) => (
            <CompetitionCard
              chipLabel={item.chipLabel}
              city={item.city}
              coverUrl={item.coverUrl}
              name={item.name}
              onPress={() => {
                if (item.kind === "tournament") {
                  router.push(`/tournaments/${item.tournamentId}` as Href);
                  return;
                }

                router.navigate({
                  params: { leagueId: item.leagueId },
                  pathname: "/leagues/[leagueId]",
                });
              }}
              state={item.state}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </ScrollShadow>
    </Page>
  );
}
