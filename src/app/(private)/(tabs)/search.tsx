import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { CompetitionCard } from "@/components/ui/competition-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import { filterTournamentsBySearchQuery } from "@convex/domains/tournament/discovery-list";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { SearchField } from "heroui-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { View, type TextInput } from "react-native";

type SearchItem = {
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
  const tournaments = useQuery(
    crpc.tournament.discovery.listAvailable.staticQueryOptions()
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

  const items = useMemo<SearchItem[]>(
    () =>
      filterTournamentsBySearchQuery(tournaments.data ?? [], searchQuery).map(
        (tournament) => ({
          chipLabel: "Torneio",
          city: tournament.city,
          coverUrl: tournament.coverUrl ?? null,
          key: `tournament-${tournament.id}`,
          kind: "tournament",
          name: tournament.name,
          state: tournament.state,
          tournamentId: tournament.id,
        })
      ),
    [tournaments.data, searchQuery]
  );

  const isPending = tournaments.isPending;

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
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center gap-2">
            <Page.Header.BackButton />
            <SearchField
              className="flex-1"
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
            </SearchField>
          </View>
          <Text color="muted" variant="description">
            Encontre competições por nome, cidade, estado ou categoria.
          </Text>
        </View>
      </Page.Header>
      <ScrollShadow color="background" size={200} visibility="bottom">
        <Page.LegendList
          columnWrapperStyle={{ gap: 8 }}
          contentContainerClassName="grow px-4 pb-floating-tab-bar-4"
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
                router.push(`/tournaments/${item.tournamentId}` as Href);
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
