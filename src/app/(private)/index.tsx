import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { LeagueCard } from "@/components/pages/home/league-card";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { getHomePlayerDisplayName } from "@/lib/player/home-identity";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Button,
  Description,
  PressableFeedback,
  SearchField,
} from "heroui-native";
import { Badge } from "heroui-native-pro";
import { View } from "react-native";

export default function HomePrivate() {
  const crpc = useCRPC();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const leagues = useQuery(crpc.league.discovery.listAvailable.queryOptions());
  const playerProfile = useQuery(crpc.player.profile.get.queryOptions());
  const notificationStatus = useQuery(
    crpc.notification.settings.status.queryOptions()
  );

  const userName = getHomePlayerDisplayName({
    playerFullName: playerProfile.data?.fullName,
    userId: session?.user?.id,
  });
  const userAvatarSource = playerProfile.data?.avatarUrl ?? undefined;
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row items-center justify-between gap-4">
            <PressableFeedback
              className="rounded-2xl"
              onPress={() => router.navigate("/settings/player/profile")}
            >
              <View className="flex-row items-center gap-3">
                <Badge.Anchor>
                  <Image
                    alt={userName}
                    className="size-10 rounded-full"
                    fallback="green"
                    source={userAvatarSource}
                  />
                  {unreadCount > 0 ? (
                    <Badge color="danger" size="sm">
                      {unreadCount}
                    </Badge>
                  ) : null}
                </Badge.Anchor>
                <View>
                  <Text>Bom dia,</Text>
                  <Text className="-mt-1" variant="title">
                    {userName} 🎾
                  </Text>
                </View>
              </View>
            </PressableFeedback>

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
          recycleItems
          renderItem={({ item }) => (
            <LeagueCard
              city={item.city}
              coverUrl={item.coverUrl}
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
