import { View } from "react-native";

import { Text } from "@/components/core/text";
import { NotificationCard } from "@/components/notifications/notification-card";
import {
  LabeledBlock,
  NoticeMoldsVariants,
  VariantSection,
  noop,
} from "@/components/pages/settings/shared";
import {
  buildGalleryNotificationItem,
  buildGalleryNotificationNote,
  NOTIFICATION_GALLERY_EVENT_TYPES,
  NOTIFICATION_GALLERY_GROUPS,
} from "@/lib/dev/notification-gallery-fixtures";
import {
  buildNotificationMenuItems,
  type NotificationCardItem,
} from "@/lib/notifications/notification-view";

/**
 * Itens tirados do MESMO derivado do cartão do feed
 * (`buildNotificationMenuItems`) e na mesma régua de cor do `tone`: o que se
 * aprova aqui é o que sai na tela.
 */
function NotificationMenuAnatomy(props: {
  notification: NotificationCardItem;
}) {
  const items = buildNotificationMenuItems(props.notification);

  return (
    <LabeledBlock label="menu ⋮ (itens reais, na ordem e nas cores em que saem no cartão)">
      <View className="gap-1.5 rounded-2xl bg-surface-secondary px-3 py-2.5">
        {items.map((item, index) => (
          <View
            className="flex-row items-center gap-2"
            key={`${index}-${item.label}`}
          >
            <Text
              color={item.tone === "danger" ? "danger" : "foreground"}
              variant="body"
              weight="medium"
            >
              {`${index + 1}. ${item.label}`}
            </Text>
            <Text color="muted" size="xs">
              {item.kind === "action"
                ? `tom ${item.tone} | ${item.resolution.kind}`
                : `tom ${item.tone} | remove o item da central`}
            </Text>
          </View>
        ))}
        <Text color="muted" size="xs">
          Mapa de cor: DANGER só no que é recusa ou destrutivo (Recusar, Remover
          notificação); todo o resto é o neutro do componente (Aceitar, Aprovar,
          Pagar, Renovar e a navegação). O Menu.Item só tem as variants default
          e danger.
        </Text>
      </View>
    </LabeledBlock>
  );
}

/** Estado do item usado no cartão de estados (informativo, sem ação). */
const galleryNotificationStateItem = buildGalleryNotificationItem(
  "tournament.entry.confirmed"
);

/**
 * Cartão REAL do feed (`components/notifications/notification-card.tsx`), com a
 * copy dos dois builders do servidor; o corte de 1/2 linhas é do FEED, por isso
 * aqui entra `isClamped={false}`.
 */
export function NotificationVariantsSection() {
  return (
    <View className="gap-6">
      {NOTIFICATION_GALLERY_GROUPS.map((group) => (
        <View className="gap-6" key={group.title}>
          <Text color="muted" variant="description" weight="medium">
            {group.title}
          </Text>
          {group.eventTypes.map((eventType) => {
            const item = buildGalleryNotificationItem(eventType);
            const hasAction = buildNotificationMenuItems(item).some(
              (menuItem) => menuItem.kind === "action"
            );

            return (
              <VariantSection
                key={eventType}
                note={buildGalleryNotificationNote(eventType)}
                title={`Notificação ${
                  NOTIFICATION_GALLERY_EVENT_TYPES.indexOf(eventType) + 1
                } | ${group.title}: ${eventType}`}
              >
                <NotificationCard
                  isClamped={false}
                  notification={item}
                  onOpen={noop}
                  onRemove={noop}
                />
                {hasAction ? (
                  <View className="mt-3">
                    <NotificationMenuAnatomy notification={item} />
                  </View>
                ) : null}
              </VariantSection>
            );
          })}
        </View>
      ))}

      <VariantSection
        note="Além do alerta, o item da central pode mostrar a HORA e a MARCA de não lida (o ponto, que hoje vem junto com o título em accent). O pedido literal do usuário é o bloco a; a marca de não lida importa porque o badge da home e de Configurações conta as não lidas (notification.settings.status). O desenho final é escolha dele: o feed entra hoje com os três blocos ligados (hora e ponto), sem tirar informação que a tela já mostrava. O CORTE de texto veio de antes e segue valendo NO FEED: lá o título sai em 1 linha e a descrição em 2 (era o `numberOfLines` do item antigo, mantido igual na extração). NESTA GALERIA os cartões entram SEM corte (prop `isClamped={false}`) para a copy do servidor aparecer INTEIRA na conferência: é por isso que o texto que ele lê aqui não 'muda' — é o mesmo texto, e no feed ele aparece com reticências. Se ele quiser o texto inteiro também no feed, é só riscar aqui. O item de ação não aparece no menu ⋮ deste cartão porque o evento é informativo: aqui o menu traz só o destrutivo (Remover notificação), como em qualquer cartão informativo."
        title="Estados do item: o que vai além do alerta"
      >
        <View className="gap-4">
          <LabeledBlock label="a) só título e descrição (o pedido literal)">
            <NotificationCard
              isClamped={false}
              notification={{ ...galleryNotificationStateItem, isRead: true }}
              onOpen={noop}
              onRemove={noop}
              showTimestamp={false}
              showUnreadMark={false}
            />
          </LabeledBlock>

          <LabeledBlock label="b) com a hora">
            <NotificationCard
              isClamped={false}
              notification={{ ...galleryNotificationStateItem, isRead: true }}
              onOpen={noop}
              onRemove={noop}
              showUnreadMark={false}
            />
          </LabeledBlock>

          <LabeledBlock label="c) com a marca de não lida (ponto + título em accent)">
            <NotificationCard
              isClamped={false}
              notification={galleryNotificationStateItem}
              onOpen={noop}
              onRemove={noop}
            />
          </LabeledBlock>
        </View>
      </VariantSection>

      <NoticeMoldsVariants />
    </View>
  );
}
