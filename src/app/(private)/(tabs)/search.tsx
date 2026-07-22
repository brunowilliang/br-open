import { LeagueCard } from "@/components/pages/home/league-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/core/NewPage";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import { filterLeaguesBySearchQuery } from "@convex/domains/league/discovery-list";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { Description, SearchField } from "heroui-native";
import { useCallback, useMemo, useRef, useState } from "react";
import type { TextInput } from "react-native";

export default function Search() {
  const crpc = useCRPC();
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const leagues = useQuery(crpc.league.discovery.listAvailable.queryOptions());

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

  const filteredLeagues = useMemo(
    () => filterLeaguesBySearchQuery(leagues.data ?? [], searchQuery),
    [leagues.data, searchQuery]
  );

  function renderListEmptyComponent() {
    if (leagues.isPending) {
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
          data={filteredLeagues}
          estimatedItemSize={220}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderListEmptyComponent}
          numColumns={2}
          recycleItems
          renderItem={({ item }) => (
            <LeagueCard
              city={item.city}
              coverUrl={item.coverUrl}
              name={item.name}
              onPress={() => {
                router.navigate({
                  params: { leagueId: item.id },
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
