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

/**
 * O recorte do item da central que o CARTÃO desenha. É um `Pick` do item REAL
 * do contrato (`notificationFeedItemSchema`), então a tela passa a linha do feed
 * sem adaptador e a galeria dev monta fixtures no MESMO shape (IBX-0077).
 */
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
 * DESCRIÇÃO do cartão a partir do texto do servidor + as palavras-chave
 * (`presentation.bodyHighlights`, que o servidor só marca quando a palavra
 * existe MESMO no corpo).
 *
 * Sem destaque, devolve a própria string (o alerta renderiza o texto de hoje,
 * sem wrapper). Com destaque, devolve UMA linha em PARTES: o destaque é
 * `isHighlighted` e o peso é do `WidgetAlert` (o mesmo caminho aprovado no
 * IBX-0076) — a tela nunca procura palavras por conta própria, só recorta os
 * trechos que o servidor mandou.
 *
 * O corte é por `indexOf` (case-insensitive) na string ORIGINAL: sem regex, sem
 * normalizar acento, e trechos que se sobrepõem são fundidos em um só para o
 * texto sair inteiro e na ordem.
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
 * O ALVO da ação do item da central, no shape que o tradutor único
 * (`resolvePendingAction`) entende — o mesmo do item de pendência:
 *
 * - `action` é a do servidor (`presentation`), nunca inferida do `eventType`;
 * - `route` é o `data.url` que o `buildNotificationContent` sempre grava (o
 *   destino já nasce com os ids no path);
 * - `leagueId` sai do `data.leagueId` (o schema de
 *   `league.membership.approve|reject` exige a liga);
 * - `source` é a entidade de origem quando ela é a membership, o fallback do
 *   id que a ação não traz em `params`.
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

/**
 * Rótulo do item DESTRUTIVO do menu ⋮ — o único texto do cartão que não vem do
 * servidor. Escolha do usuário na rodada 2 do IBX-0077 ("Remover notificação").
 */
const REMOVE_MENU_LABEL = "Remover notificação";

/**
 * Cor do item do menu por SEMÂNTICA da ação — nunca pelo nome do `type` do
 * contrato nem pelo rótulo. O mapa é a EXCEÇÃO, não a regra: `danger` só no que
 * é recusa ou destrutivo, e TODO o resto é o `default` do componente —
 * aceitar/aprovar/confirmar, pagar/renovar e a navegação pura (rodada 4 do
 * IBX-0077, em que o usuário olhou a galeria e pediu a "cor anterior", que era
 * o neutro; o verde de sucesso da rodada 3 saiu do código).
 */
export type NotificationMenuItemTone = "danger" | "default";

function readActionTone(
  resolution: PendingActionResolution
): NotificationMenuItemTone {
  switch (resolution.kind) {
    // Recusa (o perigo).
    case "decline_challenge_cancellation":
    case "decline_challenge_proposal":
    case "reject_entry":
    case "reject_membership":
      return "danger";
    // O convite de dupla é o mesmo caminho nos dois sentidos: o `accept` manda.
    case "respond_invite":
      return resolution.accept ? "default" : "danger";
    // Aceitar/aprovar/confirmar, pagar/renovar e a navegação pura: o neutro.
    default:
      return "default";
  }
}

/**
 * UM item do menu ⋮ — a ÚNICA superfície de ação do cartão (rodada 2 do
 * IBX-0077): cada item carrega a resolução que ELE executa, nunca a do vizinho
 * (o defeito histórico do par Aprovar/Recusar não volta em forma de menu).
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
 * Os itens do menu ⋮ do cartão, na ORDEM do desenho (rodada 3, palavra do
 * usuário: *"o recusar NUNCA é em primeiro"*): a ação PRINCIPAL do servidor
 * primeiro, a secundária depois e o item destrutivo por ÚLTIMO — `Aceitar`,
 * `Recusar`, `Remover notificação`.
 *
 * ATENÇÃO: esta é a ordem do MENU e é DIFERENTE, de propósito, da ordem do
 * rodapé do ALERTA (`components/ui/widget-alert.tsx`), que desenha a secundária
 * antes da principal por causa do molde do convite do torneio. São dois desenhos
 * com réguas próprias: o alerta empilha botões (leitura da esquerda para a
 * direita, quem confirma fecha a linha) e o menu é uma lista de comandos, onde o
 * principal abre a lista.
 *
 * Ação sem resolução não entra (nunca item morto): o rótulo vem do builder de
 * apresentação e o id que falta no `data`/`params` derruba o item, como já
 * derrubava o botão. Item informativo sai só com o destrutivo.
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
