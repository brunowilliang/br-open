import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { HugeIcons } from "@/components/ui/huge-icons";
import { getViewerMode } from "@/lib/actors/viewer-mode";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useSignOutMutationOptions } from "@/lib/convex/auth-client";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  BellDotIcon,
  ChampionIcon,
  LockKeyIcon,
  Logout03Icon,
  TennisRacketIcon,
  ViewIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Dialog,
  ListGroup,
  PressableFeedback,
  Separator,
  Switch,
  useToast,
} from "heroui-native";
import type { ComponentProps } from "react";
import { Fragment, useState } from "react";
import { View } from "react-native";

type SettingsItem = {
  badge?: number;
  description: string;
  devOnly?: boolean;
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
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const notificationStatus = useQuery(
    crpc.notification.settings.status.staticQueryOptions()
  );
  const unreadCount = notificationStatus.data?.unreadCount ?? 0;
  const activeActor = viewerContext.data?.activeActor ?? null;
  const organizationActor = viewerContext.data?.availableActors.find(
    (actor) => actor.kind === "organization"
  );
  const isOrganizationActor = getViewerMode(activeActor) === "organization";
  const canShowOrganizerResources =
    viewerContext.data?.capabilities?.canManageOrganization ?? false;

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
    ]);
  }

  const setActiveActor = useMutation({
    mutationFn: crpcClient.viewer.context.setActiveActor.mutate,
    mutationKey: crpc.viewer.context.setActiveActor.mutationKey(),
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
  });

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
      description: "Senha, e-mail e contas vinculadas",
      href: "/settings/security" as Href,
      icon: LockKeyIcon,
      id: "security",
      title: "Login e segurança",
    },
    {
      description: "Galeria dev para aprovação de componentes",
      devOnly: true,
      href: "/settings/components",
      icon: ViewIcon,
      id: "components",
      title: "Componentes",
    },
    {
      description: "Encerrar sessão neste dispositivo",
      icon: Logout03Icon,
      id: "sign-out",
      isDisabled: handleSignOutPress.isPending,
      onPress: () => setIsSignOutDialogOpen(true),
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
        <Text color="muted" variant="description">
          Modo de uso
        </Text>
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
                  Crie e administre competições com seu clube ou academia.
                </Text>
              </Card.Body>
              <PressableFeedback.Highlight />
            </Card>
          </PressableFeedback>
        )}
        <Text color="muted" variant="description">
          Menus
        </Text>
        <ListGroup>
          {menusItems
            .filter(
              (item) =>
                !(
                  (item.requiresOrganizer && !canShowOrganizerResources) ||
                  (item.playerOnly && isOrganizationActor) ||
                  (item.devOnly && process.env.EXPO_PUBLIC_IS_DEV !== "true")
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
        <Dialog
          isOpen={isSignOutDialogOpen}
          onOpenChange={setIsSignOutDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="gap-4 p-5">
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
              <Dialog.Title>Sair</Dialog.Title>
              <Text color="muted" variant="description">
                Tem certeza que deseja sair?
              </Text>

              <View className="flex-row gap-2 self-end">
                <Button
                  onPress={() => {
                    setIsSignOutDialogOpen(false);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>Cancelar</Button.Label>
                </Button>
                <Button
                  isDisabled={handleSignOutPress.isPending}
                  onPress={() => {
                    handleSignOutPress.mutate();
                  }}
                  size="sm"
                  variant="danger-soft"
                >
                  <Button.Label>Sair</Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Page.ScrollView>
    </Page>
  );
}
