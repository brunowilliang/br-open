import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { NotificationPresentation } from "@convex/domains/notification/contract";
import { buildNotificationContent } from "@convex/domains/notification/definitions";

import {
  buildGalleryNotificationInput,
  buildGalleryNotificationItem,
  NOTIFICATION_GALLERY_EVENT_TYPES,
} from "@/lib/dev/notification-gallery-fixtures";
import type { NotificationCardItem } from "@/lib/notifications/notification-view";
import type { PendingActionResolution } from "@/lib/pendings/pendings-view";

/**
 * WIRING do cartão: o corpo não tem botão, TODA ação vive no menu ⋮, na ordem
 * principal → secundária → destrutiva, e a cor sai do SENTIDO da ação (DANGER só
 * no que é recusa ou destrutivo; o resto é o `default` do componente).
 *
 * O erro que este teste existe para pegar é duas ações na mesma superfície com o
 * MESMO `onPress`, em que a secundária dispara a ação da principal: aqui a
 * asserção é a resolução que CADA item entrega ao runner, a ordem e a cor.
 *
 * O último caso prova a COPY: para os 44 tipos do catálogo, o que o cartão
 * desenha é o texto do servidor VERBATIM, sem reformulação.
 *
 * O repo não tem harness de render e `react-native` não parseia sob bun (Flow),
 * então os módulos são mockados ANTES do import dinâmico.
 */

const actionCalls: PendingActionResolution[] = [];
const openCalls: unknown[] = [];
const removeCalls: unknown[] = [];

mock.module("react-native", () => ({ View: (props: unknown) => props }));
mock.module("better-styled", () => ({
  cn: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
}));
mock.module("heroui-native", () => {
  const passthrough = (props: unknown) => props;

  return {
    Button: Object.assign(passthrough, { Label: passthrough }),
    Menu: Object.assign(passthrough, {
      Content: passthrough,
      Item: passthrough,
      ItemTitle: passthrough,
      Overlay: passthrough,
      Portal: passthrough,
      Trigger: passthrough,
    }),
    PressableFeedback: Object.assign(passthrough, { Highlight: passthrough }),
  };
});
mock.module("@/components/core/text", () => ({
  Text: (props: unknown) => props,
}));
mock.module("@/components/ui/huge-icons", () => ({
  HugeIcons: (props: unknown) => props,
}));
mock.module("@/components/ui/widget-alert", () => ({
  WidgetAlert: (props: unknown) => props,
}));

// Import dinâmico OBRIGATÓRIO: os `mock.module` acima precisam estar
// registrados ANTES de o módulo carregar (o import estático seria avaliado
// antes do corpo do arquivo e o componente pegaria o `react-native` real).
const { NotificationCard } = await import(
  "@/components/notifications/notification-card"
);

type CardAlert = {
  contentClassName?: string;
  description:
    | string
    | { parts: { isHighlighted?: boolean; text: string }[] }[]
    | undefined;
  descriptionNumberOfLines?: number;
  isIndicatorHidden?: boolean;
  title: string;
  titleNumberOfLines?: number;
};

type CardMenuItem = {
  isDisabled?: boolean;
  onPress?: () => void;
  variant?: string;
  children: unknown;
};

type CardMenu = {
  items: CardMenuItem[];
};

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/** O `Menu.ItemTitle` é o primeiro filho de cada item: o rótulo visível. */
function readItemLabel(item: CardMenuItem): string {
  const [title] = asArray(item.children) as {
    props: { children: string };
  }[];

  return title.props.children;
}

function buildItem(input: {
  action?: NotificationPresentation["action"];
  actionLabel?: null | string;
  bodyHighlights?: string[];
  data?: Record<string, unknown>;
  isRead?: boolean;
  secondaryAction?: NotificationPresentation["action"];
  secondaryActionLabel?: null | string;
}): NotificationCardItem {
  return {
    body: "Marina Costa pediu para entrar na liga Liga do Parque.",
    data: input.data ?? { leagueId: "league-1" },
    id: "notification-1",
    isRead: input.isRead ?? false,
    occurredAt: Date.UTC(2026, 8, 21, 14, 32),
    presentation: {
      action: input.action ?? null,
      actionLabel: input.actionLabel ?? null,
      bodyHighlights: input.bodyHighlights ?? [],
      secondaryAction: input.secondaryAction ?? null,
      secondaryActionLabel: input.secondaryActionLabel ?? null,
    },
    sourceEntityId: null,
    sourceEntityType: null,
    title: "Nova solicitação de entrada",
  };
}

/** A árvore devolvida como função: o pressable é o primeiro filho do `View` e
 * dentro dele vêm o `WidgetAlert` (0), o `Menu` (1) e o `Highlight`. */
