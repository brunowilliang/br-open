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
  description: string;
  href: Href;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  playerOnly?: boolean;
  requiresOrganizer?: boolean;
  title: string;
};

type SettingsSection = {
  items: SettingsItem[];
  title: string;
};

const sections: SettingsSection[] = [
  {
    title: "Menus",
    items: [
      {
        title: "Ligas",
        description: "Crie e administre suas ligas",
        icon: ChampionIcon,
        href: "/settings/leagues",
        requiresOrganizer: true,
      },
      {
        title: "Notificações",
        description: "Push e central de notificações",
        icon: BellDotIcon,
        href: "/settings/notifications",
      },
      {
        title: "Pagamentos",
        description: "Receba pagamentos via PIX",
        icon: Wallet01Icon,
        href: "/settings/organization/payments" as Href,
        requiresOrganizer: true,
      },
      {
        title: "Meus pagamentos",
        description: "Cobranças, vencimentos e histórico",
        icon: Wallet01Icon,
        href: "/settings/player/payments" as Href,
        playerOnly: true,
      },
    ],
  },
];

export default function Settings() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
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
            "Não foi possível trocar o modo."
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
            "Não foi possível encerrar sua sessão."
          ),
          id: "settings-sign-out-error",
          label: "Erro ao sair",
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
        title: "Perfil da organização",
      }
    : {
        description: "Gerencie seu perfil como jogador",
        href: "/settings/player/profile",
        icon: TennisRacketIcon,
        title: "Perfil do jogador",
      };

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
        <Description>Perfil</Description>
        <ListGroup>
          <ListGroup.Item onPress={() => router.navigate(profileItem.href)}>
            <ListGroup.ItemPrefix>
              <HugeIcons icon={profileItem.icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{profileItem.title}</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                {profileItem.description}
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
        </ListGroup>
        {sections.map((section) => (
          <Fragment key={section.title}>
            <Description>{section.title}</Description>
            <ListGroup>
              {section.items
                .filter(
                  (item) =>
                    !(
                      (item.requiresOrganizer && !canShowOrganizerResources) ||
                      (item.playerOnly && isOrganizationActor)
                    )
                )
                .map((item, index) => (
                  <Fragment key={item.title}>
                    {index > 0 ? <Separator className="mx-4" /> : null}
                    <ListGroup.Item onPress={() => router.navigate(item.href)}>
                      <ListGroup.ItemPrefix>
                        <HugeIcons icon={item.icon} />
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{item.title}</ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>
                          {item.description}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix />
                    </ListGroup.Item>
                  </Fragment>
                ))}
            </ListGroup>
          </Fragment>
        ))}
        <Description>Conta</Description>
        <ListGroup>
          <ListGroup.Item
            className={handleSignOutPress.isPending ? "opacity-50" : undefined}
            disabled={handleSignOutPress.isPending}
            onPress={() => handleSignOutPress.mutate()}
          >
            <ListGroup.ItemPrefix>
              <HugeIcons className="text-danger" icon={Logout03Icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle className="text-danger">
                {handleSignOutPress.isPending ? "Saindo..." : "Sair"}
              </ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                Encerrar sessão neste dispositivo
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
        </ListGroup>
      </Page.ScrollView>
    </Page>
  );
}
