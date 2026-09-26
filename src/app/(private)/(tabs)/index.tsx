import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { OrganizerDashboard } from "@/components/pages/home/organizer-dashboard";
import { PlayerDashboard } from "@/components/pages/home/player-dashboard";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { authClient } from "@/lib/convex/auth-client";
import { getViewerMode } from "@/lib/actors/viewer-mode";
import { useCRPC } from "@/lib/convex/crpc";
import { getGreetingLabel } from "@/lib/format/user";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, PressableFeedback } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect } from "react";
import { View } from "react-native";

const ACTOR_ERROR_MESSAGE = "Não foi possível identificar o seu perfil.";

const DASHBOARD_ERROR_MESSAGE = "Não foi possível carregar o painel.";

const PLAYER_DASHBOARD_ERROR_MESSAGE = "Não foi possível carregar seu painel.";

/**
 * A rota monta o casco (header + ScrollView) e o dado PRIMÁRIO de cada painel;
 * os blocos e as queries de bloco ficam nos próprios painéis. Composição e
 * estados do conteúdo: `docs/spec/dashboard.md`.
 */
export default function Home() {
  const crpc = useCRPC();
  const router = useRouter();
  const session = authClient.useSession();

  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const activeActor = viewerContext.data?.activeActor ?? null;
  const isOrganizationActor = getViewerMode(activeActor) === "organization";

  const playerProfile = useQuery({
    ...crpc.player.profile.get.staticQueryOptions(),
    // O perfil só é buscado depois de o ator resolver: `!isOrganizationActor`
    // sozinho dispara no primeiro frame (context pendente, ator null). No erro
    // do ator ele volta a ser buscado de propósito — o HEADER o consome.
    enabled: !(viewerContext.isPending || isOrganizationActor),
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

  const dashboardQuery = useQuery({
    ...crpc.payment.dashboard.getOverview.staticQueryOptions(),
    enabled: isOrganizationActor,
  });

  // O dado primário do painel do jogador vive na ROTA e o painel não repete a
  // query; `enabled` espera o ator resolver com sucesso e, no erro do ator, nem
  // busca — o painel não monta e o payload seria descartado.
  const playerOverviewQuery = useQuery({
    ...crpc.player.dashboard.getOverview.staticQueryOptions({ months: 6 }),
    enabled: viewerContext.isSuccess && !isOrganizationActor,
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

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-row items-center justify-between gap-4">
          <PressableFeedback
            onPress={() =>
              router.navigate(
                isOrganizationActor
                  ? "/settings/organization/profile"
                  : "/settings/player/profile"
              )
            }
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
          contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Os QUATRO estados são decididos AQUI: o ator manda primeiro. */}
          {viewerContext.isPending ? (
            <LoadingState />
          ) : viewerContext.isError ? (
            <ErrorState
              error={viewerContext.error}
              message={ACTOR_ERROR_MESSAGE}
            />
          ) : isOrganizationActor ? (
            dashboardQuery.isError ? (
              <ErrorState
                error={dashboardQuery.error}
                message={DASHBOARD_ERROR_MESSAGE}
              />
            ) : dashboardQuery.data ? (
              <OrganizerDashboard data={dashboardQuery.data} />
            ) : (
              <LoadingState />
            )
          ) : playerOverviewQuery.isError ? (
            <ErrorState
              error={playerOverviewQuery.error}
              message={PLAYER_DASHBOARD_ERROR_MESSAGE}
            />
          ) : playerOverviewQuery.data ? (
            <PlayerDashboard
              data={playerOverviewQuery.data}
              viewer={{
                avatarUrl: userAvatarSource ?? null,
                fullName: userName,
                nickname: playerProfile.data?.nickname ?? null,
              }}
            />
          ) : (
            <LoadingState />
          )}
        </Page.ScrollView>
      </ScrollShadow>
    </Page>
  );
}