function renderCard(input: {
  isActionPending?: (resolution: PendingActionResolution | null) => boolean;
  isClamped?: boolean;
  showTimestamp?: boolean;
  showUnreadMark?: boolean;
  item: NotificationCardItem;
}): {
  alert: CardAlert;
  menu: CardMenu;
  pressBody: () => void;
} {
  const tree = NotificationCard({
    isActionPending: input.isActionPending,
    isClamped: input.isClamped,
    notification: input.item,
    onAction: (resolution) => {
      actionCalls.push(resolution);
    },
    onOpen: () => {
      openCalls.push("open");
    },
    onRemove: () => {
      removeCalls.push("remove");
    },
    showTimestamp: input.showTimestamp,
    showUnreadMark: input.showUnreadMark,
  }) as unknown as {
    props: {
      children: {
        props: {
          children: { props: Record<string, unknown> }[];
          onPress: () => void;
        };
      }[];
    };
  };

  const pressable = tree.props.children[0].props;
  const alert = pressable.children[0].props as unknown as CardAlert;
  const menu = pressable.children[1].props as unknown as {
    children: { props: { children: { props: { children: unknown } }[] } }[];
  };

  // Menu > Portal > Content > itens do menu: os ELEMENTOS viram as props.
  const content = menu.children[1].props.children[1] as unknown as {
    props: { children: unknown };
  };

  const items = asArray(content.props.children).map((node) => {
    // O `Menu.Item` está mockado como passthrough, então as props do elemento
    // SÃO o item do menu (mesmo harness do `pending-alerts.test.tsx`).
    const itemElement = node as { props: CardMenuItem };

    return itemElement.props;
  });

  return { alert, menu: { items }, pressBody: pressable.onPress };
}

const approvePresentation = {
  action: {
    params: { membershipId: "membership-1" },
    type: "approve_league_membership",
  } as NotificationPresentation["action"],
  actionLabel: "Aprovar",
  secondaryAction: {
    params: { membershipId: "membership-1" },
    type: "reject_league_membership",
  } as NotificationPresentation["action"],
  secondaryActionLabel: "Recusar",
};

/** O par do convite de dupla: as DUAS ações caem no MESMO `kind`
 * (`respond_invite`) e o `accept` decide o sentido — é o caso que prova que a
 * cor sai da AÇÃO resolvida, não do rótulo. */
const partnerInvitePresentation = {
  action: {
    params: { entryId: "entry-1" },
    type: "accept_partner_invite",
  } as NotificationPresentation["action"],
  actionLabel: "Aceitar",
  secondaryAction: {
    params: { entryId: "entry-1" },
    type: "decline_partner_invite",
  } as NotificationPresentation["action"],
  secondaryActionLabel: "Recusar",
};

beforeEach(() => {
  actionCalls.length = 0;
  openCalls.length = 0;
  removeCalls.length = 0;
});

