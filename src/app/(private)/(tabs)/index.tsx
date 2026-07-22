import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { LeagueCard } from "@/components/pages/home/league-card";
import { OrganizerDashboard } from "@/components/pages/home/organizer-dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Page } from "@/components/core/NewPage";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { useCRPC } from "@/lib/convex/crpc";
import { authClient } from "@/lib/convex/auth-client";
import { getGreetingLabel } from "@/lib/format/user";
import { Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, PressableFeedback } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect } from "react";
import { View } from "react-native";

export default function Home() {
  const crpc = useCRPC();
  const router = useRouter();
  const session = authClient.useSession();

  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const activeActor = viewerContext.data?.activeActor ?? null;
  const isOrganizationActor = activeActor?.kind === "organization";

  const playerProfile = useQuery({
    ...crpc.player.profile.get.queryOptions(),
    enabled: !isOrganizationActor,
  });

  useEffect(() => {
    if (session.isPending) {
      return;
    }
    if (session.data?.user?.emailVerified === false) {
      router.replace({
        pathname: "/verify-email",
        params: { email: session.data.user.email },
      });
      return;
    }
    if (
      playerProfile.data &&
      !playerProfile.data.gender &&
      !playerProfile.isPending
    ) {
      router.replace({
        pathname: "/settings/player/profile",
        params: { firstRun: "true" },
      });
    }
  }, [
    session.isPending,
    session.data?.user?.emailVerified,
    session.data?.user?.email,
    playerProfile.data,
    playerProfile.isPending,
    router,
  ]);

  // Player queries
  const participatingLeagues = useQuery({
    ...crpc.league.discovery.listParticipating.queryOptions(),
    enabled: !isOrganizationActor,
  });

  // Organizer queries
  const dashboardQuery = useQuery({
    ...crpc.payment.dashboard.getOverview.queryOptions(),
    enabled: isOrganizationActor,
  });

  const notificationStatus = useQuery(
    crpc.notification.settings.status.queryOptions()
  );

  const userName = isOrganizationActor
    ? (activeActor?.displayName ?? "")
    : (playerProfile.data?.fullName ?? activeActor?.displayName ?? "");
  const userAvatarSource = isOrganizationActor
    ? (activeActor?.avatarUrl ?? undefined)
    : (playerProfile.data?.avatarUrl ?? activeActor?.avatarUrl ?? undefined);
  const greeting = `${getGreetingLabel()},`;
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;

  // --- Organizer mode: dashboard only ---
  if (isOrganizationActor) {
    const dashboardData = dashboardQuery.data;
    const isLoading = dashboardQuery.isPending && !dashboardData;

    return (
      <Page>
        <Page.Header>
          <View className="flex-1 flex-row items-center justify-between gap-4">
            <PressableFeedback
              className="rounded-2xl"
              onPress={() => router.navigate("/settings/organization/profile")}
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
            <Button
              isIconOnly
              onPress={() => router.navigate("/settings")}
              variant="ghost"
            >
              <HugeIcons icon={Settings02Icon} />
            </Button>
          </View>
        </Page.Header>
        <ScrollShadow className="flex-1" color="background" size={100}>
          <Page.ScrollView
            contentContainerClassName="gap-4 px-4 pb-safe-offset-23"
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <LoadingState />
            ) : dashboardQuery.isError ? (
              <ErrorState
                error={dashboardQuery.error}
                message="Não foi possível carregar o painel."
              />
            ) : dashboardData ? (
              <OrganizerDashboard data={dashboardData} />
            ) : null}
          </Page.ScrollView>
        </ScrollShadow>
      </Page>
    );
  }

  // --- Player mode: participating leagues grid ---
  const leagues = participatingLeagues.data ?? [];
  const isLoading = participatingLeagues.isPending;

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

          <Button
            isIconOnly
            onPress={() => router.navigate("/settings")}
            variant="ghost"
          >
            <HugeIcons icon={Settings02Icon} />
          </Button>
        </View>
      </Page.Header>
      <ScrollShadow className="flex-1" color="background" size={100}>
        <Page.LegendList
          columnWrapperStyle={{ gap: 8 }}
          contentContainerClassName="grow px-4 pb-safe-offset-23"
          data={leagues}
          estimatedItemSize={220}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isLoading ? (
              <LoadingState />
            ) : (
              <EmptyState
                buttonIcon={Search01Icon}
                buttonLabel="Explorar competições"
                buttonOnPress={() => {
                  router.navigate("/search");
                }}
                description="As competições em que suas ligas ativas serão exibidas aqui."
                title="Nenhuma liga ativa"
              />
            )
          }
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
