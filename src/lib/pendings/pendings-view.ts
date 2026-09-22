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
  | { kind: "pay_membership"; sourceId: string }
  | { kind: "pay_entry"; entryId: string }
  | { accept: boolean; entryId: string; kind: "respond_invite" }
  | { kind: "approve_membership"; leagueId: string; membershipId: string }
  | { kind: "reject_membership"; leagueId: string; membershipId: string }
  | { entryId: string; kind: "approve_entry" }
  | { entryId: string; kind: "reject_entry" }
  | { challengeId: string; kind: "accept_challenge_proposal" }
  | { challengeId: string; kind: "decline_challenge_proposal" }
  | { challengeId: string; kind: "accept_challenge_cancellation" }
  | { challengeId: string; kind: "decline_challenge_cancellation" }
  | { challengeId: string; kind: "confirm_challenge_result" };

/**
 * O recorte comum entre o item de pendência e o da central de notificações:
 * `PendingItem` satisfaz sem adaptador e a notificação monta o seu (`route` =
 * `data.url`, `leagueId` = `data.leagueId`, `source` = a membership de origem).
 */
export type PendingActionTarget = {
  action: PendingAction | null;
  /** Liga da decisão: o schema de `league.membership.approve|reject` exige. */
  leagueId?: null | string;
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
    case "pay_league_membership": {
      // A cobrança é da MESMA membership: na pendência ela é o `source`; na
      // notificação (item do feed, sem `source`) vem de `action.params.membershipId`.
      const membershipId = action.params?.membershipId ?? target.source?.id;

      return membershipId
        ? { kind: "pay_membership", sourceId: membershipId }
        : null;
    }
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
    // `league.membership.approve|reject` exigem `{ leagueId, membershipId }`: o
    // id vem da AÇÃO e a liga do item — sem os dois não há botão.
    case "approve_league_membership":
    case "reject_league_membership": {
      const membershipId = action.params?.membershipId ?? target.source?.id;
      const leagueId = target.leagueId ?? target.params?.leagueId;

      if (!(membershipId && leagueId)) {
        return null;
      }

      return action.type === "approve_league_membership"
        ? { kind: "approve_membership", leagueId, membershipId }
        : { kind: "reject_membership", leagueId, membershipId };
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
    case "accept_challenge_proposal":
    case "decline_challenge_proposal": {
      const challengeId = action.params?.challengeId;

      if (!challengeId) {
        return null;
      }

      return action.type === "accept_challenge_proposal"
        ? { challengeId, kind: "accept_challenge_proposal" }
        : { challengeId, kind: "decline_challenge_proposal" };
    }
    case "accept_challenge_cancellation":
    case "decline_challenge_cancellation": {
      const challengeId = action.params?.challengeId;

      if (!challengeId) {
        return null;
      }

      return action.type === "accept_challenge_cancellation"
        ? { challengeId, kind: "accept_challenge_cancellation" }
        : { challengeId, kind: "decline_challenge_cancellation" };
    }
    case "confirm_challenge_result": {
      const challengeId = action.params?.challengeId;

      return challengeId
        ? { challengeId, kind: "confirm_challenge_result" }
        : null;
    }
    default:
      return null;
  }
}

/**
 * Casa de UMA liga: `params.leagueId` (desafios) OU a MESMA membership do
 * viewer — mensalidade e inatividade não têm rota nem params (a identidade é o
 * `source` `league_membership`).
 */
export function resolvePendingsForLeague(input: {
  items: PendingItem[];
  leagueId: string;
  membershipId: null | string;
}): PendingItem[] {
  return input.items.filter(
    (item) =>
      item.params?.leagueId === input.leagueId ||
      (input.membershipId !== null &&
        item.source.type === "league_membership" &&
        item.source.id === input.membershipId)
  );
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
