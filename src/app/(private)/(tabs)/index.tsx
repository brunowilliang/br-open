import { Image } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { OrganizerDashboard } from "@/components/pages/home/organizer-dashboard";
import { PlayerDashboard } from "@/components/pages/home/player-dashboard";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { getGreetingLabel } from "@/lib/format/user";
import { formatDashboardMonthLabel } from "@/lib/home/player-dashboard-view";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, PressableFeedback } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect } from "react";
import { View } from "react-native";

/** PLN-0007 (plano de conteúdo IBX-0071): a home do jogador é o dash em
 * TEXTO SIMPLES (partidas por mês, desempenho, inscrições, próximos jogos).
 * Widgets/gráficos e a trilha de competições saíram; componente de KPI/chart
 * só volta após aprovação item a item (spec dashboard.md). */
export default function Home() {
  const crpc = useCRPC();
  const router = useRouter();
  const session = authClient.useSession();

  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const activeActor = viewerContext.data?.activeActor ?? null;
  const isOrganizationActor = activeActor?.kind === "organization";

  // Player queries
  const playerProfile = useQuery({
    ...crpc.player.profile.get.staticQueryOptions(),
    enabled: !isOrganizationActor,
  });

  useEffect(() => {
    if (session.isPending) {
      return;
    }
    if (session.data?.user?.emailVerified === false) {
      router.replace({
        params: { email: session.data.user.email },
        pathname: "/verify-email",
      });
      return;
    }
    if (
      playerProfile.data &&
      !playerProfile.data.gender &&
      !playerProfile.isPending
    ) {
      router.replace({
        params: { firstRun: "true" },
        pathname: "/settings/player/profile",
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

  // Organizer queries
  const dashboardQuery = useQuery({
    ...crpc.payment.dashboard.getOverview.staticQueryOptions(),
    enabled: isOrganizationActor,
  });
  const revenueSeriesQuery = useQuery({
    ...crpc.payment.dashboard.getRevenueSeries.staticQueryOptions({
      months: 6,
    }),
    enabled: isOrganizationActor,
  });

  const notificationStatus = useQuery(
    crpc.notification.settings.status.staticQueryOptions()
  );

  const userName = isOrganizationActor
    ? (activeActor?.displayName ?? "")
    : (playerProfile.data?.fullName ?? activeActor?.displayName ?? "");
  const userAvatarSource = isOrganizationActor
    ? (activeActor?.avatarUrl ?? undefined)
    : (playerProfile.data?.avatarUrl ?? activeActor?.avatarUrl ?? undefined);
  const greeting = `${getGreetingLabel()},`;
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;

  // --- Organizer mode: dashboard financeiro + receita por mês ---
  if (isOrganizationActor) {
    const dashboardData = dashboardQuery.data;
    const isLoading = dashboardQuery.isPending && !dashboardData;

    return (
      <Page>
        <Page.Header>
          <View className="flex-1 flex-row items-center justify-between gap-4">
            <PressableFeedback
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

            {revenueSeriesQuery.data ? (
              <View className="gap-3">
                <View className="gap-1">
                  <Text color="muted" variant="description" weight="medium">
                    Receita por mês
                  </Text>
                  <Text weight="semibold">
                    {revenueSeriesQuery.data.series
                      .map(
                        (point) =>
                          `${formatDashboardMonthLabel(point.month)} ${formatCurrencyCents(point.receivedCents)}`
                      )
                      .join(" · ") || "0"}
                  </Text>
                </View>
                <View className="gap-1">
                  <Text color="muted" variant="description" weight="medium">
                    Total da janela
                  </Text>
                  <Text weight="semibold">
                    {formatCurrencyCents(revenueSeriesQuery.data.totalCents)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Page.ScrollView>
        </ScrollShadow>
      </Page>
    );
  }

  // --- Player mode: dash pessoal em texto simples ---
  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-row items-center justify-between gap-4">
          <PressableFeedback
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
        <Page.ScrollView
          contentContainerClassName="grow gap-4 px-4 pb-safe-offset-23"
          showsVerticalScrollIndicator={false}
        >
          <PlayerDashboard />
        </Page.ScrollView>
      </ScrollShadow>
    </Page>
  );
}
