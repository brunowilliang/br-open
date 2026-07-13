import type { ApiOutputs } from "@convex/shared/api";
import {
  BellDotIcon,
  CheckUnread01Icon,
  Delete02Icon,
  MoreVerticalIcon,
  Notification02Icon,
  PreferenceVerticalIcon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Dialog,
  ListGroup,
  Menu,
  PressableFeedback,
  Switch,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { AppState, Linking, Alert as RNAlert, View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatDateTimeShort } from "@/lib/format/date";
import {
  getPushPermissionStatusAsync,
  type NotificationPermissionStatus,
  registerForPushNotificationsAsync,
} from "@/lib/notifications/expo-notifications";
import { getNotificationFeedActionState } from "@/lib/notifications/feed-action-state";
import { shouldOpenNotificationSettingsAlert } from "@/lib/notifications/notification-permission-rules";
import {
  buildNotificationResponseDataFromFeedItem,
  isNotificationRecipientActorActive,
  type NotificationResponseActor,
  resolveNotificationResponseIntent,
} from "@/lib/notifications/response-intent";

type NotificationItem = ApiOutputs["notification"]["feed"]["list"][number];
type NotificationStatus = ApiOutputs["notification"]["settings"]["status"];
type ViewerContext = ApiOutputs["viewer"]["context"]["get"];

function getPushDescription(status?: NotificationStatus) {
  if (!status) {
    return "Verificando push neste dispositivo.";
  }

  if (!status.pushEnabled) {
    return "Pausado. As notificações ficam salvas na central.";
  }

  switch (status.readinessReason) {
    case "ready":
      return "Ativo. Você recebe alertas no dispositivo.";
    case "missing_device":
      return "Ativo, aguardando registro do dispositivo.";
    case "permission_denied":
      return "Bloqueado nas permissões do sistema.";
    case "permission_undetermined":
      return "Aguardando permissão do sistema.";
    case "preference_disabled":
      return "Pausado. As notificações ficam salvas na central.";
    default:
      return "Pausado. As notificações ficam salvas na central.";
  }
}

function NotificationRouteMenu(props: {
  isClearAllDisabled: boolean;
  isMarkAllReadDisabled: boolean;
  onClearAll: () => void;
  onMarkAllRead: () => void;
  onOpenPreferences: () => void;
}) {
  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button isIconOnly size="sm" variant="ghost">
          <HugeIcons icon={MoreVerticalIcon} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay className="bg-backdrop" />
        <Menu.Content presentation="popover">
          <Menu.Item onPress={props.onOpenPreferences}>
            <Menu.ItemTitle className="flex-none">Preferências</Menu.ItemTitle>
            <HugeIcons icon={PreferenceVerticalIcon} />
          </Menu.Item>
          <Menu.Item
            isDisabled={props.isMarkAllReadDisabled}
            onPress={props.onMarkAllRead}
          >
            <Menu.ItemTitle className="flex-none">Ler todas</Menu.ItemTitle>
            <HugeIcons icon={CheckUnread01Icon} />
          </Menu.Item>
          <Menu.Item
            isDisabled={props.isClearAllDisabled}
            onPress={props.onClearAll}
            variant="danger"
          >
            <Menu.ItemTitle className="flex-none">Apagar todas</Menu.ItemTitle>
            <HugeIcons className="text-danger" icon={Delete02Icon} />
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

function NotificationFeedItem(props: {
  notification: NotificationItem;
  onOpen: (notification: NotificationItem) => void;
  onRemove: (notification: NotificationItem) => void;
}) {
  return (
    <PressableFeedback
      animation={false}
      onPress={() => props.onOpen(props.notification)}
    >
      <Card className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            {props.notification.isRead ? null : (
              <View className="size-1.5 rounded-full bg-accent" />
            )}
            <Text
              className={
                props.notification.isRead ? "text-muted" : "text-accent"
              }
              numberOfLines={1}
              weight="semibold"
            >
              {props.notification.title}
            </Text>
          </View>
          <Text color="muted" numberOfLines={2} variant="description">
            {props.notification.body}
          </Text>
          <Text color="muted" size="xs">
            {formatDateTimeShort(new Date(props.notification.occurredAt))}
          </Text>
        </View>
        <Menu className="absolute top-2 right-2">
          <Menu.Trigger asChild>
            <Button
              isIconOnly
              onPress={(event) => {
                event.stopPropagation();
              }}
              size="sm"
              variant="ghost"
            >
              <HugeIcons className="size-4.5" icon={MoreVerticalIcon} />
            </Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay className="bg-backdrop" />
            <Menu.Content presentation="popover">
              <Menu.Item
                onPress={() => {
                  props.onRemove(props.notification);
                }}
                variant="danger"
              >
                <Menu.ItemTitle className="flex-none text-danger">
                  Remover
                </Menu.ItemTitle>
                <HugeIcons
                  className="size-4.5 text-danger"
                  icon={Delete02Icon}
                />
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
        <PressableFeedback.Highlight />
      </Card>
    </PressableFeedback>
  );
}

export default function SettingsNotificationsRoute() {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);
  const [systemPermissionStatus, setSystemPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusQuery = useQuery(
    crpc.notification.settings.status.queryOptions()
  );
  const viewerContextQuery = useQuery(crpc.viewer.context.get.queryOptions());
  const notificationsQuery = useQuery(
    crpc.notification.feed.list.queryOptions({ limit: 50 })
  );

  async function invalidateNotifications() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.notification.settings.status.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.notification.feed.list.queryFilter({ limit: 50 })
      ),
    ]);
  }

  const setPreference = useMutation(
    crpc.notification.settings.setPreference.mutationOptions({
      onSuccess: invalidateNotifications,
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar suas preferências de notificação. Tente novamente."
          ),
          id: "notification-preference-error",
          label: "Preferência não salva",
          variant: "danger",
        });
      },
    })
  );
  const upsertDevice = useMutation(
    crpc.notification.settings.upsertDevice.mutationOptions({
      onSuccess: invalidateNotifications,
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível registrar este dispositivo para push. Tente novamente."
          ),
          id: "notification-device-error",
          label: "Dispositivo não registrado",
          variant: "danger",
        });
      },
    })
  );
  const setActiveActor = useMutation(
    crpc.viewer.context.setActiveActor.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não conseguimos abrir a notificação no modo correto. Tente novamente."
          ),
          id: "notification-set-active-actor-error",
          label: "Não foi possível abrir",
          variant: "danger",
        });
      },
    })
  );
  const markRead = useMutation(
    crpc.notification.feed.markRead.mutationOptions({
      onSuccess: invalidateNotifications,
    })
  );
  const markAllRead = useMutation(
    crpc.notification.feed.markAllRead.mutationOptions({
      onSuccess: invalidateNotifications,
    })
  );
  const removeNotification = useMutation(
    crpc.notification.feed.remove.mutationOptions({
      onSuccess: invalidateNotifications,
    })
  );
  const removeAllNotifications = useMutation(
    crpc.notification.feed.removeAll.mutationOptions({
      onSuccess: invalidateNotifications,
    })
  );

  const isMutatingPush = setPreference.isPending || upsertDevice.isPending;
  const isClearPending = removeAllNotifications.isPending;
  const notificationActionState = getNotificationFeedActionState({
    notificationCount: notificationsQuery.data?.length ?? 0,
    unreadCount: statusQuery.data?.unreadCount ?? 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function refreshPermissionStatus() {
      const permissionStatus = await getPushPermissionStatusAsync();

      if (isMounted) {
        setSystemPermissionStatus(permissionStatus);
      }
    }

    refreshPermissionStatus().catch(() => undefined);

    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") {
        refreshPermissionStatus().catch(() => undefined);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  async function handleConfirmClearNotifications() {
    try {
      await removeAllNotifications.mutateAsync({});
      setIsClearDialogOpen(false);
    } catch {
      // Keep the dialog open so the user can retry after the mutation error.
    }
  }

  async function handlePushToggle(isSelected: boolean) {
    await setPreference.mutateAsync({ pushEnabled: isSelected });

    if (!isSelected) {
      return;
    }

    const registration = await registerForPushNotificationsAsync({
      requestPermission: false,
    });

    if (registration.expoPushToken) {
      await upsertDevice.mutateAsync({
        expoPushToken: registration.expoPushToken,
        permissionStatus: registration.permissionStatus,
        platform: registration.platform,
      });
      return;
    }

    toast.show({
      description:
        registration.permissionStatus === "denied"
          ? "Ative as permissões de notificação nos ajustes do sistema."
          : "Não foi possível ativar o push neste dispositivo agora.",
      id: "notification-token-missing",
      label:
        registration.permissionStatus === "denied"
          ? "Notificações bloqueadas"
          : "Push indisponível",
      variant: "warning",
    });
  }

  function handlePushRowPress() {
    if (statusQuery.isPending || isMutatingPush) {
      return;
    }

    handlePushToggle(!(statusQuery.data?.pushEnabled ?? false)).catch(
      () => undefined
    );
  }

  async function handleOpenPreferences() {
    const permissionStatus = await getPushPermissionStatusAsync();
    setSystemPermissionStatus(permissionStatus);

    if (shouldOpenNotificationSettingsAlert(permissionStatus)) {
      RNAlert.alert(
        "Notificações bloqueadas",
        "Habilite as notificações nos ajustes do app para receber push.",
        [
          { style: "cancel", text: "Cancelar" },
          {
            onPress: () => {
              Linking.openSettings().catch(() => undefined);
            },
            text: "Abrir ajustes",
          },
        ]
      );
      return;
    }

    setIsPreferencesDialogOpen(true);
  }

  async function invalidateActorContext(viewerContext?: ViewerContext) {
    if (viewerContext) {
      applyViewerContextToClientState({
        queryClient,
        viewerContext,
        viewerContextFilter: crpc.viewer.context.get.queryFilter(),
      });
    }

    await Promise.all([
      queryClient.invalidateQueries(crpc.viewer.context.get.queryFilter()),
      queryClient.invalidateQueries(
        crpc.notification.settings.status.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.notification.feed.list.queryFilter({ limit: 50 })
      ),
      queryClient.invalidateQueries(
        crpc.league.discovery.listParticipating.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.league.management.listMine.queryFilter()
      ),
    ]);
  }

  async function activateNotificationActor(actor?: NotificationResponseActor) {
    if (!actor) {
      return;
    }

    if (
      isNotificationRecipientActorActive({
        activeActor: viewerContextQuery.data?.activeActor ?? null,
        recipientActor: actor,
      })
    ) {
      return;
    }

    const viewerContext =
      actor.kind === "organization"
        ? await setActiveActor.mutateAsync({
            actorKind: "organization",
            organizationId: actor.organizationId,
          })
        : await setActiveActor.mutateAsync({ actorKind: "player" });

    await invalidateActorContext(viewerContext);
  }

  async function handleOpenNotification(notification: NotificationItem) {
    const intent = resolveNotificationResponseIntent({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      data: buildNotificationResponseDataFromFeedItem(notification),
    });

    if (intent.kind !== "open") {
      return;
    }

    await activateNotificationActor(intent.recipientActor);

    if (!notification.isRead) {
      await markRead.mutateAsync({ notificationId: notification.id });
    }

    if (intent.url) {
      router.navigate(intent.url as Href);
    }
  }

  const hasNotifications = Boolean(notificationsQuery.data?.length);
  const shouldShowNotificationSettingsAlert = systemPermissionStatus
    ? shouldOpenNotificationSettingsAlert(systemPermissionStatus)
    : false;
  const isFeedLoading = notificationsQuery.isPending;
  const isFeedError = notificationsQuery.isError;
  const isFeedEmpty = !(isFeedLoading || isFeedError || hasNotifications);

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Notificações</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <NotificationRouteMenu
            isClearAllDisabled={
              notificationActionState.isClearAllDisabled || isClearPending
            }
            isMarkAllReadDisabled={
              notificationActionState.isMarkAllReadDisabled ||
              markAllRead.isPending
            }
            onClearAll={() => {
              if (
                notificationActionState.isClearAllDisabled ||
                isClearPending
              ) {
                return;
              }

              setIsClearDialogOpen(true);
            }}
            onMarkAllRead={() => {
              if (
                notificationActionState.isMarkAllReadDisabled ||
                markAllRead.isPending
              ) {
                return;
              }

              markAllRead.mutate({});
            }}
            onOpenPreferences={() => {
              handleOpenPreferences().catch(() => undefined);
            }}
          />
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        <View className="gap-2">
          {hasNotifications ? (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Description>Central</Description>
                {statusQuery.data?.unreadCount ? (
                  <Chip color="accent" size="sm" variant="soft">
                    <Chip.Label>
                      {statusQuery.data.unreadCount} novas
                    </Chip.Label>
                  </Chip>
                ) : null}
              </View>
            </View>
          ) : null}
          {shouldShowNotificationSettingsAlert ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Notificações bloqueadas</Alert.Title>
                <Alert.Description>
                  Habilite as notificações nos ajustes do app para receber push.
                </Alert.Description>
              </Alert.Content>
              <Button
                onPress={() => {
                  Linking.openSettings().catch(() => undefined);
                }}
                size="sm"
                variant="primary"
              >
                <Button.Label>Abrir ajustes</Button.Label>
              </Button>
            </Alert>
          ) : null}
          {isFeedLoading && <LoadingState />}
          {isFeedError && (
            <ErrorState
              error={notificationsQuery.error}
              message="Não foi possível carregar as notificações."
            />
          )}
          {isFeedEmpty && (
            <EmptyState
              description="Solicitações, desafios e resultados vão aparecer aqui."
              icon={Notification02Icon}
              title="Nenhuma notificação"
            />
          )}
          {!(isFeedLoading || isFeedError || isFeedEmpty) && (
            <View className="gap-2">
              {notificationsQuery.data.map((notification) => (
                <NotificationFeedItem
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpenNotification}
                  onRemove={(nextNotification) => {
                    removeNotification.mutate({
                      notificationId: nextNotification.id,
                    });
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Page.ScrollView>

      <Dialog
        isOpen={isPreferencesDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsPreferencesDialogOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <Dialog.Close className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Preferências</Dialog.Title>
            <ListGroup variant="secondary">
              <PressableFeedback animation={false} onPress={handlePushRowPress}>
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <HugeIcons icon={BellDotIcon} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>
                      Push no dispositivo
                    </ListGroup.ItemTitle>
                    <ListGroup.ItemDescription>
                      {getPushDescription(statusQuery.data)}
                    </ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Switch
                      isDisabled={statusQuery.isPending || isMutatingPush}
                      isSelected={statusQuery.data?.pushEnabled ?? false}
                      onPress={(event) => {
                        event.stopPropagation();
                      }}
                      onSelectedChange={(isSelected) => {
                        handlePushToggle(isSelected).catch(() => undefined);
                      }}
                    />
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
                <PressableFeedback.Highlight />
              </PressableFeedback>
            </ListGroup>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog
        isOpen={isClearDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isClearPending) {
            return;
          }

          setIsClearDialogOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            {isClearPending ? null : (
              <Dialog.Close className="absolute top-4 right-4 z-100" />
            )}
            <Dialog.Title>Apagar notificações</Dialog.Title>
            <Description>
              Essa ação remove todas as notificações da central e não pode ser
              desfeita.
            </Description>

            <View className="flex-row gap-2 self-end">
              <Button
                isDisabled={isClearPending}
                onPress={() => {
                  setIsClearDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                isDisabled={isClearPending}
                onPress={() => {
                  handleConfirmClearNotifications().catch(() => undefined);
                }}
                size="sm"
                variant="danger-soft"
              >
                <Button.Label>Apagar todas</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}
