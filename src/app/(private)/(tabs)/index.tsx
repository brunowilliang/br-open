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
import { useCRPC } from "@/lib/convex/crpc";
import { getGreetingLabel } from "@/lib/format/user";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, PressableFeedback } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect } from "react";
import { View } from "react-native";

/** Mensagem do erro do ator (copy do usuário, BUG-0056). */
const ACTOR_ERROR_MESSAGE = "Não foi possível identificar o seu perfil.";

/** Mensagem do painel financeiro (a que a tela já mostrava). */
const DASHBOARD_ERROR_MESSAGE = "Não foi possível carregar o painel.";

/** Mensagem do painel do jogador — a MESMA copy que o próprio painel mostrava,
 * só içada pra cá junto com a carga (IBX-0083). */
const PLAYER_DASHBOARD_ERROR_MESSAGE = "Não foi possível carregar seu painel.";

/** PLN-0007 (plano de conteúdo IBX-0071, composição do IBX-0075): a home
 * compõe os blocos de número com o `KpiCard` da galeria e as séries mensais com
 * o `MonthlyChartCard` (IBX-0078) nos dois papéis. A rota monta o casco (header
 * + ScrollView), carrega o dado PRIMÁRIO de cada painel (`getOverview` da
 * organização e do jogador) e resolve os QUATRO estados do conteúdo DENTRO do
 * `Page.ScrollView` (a cadeia do `{…}`); cada painel segue com os próprios
 * blocos e queries de bloco (`PlayerDashboard` / `OrganizerDashboard` — a série
 * de receita da organização desceu pro painel dela no IBX-0081). A trilha de
 * competições segue fora (GAP de dado) — `docs/spec/dashboard.md`. */
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
    /* BUG-0056: o perfil do jogador só é buscado depois de o ator resolver —
       `!isOrganizationActor` sozinho dispara no PRIMEIRO frame (o
       `viewer.context.get` ainda está pendente e `activeActor` é null), ou seja
       um request inútil para quem entra como organização. É o mesmo sinal dos
       ramos de conteúdo (o ator manda): no ERRO do ator `isPending` é false e
       o perfil volta a ser buscado — o comportamento do HEAD nesse caminho, e
       ali o dado segue com consumidor, que é o HEADER (nome/avatar), em tela nos
       quatro estados. */
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

  // Organizer queries
  const dashboardQuery = useQuery({
    ...crpc.payment.dashboard.getOverview.staticQueryOptions(),
    enabled: isOrganizationActor,
  });

  // Player panel query (IBX-0083): o dado primário do painel do jogador sobe
  // pra rota — é ela que resolve carga e erro dos quatro estados da tela. O
  // `enabled` espera o ator RESOLVER com sucesso (nem primeiro frame, nem
  // organização) e, no erro do ator, nem busca: o painel do jogador não monta
  // nesse caminho e o payload seria descartado (LOW 3 do delta-check). O painel
  // NÃO repete esta query.
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
          contentContainerClassName="gap-4 px-4 pb-safe-offset-23"
          showsVerticalScrollIndicator={false}
        >
          {/* Os QUATRO estados da home (IBX-0082/IBX-0083) são decididos AQUI,
              dentro do ScrollView: o ator manda primeiro (sem ele não se sabe de
              quem é a home); depois o painel do papel resolve a própria
              carga/erro, e "sem erro e sem dado" é a espera. O `ErrorState`
              cobre as TRÊS falhas: ator, painel da organização e painel do
              jogador. Ator resolvido e NULO cai no jogador. */}
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
            <PlayerDashboard data={playerOverviewQuery.data} />
          ) : (
            <LoadingState />
          )}
        </Page.ScrollView>
      </ScrollShadow>
    </Page>
  );
}
