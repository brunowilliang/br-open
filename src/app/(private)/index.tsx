import LeagueCard from "@/components/pages/home/league-card";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Avatar, Button, Description, SearchField } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { View } from "react-native";

export default function HomePrivate() {
  const crpc = useCRPC();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const leagues = useQuery(crpc.league.discovery.listAvailable.queryOptions());

  const userName = session?.user?.name?.trim() || "Jogador";

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row items-center justify-between gap-4">
            <View className="flex-row items-center gap-3">
              <Badge.Anchor>
                <Avatar alt="user">
                  <Avatar.Image
                    source={{
                      uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
                    }}
                  />
                  <Avatar.Fallback>BW</Avatar.Fallback>
                </Avatar>
                <Badge color="danger" size="sm">
                  5
                </Badge>
              </Badge.Anchor>
              <View>
                <Text>Bom dia,</Text>
                <Text variant="title">{userName} 🎾</Text>
              </View>
            </View>

            <Button
              isIconOnly
              onPress={() => router.navigate("/settings")}
              variant="ghost"
            >
              <HugeIcons icon={Settings02Icon} />
            </Button>
          </View>
          <SearchField>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Pesquisar por ligas" />
              <SearchField.ClearButton />
            </SearchField.Group>
            <Description>
              Encontre ligas públicas ou entre como jogador nas ligas que você
              gerencia.
            </Description>
          </SearchField>
        </View>
      </Page.Header>

      {leagues.isPending ? (
        <Page.ScrollView contentContainerClassName="px-4 pb-safe-offset-4">
          <LoadingState />
        </Page.ScrollView>
      ) : (
        <Page.LegendList
          columnWrapperStyle={{ gap: 8 }}
          contentContainerClassName="px-4 pb-safe-offset-4"
          data={leagues.data ?? []}
          estimatedItemSize={220}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <LeagueCard
              city={item.city}
              name={item.name}
              onPress={() => {
                router.navigate({
                  pathname: "/leagues/[leagueId]",
                  params: { leagueId: item.id },
                });
              }}
              state={item.state}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Page>
  );
}