describe("NotificationCard", () => {
  it("drops the alert indicator (the card is the alert layout without it)", () => {
    const { alert } = renderCard({ item: buildItem({}) });

    expect(alert.isIndicatorHidden).toBe(true);
  });

  it("keeps no action on the alert body: the actions live in the menu", () => {
    const { alert } = renderCard({ item: buildItem(approvePresentation) });

    expect(alert).not.toHaveProperty("action");
    expect(alert).not.toHaveProperty("secondaryAction");
  });

  it("reserves the strip of the absolute ⋮ trigger in the content", () => {
    // O gatilho é absoluto (`top-2 right-2`, 40px no `size="sm"`): sem a
    // reserva o texto passa por baixo dele.
    const { alert } = renderCard({ item: buildItem({}) });

    expect(alert.contentClassName).toBe("pr-12");
  });

  it("clamps the text by default and leaves it whole for the gallery", () => {
    const feed = renderCard({ item: buildItem({}) });
    const gallery = renderCard({ isClamped: false, item: buildItem({}) });

    // O feed corta título em 1 linha e descrição em 2 (comportamento de antes).
    expect(feed.alert.titleNumberOfLines).toBe(1);
    expect(feed.alert.descriptionNumberOfLines).toBe(2);
    // A galeria lê a copy inteira: sem `numberOfLines` = sem corte.
    expect(gallery.alert.titleNumberOfLines).toBeUndefined();
    expect(gallery.alert.descriptionNumberOfLines).toBeUndefined();
  });

  it("lists the primary action first, the secondary after and the removal last", () => {
    const { menu } = renderCard({ item: buildItem(approvePresentation) });

    expect(menu.items.map(readItemLabel)).toEqual([
      "Aprovar",
      "Recusar",
      "Remover notificação",
    ]);
  });

  it("paints DANGER only on refusal or removal; every other action is default", () => {
    // A régua é a EXCEÇÃO, então os dois lados são provados — inclusive o par do
    // convite de dupla (mesmo `kind`: neutro no aceitar, perigo no recusar).
    const pair = renderCard({ item: buildItem(approvePresentation) });
    const invite = renderCard({ item: buildItem(partnerInvitePresentation) });
    const pay = renderCard({
      item: buildItem({
        action: {
          params: { membershipId: "membership-1" },
          type: "pay_league_membership",
        },
        actionLabel: "Pagar",
      }),
    });

    // Aprovar é neutro; Recusar e o destrutivo são as duas DANGER.
    expect(pair.menu.items.map((item) => item.variant)).toEqual([
      "default",
      "danger",
      "danger",
    ]);
    // Aceitar o convite (aceitar/confirmar) é neutro; Recusar é perigo.
    expect(invite.menu.items.map((item) => item.variant)).toEqual([
      "default",
      "danger",
      "danger",
    ]);
    // Pagar/renovar não tem tom de dinheiro: neutro, e o destrutivo fecha.
    expect(pay.menu.items.map((item) => item.variant)).toEqual([
      "default",
      "danger",
    ]);
  });

  it("dispatches each menu item's OWN action", () => {
    const { menu } = renderCard({ item: buildItem(approvePresentation) });

    menu.items[0].onPress?.();
    menu.items[1].onPress?.();
    menu.items[2].onPress?.();

    expect(actionCalls).toEqual([
      {
        kind: "approve_membership",
        leagueId: "league-1",
        membershipId: "membership-1",
      },
      {
        kind: "reject_membership",
        leagueId: "league-1",
        membershipId: "membership-1",
      },
    ]);
    // O último item é o destrutivo: ele remove, não resolve ação.
    expect(removeCalls).toEqual(["remove"]);
  });

  it("keeps the removal item as the only one for an informative notification", () => {
    const { menu } = renderCard({ item: buildItem({}) });

    expect(menu.items.map(readItemLabel)).toEqual(["Remover notificação"]);
    expect(menu.items[0].variant).toBe("danger");
  });

  it("draws no action item when the action cannot be resolved", () => {
    // Convite sem o id da inscrição: o item ficaria morto.
    const { menu } = renderCard({
      item: buildItem({
        action: { params: null, type: "accept_partner_invite" },
        actionLabel: "Aceitar",
      }),
    });

    expect(menu.items.map(readItemLabel)).toEqual(["Remover notificação"]);
  });

  it("disables only the item whose action is in flight", () => {
    const { menu } = renderCard({
      isActionPending: (resolution) =>
        resolution?.kind === "approve_membership",
      item: buildItem(approvePresentation),
    });

    // Aprovar, Recusar, Remover notificação.
    expect(menu.items[0].isDisabled).toBe(true);
    expect(menu.items[1].isDisabled).toBe(false);
    expect(menu.items[2].isDisabled).toBeUndefined();
  });

  it("highlights the keyword the server sent, in parts", () => {
    const { alert } = renderCard({
      item: buildItem({ bodyHighlights: ["Marina Costa"] }),
    });

    expect(alert.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Marina Costa" },
          { text: " pediu para entrar na liga Liga do Parque." },
        ],
      },
    ]);
  });

  it("opens the notification from the card body", () => {
    const { pressBody } = renderCard({ item: buildItem({}) });

    pressBody();

    expect(openCalls).toEqual(["open"]);
  });

  it("renders the server copy VERBATIM for all 44 event types", () => {
    // O que o cartão desenha é o `title`/`body` do `buildNotificationContent`
    // para a MESMA entrada que gerou o item. O corte do feed é ellipsis de
    // RENDER (`numberOfLines`), não perda de caractere.
    const mismatches: string[] = [];

    for (const eventType of NOTIFICATION_GALLERY_EVENT_TYPES) {
      const content = buildNotificationContent(
        buildGalleryNotificationInput(eventType)
      );
      const { alert } = renderCard({
        item: buildGalleryNotificationItem(eventType),
      });

      const rendered =
        typeof alert.description === "string"
          ? alert.description
          : (alert.description ?? [])
              .map((line) => line.parts.map((part) => part.text).join(""))
              .join("\n");

      if (alert.title !== content.title) {
        mismatches.push(
          `${eventType}: título "${alert.title}" != "${content.title}"`
        );
      }

      if (rendered !== content.body) {
        mismatches.push(
          `${eventType}: descrição "${rendered}" != "${content.body}"`
        );
      }
    }

    expect(NOTIFICATION_GALLERY_EVENT_TYPES).toHaveLength(44);
    expect(mismatches).toEqual([]);
  });
});
