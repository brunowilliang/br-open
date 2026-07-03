import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { LeagueCard } from "@/components/pages/home/league-card";
import { EmptyState } from "@/components/ui/empty-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/core/NewPage";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import {
  Add01Icon,
  Search01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, PressableFeedback } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { View } from "react-native";

function getHomeGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Bom dia,";
  }

  if (hour < 18) {
    return "Boa tarde,";
  }

  return "Boa noite,";
}

export default function Home() {
  const crpc = useCRPC();
  const router = useRouter();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const activeActor = viewerContext.data?.activeActor ?? null;
  const isOrganizationActor = activeActor?.kind === "organization";
  const participatingLeagues = useQuery({
    ...crpc.league.discovery.listParticipating.queryOptions(),
    enabled: !isOrganizationActor,
  });
  const managedLeagues = useQuery({
    ...crpc.league.management.listMine.queryOptions(),
    enabled: isOrganizationActor,
  });
  const playerProfile = useQuery(crpc.player.profile.get.queryOptions());
  const notificationStatus = useQuery(
    crpc.notification.settings.status.queryOptions()
  );
  const activeLeagues = isOrganizationActor
    ? (managedLeagues.data ?? [])
    : (participatingLeagues.data ?? []);
  const userName =
    playerProfile.data?.fullName ?? activeActor?.displayName ?? "";
  const userAvatarSource =
    playerProfile.data?.avatarUrl ?? activeActor?.avatarUrl ?? undefined;
  const greeting = getHomeGreeting();
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;
  const isLeagueListPending = isOrganizationActor
    ? managedLeagues.isPending
    : participatingLeagues.isPending;

  function renderListEmptyComponent() {
    if (isLeagueListPending || viewerContext.isPending) {
      return <LoadingState />;
    }

    if (isOrganizationActor) {
      return (
        <EmptyState
          buttonIcon={Add01Icon}
          buttonLabel="Criar liga"
          buttonOnPress={() => {
            router.navigate({
              params: { mode: "new" },
              pathname: "/settings/leagues/[mode]",
            });
          }}
          description="As ligas criadas por esta organizacao serao exibidas aqui."
          title="Nenhuma liga criada"
        />
      );
    }

    return (
      <EmptyState
        buttonIcon={Search01Icon}
        buttonLabel="Explorar competições"
        buttonOnPress={() => {
          router.navigate("/search");
        }}
        description="As competições em que sua participação estiver ativa serão exibidas aqui."
        title="Nenhuma participação ativa"
      />
    );
  }

  return (
    <Page>
      <Page.Header>
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
                <Text>{greeting}</Text>
                <Text className="-mt-1" variant="title">
                  {userName}
                </Text>
              </View>
            </View>
          </PressableFeedback>

          <View className="flex-row items-center gap-1">
            <Button
              isIconOnly
              onPress={() => router.navigate("/settings")}
              variant="ghost"
            >
              <HugeIcons icon={Settings02Icon} />
            </Button>
          </View>
        </View>
      </Page.Header>
      <ScrollShadow className="flex-1" color="background" size={100}>
        <Page.LegendList
          columnWrapperStyle={{ gap: 8 }}
          contentContainerClassName="grow px-4 pb-safe-offset-23"
          data={activeLeagues}
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
                  pathname: "/leagues/[leagueId]",
                  params: { leagueId: item.id },
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
