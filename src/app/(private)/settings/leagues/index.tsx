import {
  CreateLeagueCard,
  LeagueCard,
} from "@/components/pages/home/league-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/core/page";
import { useCRPC } from "@/lib/convex/crpc";
import { Add01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Button, Menu } from "heroui-native";

const CREATE_CARD_ID = "__create_new_league__";

const MenuOptions = () => (
  <Menu>
    <Menu.Trigger asChild>
      <Button isIconOnly size="sm" variant="ghost">
        <HugeIcons icon={MoreVerticalIcon} />
      </Button>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Overlay />
      <Menu.Content presentation="popover">
        <Menu.Item
          onPress={() => {
            router.navigate({
              params: { mode: "new" },
              pathname: "/settings/leagues/[mode]",
            });
          }}
        >
          <Menu.ItemTitle className="flex-none">Criar nova liga</Menu.ItemTitle>
          <HugeIcons icon={Add01Icon} />
        </Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  </Menu>
);

export default function SettingsLeaguesIndex() {
  const crpc = useCRPC();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const canManageLeagues =
    viewerContext.data?.capabilities?.canManageLeagues ?? false;
  const leagues = useQuery({
    ...crpc.league.management.listMine.queryOptions(),
    enabled: canManageLeagues,
  });
  const hasLeagues = Boolean(leagues.data?.length);

  const items = hasLeagues
    ? [
        ...(leagues.data ?? []),
        {
          id: CREATE_CARD_ID,
          city: null,
          coverUrl: null,
          name: "Nova liga",
          state: null,
        },
      ]
    : [];

  function renderListEmptyComponent() {
    if (viewerContext.isPending) {
      return <LoadingState />;
    }

    if (viewerContext.isError) {
      return (
        <ErrorState
          error={viewerContext.error}
          message="Não foi possível carregar seu modo de acesso."
        />
      );
    }

    if (!canManageLeagues) {
      return (
        <EmptyState
          buttonLabel="Voltar"
          buttonOnPress={() => router.back()}
          description="Você está usando o app como jogador. Entre como organizador para criar e administrar ligas."
          title="Modo jogador"
        />
      );
    }

    if (leagues.isPending) {
      return <LoadingState />;
    }

    if (leagues.isError) {
      return (
        <ErrorState
          error={leagues.error}
          message="Não foi possível carregar suas ligas."
        />
      );
    }

    return (
      <EmptyState
        buttonLabel="Criar nova liga"
        buttonOnPress={() => {
          router.navigate({
            params: { mode: "new" },
            pathname: "/settings/leagues/[mode]",
          });
        }}
        description="Crie a primeira liga para começar a receber participantes"
        title="Nenhuma liga criada"
      />
    );
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Minhas Ligas</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          {canManageLeagues ? <MenuOptions /> : null}
        </Page.Header.Right>
      </Page.Header>

      <Page.LegendList
        columnWrapperStyle={{ gap: 8 }}
        contentContainerClassName="px-4 pb-safe-offset-4"
        data={items}
        estimatedItemSize={220}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderListEmptyComponent}
        numColumns={2}
        recycleItems
        renderItem={({ item }) =>
          item.id === CREATE_CARD_ID ? (
            <CreateLeagueCard />
          ) : (
            <LeagueCard
              city={item.city}
              coverUrl={item.coverUrl}
              name={item.name}
              onEditPress={() => {
                router.navigate({
                  params: { leagueId: item.id, mode: "edit" },
                  pathname: "/settings/leagues/[mode]",
                });
              }}
              onPress={() => {
                router.navigate({
                  pathname: "/leagues/[leagueId]",
                  params: { leagueId: item.id },
                });
              }}
              state={item.state}
            />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </Page>
  );
}
