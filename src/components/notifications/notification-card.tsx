import { Delete02Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { Button, Menu, PressableFeedback } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { WidgetAlert } from "@/components/ui/widget-alert";
import { formatDateTimeShort } from "@/lib/format/date";
import {
  buildNotificationDescription,
  buildNotificationMenuItems,
  type NotificationCardItem,
} from "@/lib/notifications/notification-view";
import type { PendingActionResolution } from "@/lib/pendings/pendings-view";

type NotificationCardProps = {
  isActionPending?: (resolution: PendingActionResolution | null) => boolean;
  isClamped?: boolean;
  onAction?: (resolution: PendingActionResolution) => void;
  onOpen: () => void;
  onRemove: () => void;
  notification: NotificationCardItem;
  showTimestamp?: boolean;
  showUnreadMark?: boolean;
};

// O `tone` do item É o nome da variant REAL do `Menu.Item`: o componente só tem
// `default` e `danger` (`menu.types.d.ts`), então não existe variant de sucesso —
// a semântica da cor vive só no `readActionTone` do derivado.

/** O cartão da central: o layout do ALERTA sem o indicador de status e sem botão
 * no corpo — TODA ação vive no menu ⋮. */
export function NotificationCard(props: NotificationCardProps) {
  const { notification } = props;
  const menuItems = buildNotificationMenuItems(notification);
  const isUnread = !notification.isRead;
  const showMeta =
    (isUnread && props.showUnreadMark !== false) ||
    props.showTimestamp !== false;

  return (
    <View className="gap-1">
      <PressableFeedback animation={false} onPress={props.onOpen}>
        <WidgetAlert
          // 8px do `right-2` + 40px do botão `sm` = 48px = `pr-12`: sem a reserva,
          // a descrição passa por baixo do gatilho absoluto.
          contentClassName="pr-12"
          description={buildNotificationDescription({
            body: notification.body,
            bodyHighlights: notification.presentation?.bodyHighlights,
          })}
          // Título 1 linha, descrição 2 (`undefined` = sem corte no RN).
          descriptionNumberOfLines={props.isClamped === false ? undefined : 2}
          // `Alert.Indicator` é uma parte composta: omitir a parte é a única
          // forma de ficar sem ícone (não existe prop para escondê-la).
          isIndicatorHidden
          status={isUnread ? "accent" : undefined}
          title={notification.title}
          titleNumberOfLines={props.isClamped === false ? undefined : 1}
        />
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
            <Menu.Content presentation="popover" width={240}>
              {menuItems.map((item, index) => {
                if (item.kind === "remove") {
                  return (
                    <Menu.Item
                      key="remove"
                      onPress={props.onRemove}
                      variant={item.tone}
                    >
                      <Menu.ItemTitle>{item.label}</Menu.ItemTitle>
                      <HugeIcons
                        className="size-4.5 text-danger"
                        icon={Delete02Icon}
                      />
                    </Menu.Item>
                  );
                }

                return (
                  // Cada item resolve a SUA ação: o do Recusar nunca dispara a
                  // resolução do Aprovar.
                  <Menu.Item
                    isDisabled={
                      props.isActionPending?.(item.resolution) ?? false
                    }
                    key={`${index}-${item.resolution.kind}`}
                    onPress={() => {
                      props.onAction?.(item.resolution);
                    }}
                    variant={item.tone}
                  >
                    <Menu.ItemTitle>{item.label}</Menu.ItemTitle>
                  </Menu.Item>
                );
              })}
            </Menu.Content>
          </Menu.Portal>
        </Menu>
        <PressableFeedback.Highlight className="rounded-3xl" />
      </PressableFeedback>
      {showMeta ? (
        <View className="flex-row items-center gap-1.5 px-1">
          {isUnread && props.showUnreadMark !== false ? (
            <View className="size-1.5 rounded-full bg-accent" />
          ) : null}
          {props.showTimestamp === false ? null : (
            <Text color="muted" size="xs">
              {formatDateTimeShort(new Date(notification.occurredAt))}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
