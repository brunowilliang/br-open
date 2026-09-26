import type {
  PendingAction,
  PendingItem,
  PendingSeverity,
} from "@convex/domains/pendings/contract";

/**
 * O servidor é a fonte de verdade do item (kind, copy, destaque, ordem, rota e
 * AÇÃO): aqui só se decide como apresentar, nada de re-derivar no cliente.
 */

type WidgetAlertStatus = "accent" | "danger" | "warning";

/**
 * O alerta do app não tem `info`: os cartões aprovados mostram os itens `info`
 * no `accent`.
 */
export const PENDING_ALERT_STATUS = {
  danger: "danger",
  info: "accent",
  warning: "warning",
} as const satisfies Record<PendingSeverity, WidgetAlertStatus>;

/** O que o CTA do item FAZ, no vocabulário das ações vivas do app. */
export type PendingActionResolution =
  | { kind: "navigate"; params: Record<string, string>; route: string }
  | { kind: "pay_entry"; entryId: string }
  | { accept: boolean; entryId: string; kind: "respond_invite" }
  | { entryId: string; kind: "approve_entry" }
  | { entryId: string; kind: "reject_entry" };

/**
 * O recorte comum entre o item de pendência e o da central de notificações:
 * `PendingItem` satisfaz sem adaptador e a notificação monta o seu (`route` =
 * `data.url`).
 */
export type PendingActionTarget = {
  action: PendingAction | null;
  /** Params do ITEM; o merge da navegação usa estes e os da ação vence. */
  params: Record<string, string> | null;
  route: string | null;
  /** Fonte do item: de onde sai o id que a ação NÃO traz em `params`. */
  source?: { id: string } | null;
};

/**
 * Único ponto que traduz o `action` do contrato em ação viva do app; `null`
 * omite o botão (nunca botão morto). No `open_route` a navegação é o merge
 * `item.params` + `action.params` (a ação vence) — sem ele a rota abre sem o id.
 */
export function resolvePendingAction(
  target: PendingActionTarget
): PendingActionResolution | null {
  const { action } = target;

  if (!action) {
    return null;
  }

  switch (action.type) {
    case "open_route":
      return target.route
        ? {
            kind: "navigate",
            params: { ...(target.params ?? {}), ...(action.params ?? {}) },
            route: target.route,
          }
        : null;
    case "pay_tournament_entry": {
      const entryId = action.params?.entryId;

      return entryId ? { entryId, kind: "pay_entry" } : null;
    }
    case "accept_partner_invite":
    case "decline_partner_invite": {
      const entryId = action.params?.entryId;

      return entryId
        ? {
            accept: action.type === "accept_partner_invite",
            entryId,
            kind: "respond_invite",
          }
        : null;
    }
    case "approve_tournament_entry":
    case "reject_tournament_entry": {
      const entryId = action.params?.entryId;

      if (!entryId) {
        return null;
      }

      return action.type === "approve_tournament_entry"
        ? { entryId, kind: "approve_entry" }
        : { entryId, kind: "reject_entry" };
    }
    default:
      return null;
  }
}

/**
 * Casa de UM torneio: `params.tournamentId` na maioria; a inscrição aguardando
 * pagamento com UMA inscrição (kind 4) registra o torneio no `source`, então o
 * recorte cai para a source quando não há params.
 */
export function resolvePendingsForTournament(input: {
  items: PendingItem[];
  tournamentId: string;
}): PendingItem[] {
  return input.items.filter(
    (item) =>
      item.params?.tournamentId === input.tournamentId ||
      (item.source.type === "tournament" &&
        item.source.id === input.tournamentId)
  );
}
