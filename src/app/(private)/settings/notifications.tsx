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
  Button,
  Chip,
  Description,
  Dialog,
  ListGroup,
  Menu,
  PressableFeedback,
  Separator,
  Switch,
  useToast,
} from "heroui-native";
import { Fragment, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { registerForPushNotificationsAsync } from "@/lib/notifications/expo-notifications";
import { getNotificationFeedActionState } from "@/lib/notifications/feed-action-state";

type NotificationItem = ApiOutputs["notification"]["feed"]["list"][number];
type NotificationStatus = ApiOutputs["notification"]["settings"]["status"];

const NOTIFICATION_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function getPushDescription(status?: NotificationStatus) {
  if (!status) {
    return "Carregando estado deste dispositivo";
  }

  if (!status.pushEnabled) {
    return "Push desligado. A central continua registrando novas notificações.";
  }

  switch (status.readinessReason) {
    case "ready":
      return "Push ligado neste dispositivo.";
    case "missing_device":
      return "Push ligado, aguardando token deste dispositivo.";
    case "permission_denied":
      return "Push ligado, mas bloqueado nas permissões do sistema.";
    case "permission_undetermined":
      return "Push ligado, aguardando permissão do sistema.";
    case "preference_disabled":
      return "Push desligado. A central continua registrando novas notificações.";
    default:
      return "Push desligado. A central continua registrando novas notificações.";
  }
}

function getNotificationUrl(notification: NotificationItem) {
  const url = notification.data.url;

  return typeof url === "string" && url.length > 0 ? url : null;
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
        <Menu.Overlay />
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
      <ListGroup.Item disabled>
        {/* <ListGroup.ItemPrefix>
          <HugeIcons
            className={props.notification.isRead ? "text-muted" : "text-accent"}
            icon={BellDotIcon}
          />
        </ListGroup.ItemPrefix> */}
        <ListGroup.ItemContent>
          <View className="flex-row items-center gap-1">
            {props.notification.isRead ? null : (
              <View className="size-1.5 rounded-full bg-accent" />
            )}
            <ListGroup.ItemTitle
              className={
                props.notification.isRead ? "text-muted" : "text-accent"
              }
            >
              {props.notification.title}
            </ListGroup.ItemTitle>
          </View>
          <ListGroup.ItemDescription>
            {props.notification.body}
          </ListGroup.ItemDescription>
          <Text color="muted" size="xs">
            {NOTIFICATION_DATE_FORMATTER.format(
              new Date(props.notification.occurredAt)
            )}
          </Text>
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix>
          <Menu>
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
              <Menu.Overlay />
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
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

export default function SettingsNotificationsRoute() {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusQuery = useQuery(
    crpc.notification.settings.status.queryOptions()
  );
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
            "Não foi possível atualizar notificações."
          ),
          id: "notification-preference-error",
          label: "Erro nas notificações",
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
            "Não foi possível registrar este dispositivo."
          ),
          id: "notification-device-error",
          label: "Token não registrado",
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
      requestPermission: true,
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
          ? "Ative as permissões de notificação no sistema."
          : "Não foi possível obter token de push neste dispositivo.",
      id: "notification-token-missing",
      label: "Push ainda não está pronto",
      variant: "warning",
    });
  }

  async function handleOpenNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      await markRead.mutateAsync({ notificationId: notification.id });
    }

    const url = getNotificationUrl(notification);

    if (url) {
      router.navigate(url as Href);
    }
  }

  function renderFeed() {
    if (notificationsQuery.isPending) {
      return <LoadingState />;
    }

    if (notificationsQuery.isError) {
      return <ErrorState message={notificationsQuery.error.message} />;
    }

    if (notificationsQuery.data.length === 0) {
      return (
        <EmptyState
          description="Solicitações, desafios e resultados vão aparecer aqui."
          icon={Notification02Icon}
          title="Nenhuma notificação"
        />
      );
    }

    return (
      <ListGroup>
        {notificationsQuery.data.map((notification, index) => (
          <Fragment key={notification.id}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <NotificationFeedItem
              notification={notification}
              onOpen={handleOpenNotification}
              onRemove={(nextNotification) => {
                removeNotification.mutate({
                  notificationId: nextNotification.id,
                });
              }}
            />
          </Fragment>
        ))}
      </ListGroup>
    );
  }

  function renderPreferences() {
    return (
      <ListGroup>
        <ListGroup.Item>
          <ListGroup.ItemPrefix>
            <HugeIcons icon={BellDotIcon} />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Push no dispositivo</ListGroup.ItemTitle>
            <ListGroup.ItemDescription>
              {getPushDescription(statusQuery.data)}
            </ListGroup.ItemDescription>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <Switch
              isDisabled={statusQuery.isPending || isMutatingPush}
              isSelected={statusQuery.data?.pushEnabled ?? false}
              onSelectedChange={(isSelected) => {
                handlePushToggle(isSelected).catch(() => undefined);
              }}
            />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </ListGroup>
    );
  }

  function renderAllNotifications() {
    const hasNotifications = Boolean(notificationsQuery.data?.length);

    return (
      <View className="gap-2">
        {hasNotifications ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Description>Central</Description>
              {statusQuery.data?.unreadCount ? (
                <Chip color="accent" size="sm" variant="soft">
                  <Chip.Label>{statusQuery.data.unreadCount} novas</Chip.Label>
                </Chip>
              ) : null}
            </View>
          </View>
        ) : null}
        {renderFeed()}
      </View>
    );
  }

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
              setIsPreferencesDialogOpen(true);
            }}
          />
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        {renderAllNotifications()}
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
            {renderPreferences()}
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
