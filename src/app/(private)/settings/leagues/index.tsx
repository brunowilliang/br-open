// import { LeagueCard } from "@/components/leagues/league-card";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { Add01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  ListGroup,
  Menu,
  PressableFeedback,
  Separator,
} from "heroui-native";
import { EmptyState } from "heroui-native-pro";
import { View } from "react-native";

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
        <Menu.Item onPress={() => router.navigate("/settings/leagues/new")}>
          <Menu.ItemTitle className="flex-none">Criar nova liga</Menu.ItemTitle>
          <HugeIcons icon={Add01Icon} />
        </Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  </Menu>
);

export default function SettingsLeaguesIndex() {
  const crpc = useCRPC();
  const leagues = useQuery(crpc.league.management.listMine.queryOptions());

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
          <MenuOptions />
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-6 px-4 pb-safe-offset-4">
        {leagues.isPending ? <LoadingState /> : null}

        {leagues.isError ? (
          <ErrorState message={leagues.error.message} />
        ) : null}

        {leagues.isPending || leagues.isError || leagues.data?.length ? null : (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Title>Nenhuma liga criada</EmptyState.Title>
              <EmptyState.Description>
                Crie a primeira liga para começar a receber participantes
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content className="w-full gap-2.5">
              <Button onPress={() => router.navigate("/settings/leagues/new")}>
                <Button.Label>Criar nova liga</Button.Label>
                <HugeIcons
                  className="text-accent-foreground"
                  icon={Add01Icon}
                />
              </Button>
            </EmptyState.Content>
          </EmptyState>
        )}

        {leagues.data?.length ? (
          <View className="centered gap-5">
            <ListGroup className="w-full">
              {leagues.data.map((league, index) => (
                <View key={league.id}>
                  <PressableFeedback
                    animation={false}
                    onPress={() => {
                      router.navigate({
                        pathname: "/settings/leagues/[leagueId]/edit",
                        params: { leagueId: league.id },
                      });
                    }}
                  >
                    <ListGroup.Item disabled>
                      <ListGroup.ItemPrefix>
                        <Avatar alt={league.name}>
                          <Avatar.Image
                            source={{
                              uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
                            }}
                          />
                          <Avatar.Fallback>BW</Avatar.Fallback>
                        </Avatar>
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{league.name}</ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>
                          {league.city}-{league.state}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix />
                    </ListGroup.Item>
                    <PressableFeedback.Highlight />
                  </PressableFeedback>
                  {index < leagues.data.length - 1 ? (
                    <Separator className="mx-5" />
                  ) : null}
                </View>
              ))}
            </ListGroup>
            <Button
              className="w-auto"
              onPress={() => router.navigate("/settings/leagues/new")}
              variant="primary"
            >
              <Button.Label>Criar nova liga</Button.Label>
              <HugeIcons className="text-accent-foreground" icon={Add01Icon} />
            </Button>
          </View>
        ) : null}
      </Page.ScrollView>
    </Page>
  );
}
