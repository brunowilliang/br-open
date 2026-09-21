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
  /**
   * Item do menu ⋮ desabilitado enquanto a SUA ação está em voo
   * (`usePendingActionRunner`, o mesmo runner do renderer de pendências).
   */
  isActionPending?: (resolution: PendingActionResolution | null) => boolean;
  /**
   * Corta o texto como o FEED corta: título em 1 linha e descrição em 2. `false`
   * deixa o texto INTEIRO — a galeria dev usa assim para o usuário ler a copy do
   * servidor sem ellipsis (rodada 3 do IBX-0077). O corte do feed é de antes da
   * extração (`git show HEAD:src/app/(private)/settings/notifications.tsx:143` e
   * `:149`).
   */
  isClamped?: boolean;
  /**
   * Executa a resolução do ITEM do menu (cada item entrega a sua). O dono do
   * fluxo (queries/mutations) é a tela.
   */
  onAction?: (resolution: PendingActionResolution) => void;
  onOpen: () => void;
  onRemove: () => void;
  notification: NotificationCardItem;
  /**
   * Hora do item. A central mostra hoje (default `true`); a galeria dev desenha
   * a variante sem ela para o usuário decidir o desenho (IBX-0077).
   */
  showTimestamp?: boolean;
  /**
   * Marca de NÃO LIDA (o ponto ao lado da hora). Importa porque o badge da home
   * e de Configurações conta as não lidas (`notification.settings.status`); a
   * galeria desenha a variante sem ela para o usuário decidir (IBX-0077).
   */
  showUnreadMark?: boolean;
};

/**
 * O `tone` do item É o nome da variant REAL do `Menu.Item`: o componente só tem
 * `default` e `danger` (`menu.types.d.ts`: `ItemVariant = 'default' | 'danger'`,
 * e o CSS só tem `menu__item-title--variant-default` / `--variant-danger`,
 * `menu.css:71-77`). Não existe variant de sucesso — o verde da rodada 3 saiu na
 * rodada 4 — então a semântica da cor vive num lugar só, no `readActionTone` do
 * derivado (`lib/notifications/notification-view.ts`), e aqui o `tone` entra
 * direto como `variant`, sem tabela intermediária.
 */

/**
 * O CARTÃO DA CENTRAL DE NOTIFICAÇÕES (IBX-0077 / PLN-0009): o layout do
 * ALERTA do app, SEM o indicador de status, com título e descrição (em PARTES,
 * quando o servidor manda `bodyHighlights`). O corpo NÃO tem botão — TODA ação
 * vive no menu ⋮ (rodada 2, pedido do usuário: "coloca TODOS os botões nesse
 * menu").
 *
 * Extraído do item que vivia dentro da tela
 * (`app/(private)/settings/notifications.tsx`, função local `NotificationFeedItem`)
 * para a galeria dev nascer do componente REAL, nunca de um desenho paralelo
 * (RUL-0005/0007). Comportamento preservado da tela: o toque abre a
 * notificação, o menu ⋮ remove, e há feedback de toque em toda superfície
 * tocável (RUL-0035) — o `Highlight` é o último filho e o gatilho para a
 * propagação (`stopPropagation`) para o toque nele não abrir o item.
 *
 * `isIndicatorHidden` é o mecanismo OFICIAL do `Alert` do HeroUI Native para
 * ficar sem ícone: `Alert.Indicator` é uma PARTE composta e omitir a parte é a
 * única forma (não existe prop para escondê-la) — ver o comentário do
 * componente em `components/ui/widget-alert.tsx`.
 *
 * As AÇÕES do menu vêm do servidor (`presentation.action` /
 * `secondaryAction`), traduzidas pelo ÚNICO ponto de tradução
 * (`resolvePendingAction`, via `buildNotificationMenuItems`) e executadas pela
 * tela pelo MESMO runner do renderer de pendências: item sem resolução não é
 * desenhado, nunca item morto.
 *
 * O `contentClassName` reserva a faixa do gatilho: ele é ABSOLUTO
 * (`top-2 right-2`) e, sem a reserva, o texto da descrição passaria por baixo
 * dele. O gatilho é `size="sm"` (o menor que o `Button` aceita: 40px, altura de
 * `button__root--size-sm`), então 8px do `right-2` + 40px do botão = 48px =
 * `pr-12` no conteúdo.
 *
 * A ORDEM dos itens é do derivado (`buildNotificationMenuItems`: principal,
 * secundária, destrutiva — NÃO é a ordem do rodapé do alerta) e a COR sai do
 * `tone` semântico de cada item: `danger` só no que é recusa ou destrutivo
 * (Recusar, Remover notificação) e o `default` do componente em TODO o resto
 * (Aceitar, Aprovar, Pagar, Renovar). O verde do sucesso foi tentado na rodada 3
 * e saiu na rodada 4 — ver `docs/spec/dashboard.md`.
 */
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
          contentClassName="pr-12"
          description={buildNotificationDescription({
            body: notification.body,
            bodyHighlights: notification.presentation?.bodyHighlights,
          })}
          // O MESMO corte que o item do feed tinha antes da extração
          // (`git show HEAD:src/app/(private)/settings/notifications.tsx:143` no
          // título e `:149` na descrição): título 1 linha, descrição 2. Vale
          // para os DOIS caminhos do `WidgetAlert` (string e partes). A galeria
          // passa `isClamped={false}` para o texto sair inteiro; `undefined` no
          // `numberOfLines` é o "sem corte" do RN.
          descriptionNumberOfLines={props.isClamped === false ? undefined : 2}
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
                  // resolução do Aprovar (o defeito histórico do par).
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
