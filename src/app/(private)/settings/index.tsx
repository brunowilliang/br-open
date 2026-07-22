import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useSignOutMutationOptions } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  BellDotIcon,
  ChampionIcon,
  Logout03Icon,
  TennisRacketIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import {
  Card,
  Chip,
  Description,
  ListGroup,
  PressableFeedback,
  Separator,
  Switch,
  useToast,
} from "heroui-native";
import type { ComponentProps } from "react";
import { Fragment } from "react";
import { View } from "react-native";

type SettingsItem = {
  badge?: number;
  description: string;
  href?: Href;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  id: string;
  isDisabled?: boolean;
  onPress?: () => void;
  playerOnly?: boolean;
  requiresOrganizer?: boolean;
  title: string;
  variant?: "danger";
};

export default function Settings() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const notificationStatus = useQuery(
    crpc.notification.settings.status.queryOptions()
  );
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;
  const activeActor = viewerContext.data?.activeActor ?? null;
  const organizationActor = viewerContext.data?.availableActors.find(
    (actor) => actor.kind === "organization"
  );
  const isOrganizationActor = activeActor?.kind === "organization";
  const canShowOrganizerResources =
    viewerContext.data?.capabilities?.canManageLeagues ?? false;

  async function invalidateActorScopedQueries(
    nextViewerContext?: typeof viewerContext.data
  ) {
    if (nextViewerContext) {
      applyViewerContextToClientState({
        queryClient,
        viewerContext: nextViewerContext,
        viewerContextFilter: crpc.viewer.context.get.queryFilter(),
      });
    }

    await Promise.all([
      queryClient.invalidateQueries(crpc.viewer.context.get.queryFilter()),
      queryClient.invalidateQueries(
        crpc.notification.settings.status.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.league.discovery.listParticipating.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.league.management.listMine.queryFilter()
      ),
    ]);
  }

  const setActiveActor = useMutation(
    crpc.viewer.context.setActiveActor.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível alternar entre os modos. Tente novamente."
          ),
          id: "settings-set-active-actor-error",
          label: "Modo não alterado",
          variant: "danger",
        });
      },
      onSuccess: invalidateActorScopedQueries,
    })
  );

  const handleSignOutPress = useMutation(
    useSignOutMutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não conseguimos encerrar sua sessão. Tente novamente."
          ),
          id: "settings-sign-out-error",
          label: "Não foi possível sair",
          variant: "danger",
        });
      },
    })
  );
  const isActorMutationPending =
    viewerContext.isPending || setActiveActor.isPending;

  function handleOrganizerModeToggle(isSelected: boolean) {
    if (isActorMutationPending || !organizationActor) {
      return;
    }

    if (!isSelected) {
      setActiveActor.mutate({ actorKind: "player" });
      return;
    }

    setActiveActor.mutate({
      actorKind: "organization",
      organizationId: organizationActor.id,
    });
  }

  const profileItem: SettingsItem = isOrganizationActor
    ? {
        description: "Gerencie o perfil da sua organização",
        href: "/settings/organization/profile" as Href,
        icon: ChampionIcon,
        id: "profile",
        title: "Perfil da organização",
      }
    : {
        description: "Gerencie seu perfil como jogador",
        href: "/settings/player/profile",
        icon: TennisRacketIcon,
        id: "profile",
        title: "Perfil do jogador",
      };

  const menusItems: SettingsItem[] = [
    profileItem,
    {
      badge: unreadCount,
      description: "Push e central de notificações",
      href: "/settings/notifications",
      icon: BellDotIcon,
      id: "notifications",
      title: "Notificações",
    },
    {
      description: "Cobranças, vencimentos e histórico",
      href: "/settings/player/payments" as Href,
      icon: Wallet01Icon,
      id: "payments",
      playerOnly: true,
      title: "Meus pagamentos",
    },
    {
      description: "Encerrar sessão neste dispositivo",
      icon: Logout03Icon,
      id: "sign-out",
      isDisabled: handleSignOutPress.isPending,
      onPress: () => handleSignOutPress.mutate(),
      title: handleSignOutPress.isPending ? "Saindo..." : "Sair",
      variant: "danger",
    },
  ];

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Configurações</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-2 px-4 pb-safe-offset-4">
        <Description>Modo de uso</Description>
        {organizationActor ? (
          <ListGroup>
            <PressableFeedback
              animation={false}
              onPress={() => handleOrganizerModeToggle(!isOrganizationActor)}
            >
              <ListGroup.Item disabled>
                <ListGroup.ItemPrefix>
                  <HugeIcons icon={ChampionIcon} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Modo organizador</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    Alterne entre os modos organizador e jogador.
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Switch
                    isDisabled={isActorMutationPending}
                    isSelected={isOrganizationActor}
                    onPress={(event) => {
                      event.stopPropagation();
                    }}
                    onSelectedChange={handleOrganizerModeToggle}
                  />
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
              <PressableFeedback.Highlight />
            </PressableFeedback>
          </ListGroup>
        ) : (
          <PressableFeedback
            isDisabled={isActorMutationPending}
            onPress={() => router.navigate("/settings/organization/onboarding")}
          >
            <Card className="flex-1 flex-row items-center gap-3">
              <View className="centered size-12 rounded-2xl bg-accent-soft">
                <HugeIcons className="size-6 text-accent" icon={ChampionIcon} />
              </View>
              <Card.Body className="flex-1">
                <Text weight="semibold">Seja um organizador</Text>
                <Text className="flex-1" color="muted" variant="description">
                  Crie e administre competições com seu clube, academia ou liga.
                </Text>
              </Card.Body>
              <PressableFeedback.Highlight />
            </Card>
          </PressableFeedback>
        )}
        <Description>Menus</Description>
        <ListGroup>
          {menusItems
            .filter(
              (item) =>
                !(
                  (item.requiresOrganizer && !canShowOrganizerResources) ||
                  (item.playerOnly && isOrganizationActor)
                )
            )
            .map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 ? <Separator className="mx-4" /> : null}
                <ListGroup.Item
                  className={item.isDisabled ? "opacity-50" : undefined}
                  disabled={item.isDisabled}
                  onPress={() => {
                    if (item.onPress) {
                      item.onPress();
                    } else if (item.href) {
                      router.navigate(item.href);
                    }
                  }}
                >
                  <ListGroup.ItemPrefix>
                    <HugeIcons
                      className={
                        item.variant === "danger" ? "text-danger" : undefined
                      }
                      icon={item.icon}
                    />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <View className="flex-row items-center gap-2">
                      <ListGroup.ItemTitle
                        className={
                          item.variant === "danger" ? "text-danger" : undefined
                        }
                      >
                        {item.title}
                      </ListGroup.ItemTitle>
                      {item.badge && item.badge > 0 ? (
                        <Chip color="danger" size="sm" variant="soft">
                          <Chip.Label>{item.badge}</Chip.Label>
                        </Chip>
                      ) : null}
                    </View>
                    <ListGroup.ItemDescription>
                      {item.description}
                    </ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix />
                </ListGroup.Item>
              </Fragment>
            ))}
        </ListGroup>
      </Page.ScrollView>
    </Page>
  );
}
