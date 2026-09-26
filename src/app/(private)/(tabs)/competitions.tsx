import { Page } from "@/components/core/page";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  CompetitionCard,
  CreateCompetitionCard,
} from "@/components/ui/competition-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { getViewerMode } from "@/lib/actors/viewer-mode";
import { useCRPC } from "@/lib/convex/crpc";
import { getCompetitionListSurface } from "@/lib/tournaments/competitions-surface";
import type { Tournament } from "@convex/domains/tournament/contract";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Button } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

const CREATE_TOURNAMENT_CARD_ID = "__create_new_tournament__";

type TournamentListItem = {
  chipLabel: "Torneio";
  city: null | string;
  coverUrl: null | string;
  id: null | string;
  kind: "tournament";
  name: null | string;
  registrationDeadlineAt: number;
  state: null | string;
  status: string;
};

type CompetitionListItem =
  | { id: typeof CREATE_TOURNAMENT_CARD_ID; kind: "create-tournament" }
  | TournamentListItem;

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
    registrationDeadlineAt: tournament.registrationDeadlineAt,
    state: tournament.state,
    status: tournament.status,
  }));
}

function editTournament(tournamentId: string) {
  router.navigate({
    params: { mode: "edit", tournamentId },
    pathname: "/settings/tournaments/[mode]",
  });
}

export default function CompetitionsTab() {
  const crpc = useCRPC();
  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  // O modo é o MESMO da tab bar (ator ativo), nunca capability: dono/admin é
  // permissão, `kind` é superfície.
  const surface = getCompetitionListSurface(
    getViewerMode(viewerContext.data?.activeActor)
  );
  const isOrganizerMode = surface.list === "mine";

  const myTournaments = useQuery({
    ...crpc.tournament.management.listMine.staticQueryOptions(),
    enabled: isOrganizerMode,
  });
  const participatingTournaments = useQuery({
    ...crpc.tournament.discovery.listParticipating.staticQueryOptions(),
    enabled: !isOrganizerMode,
  });

  const myTournamentItems = useMemo(
    () => toTournamentItems(myTournaments.data ?? []),
    [myTournaments.data]
  );

  function renderCompetitionItem(item: CompetitionListItem) {
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

    const competitionId = item.id;

    return (
      <CompetitionCard
        chipLabel={item.chipLabel}
        city={item.city}
        name={item.name}
        onEditPress={
          !surface.showsEditAction || competitionId === null
            ? undefined
            : () => {
                editTournament(competitionId);
              }
        }
        onPress={() => {
          if (competitionId === null) {
            return;
          }

          router.push(`/tournaments/${competitionId}` as Href);
        }}
        registrationDeadlineAt={item.registrationDeadlineAt}
        state={item.state}
        status={item.status}
      />
    );
  }

  const isViewerStatus = viewerContext.isPending || viewerContext.isError;
  const tournamentsQuery = isOrganizerMode
    ? myTournaments
    : participatingTournaments;
  const showStatusState =
    isViewerStatus || tournamentsQuery.isPending || tournamentsQuery.isError;

  const listItems = useMemo<CompetitionListItem[]>(() => {
    if (surface.showsCreateCard) {
      return [
        ...myTournamentItems,
        { id: CREATE_TOURNAMENT_CARD_ID, kind: "create-tournament" },
      ];
    }

    return toTournamentItems(participatingTournaments.data ?? []);
  }, [
    myTournamentItems,
    participatingTournaments.data,
    surface.showsCreateCard,
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
            <Page.Header.Right>
              {isOrganizerMode ? null : (
                <Button
                  accessibilityLabel="Buscar competições"
                  isIconOnly
                  onPress={() => {
                    router.navigate("/search");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <HugeIcons icon={Search01Icon} />
                </Button>
              )}
            </Page.Header.Right>
          </View>
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
            {!isViewerStatus && tournamentsQuery.isPending && <LoadingState />}
            {!isViewerStatus && tournamentsQuery.isError && (
              <ErrorState
                error={tournamentsQuery.error ?? null}
                message="Não foi possível carregar seus torneios."
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
              surface.showsCreateCard ? undefined : (
                <EmptyState
                  buttonLabel="Buscar competições"
                  buttonOnPress={() => {
                    router.navigate("/search");
                  }}
                  description="Encontre torneios para participar."
                  title="Nenhum torneio"
                />
              )
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
