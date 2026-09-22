import type { NotificationFeedItem } from "@convex/domains/notification/contract";

import type {
  WidgetAlertDescriptionLine,
  WidgetAlertDescriptionPart,
} from "@/components/ui/widget-alert";
import {
  type PendingActionResolution,
  type PendingActionTarget,
  resolvePendingAction,
} from "@/lib/pendings/pendings-view";

/** Recorte do item da central que o cartão desenha: `Pick` do item real do contrato. */
export type NotificationCardItem = Pick<
  NotificationFeedItem,
  | "body"
  | "data"
  | "id"
  | "isRead"
  | "occurredAt"
  | "presentation"
  | "sourceEntityId"
  | "sourceEntityType"
  | "title"
>;

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Texto do servidor: a tela só recorta os `bodyHighlights`, nunca procura palavra sozinha.
 */
export function buildNotificationDescription(input: {
  body: string;
  bodyHighlights?: readonly string[] | null;
}): string | WidgetAlertDescriptionLine[] {
  const highlights = (input.bodyHighlights ?? []).filter(
    (highlight) => highlight.length > 0
  );

  if (highlights.length === 0) {
    return input.body;
  }

  const haystack = input.body.toLowerCase();
  const ranges: { end: number; start: number }[] = [];

  for (const highlight of highlights) {
    const needle = highlight.toLowerCase();
    let from = 0;
    let at = haystack.indexOf(needle, from);

    while (at !== -1) {
      ranges.push({ end: at + needle.length, start: at });
      from = at + needle.length;
      at = haystack.indexOf(needle, from);
    }
  }

  if (ranges.length === 0) {
    return input.body;
  }

  const merged: { end: number; start: number }[] = [];

  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    const last = merged.at(-1);

    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      continue;
    }

    merged.push({ ...range });
  }

  const parts: WidgetAlertDescriptionPart[] = [];
  let cursor = 0;

  for (const range of merged) {
    if (range.start > cursor) {
      parts.push({ text: input.body.slice(cursor, range.start) });
    }

    parts.push({
      isHighlighted: true,
      text: input.body.slice(range.start, range.end),
    });
    cursor = range.end;
  }

  if (cursor < input.body.length) {
    parts.push({ text: input.body.slice(cursor) });
  }

  return [{ parts }];
}

/**
 * Alvo do `resolvePendingAction`: `action` vem do servidor, nunca do `eventType`.
 */
export function getNotificationActionTarget(
  item: NotificationCardItem
): PendingActionTarget {
  return {
    action: item.presentation?.action ?? null,
    leagueId: readString(item.data.leagueId),
    params: null,
    route: readString(item.data.url),
    source:
      item.sourceEntityType === "leagueMembership" && item.sourceEntityId
        ? { id: item.sourceEntityId }
        : null,
  };
}

/** Rótulo do item destrutivo do menu ⋮ — o único texto do cartão que não é do servidor. */
const REMOVE_MENU_LABEL = "Remover notificação";

/**
 * Cor pela semântica da ação: `danger` só em recusa/destrutivo; o resto é neutro.
 */
export type NotificationMenuItemTone = "danger" | "default";

function readActionTone(
  resolution: PendingActionResolution
): NotificationMenuItemTone {
  switch (resolution.kind) {
    case "decline_challenge_cancellation":
    case "decline_challenge_proposal":
    case "reject_entry":
    case "reject_membership":
      return "danger";
    // O convite de dupla é o mesmo caminho nos dois sentidos: o `accept` manda.
    case "respond_invite":
      return resolution.accept ? "default" : "danger";
    default:
      return "default";
  }
}

/**
 * Item do menu ⋮: carrega a resolução que ELE executa, nunca a do vizinho.
 */
export type NotificationCardMenuItem =
  | {
      kind: "action";
      label: string;
      resolution: PendingActionResolution;
      tone: NotificationMenuItemTone;
    }
  | {
      kind: "remove";
      label: string;
      tone: "danger";
    };

/**
 * Menu ⋮ na ordem: principal, secundária, destrutivo — inversa à do rodapé do alerta.
 */
export function buildNotificationMenuItems(
  item: NotificationCardItem
): NotificationCardMenuItem[] {
  const presentation = item.presentation;
  const target = getNotificationActionTarget(item);
  const items: NotificationCardMenuItem[] = [];

  const primary = resolvePendingAction(target);

  if (presentation?.actionLabel && primary) {
    items.push({
      kind: "action",
      label: presentation.actionLabel,
      resolution: primary,
      tone: readActionTone(primary),
    });
  }

  const secondary = presentation?.secondaryAction
    ? resolvePendingAction({
        ...target,
        action: presentation.secondaryAction,
      })
    : null;

  if (presentation?.secondaryActionLabel && secondary) {
    items.push({
      kind: "action",
      label: presentation.secondaryActionLabel,
      resolution: secondary,
      tone: readActionTone(secondary),
    });
  }

  items.push({ kind: "remove", label: REMOVE_MENU_LABEL, tone: "danger" });

  return items;
}
