import type {
  PendingAction,
  PendingItem,
  PendingSeverity,
} from "@convex/domains/pendings/contract";

/**
 * ============================================================================
 * PENDINGS VIEW (IBX-0076 / PLN-0008)
 * ============================================================================
 *
 * O servidor é a fonte de verdade do item de pendência (kind, copy, destaque,
 * ordem, rota e AÇÃO): aqui mora SÓ o que a tela precisa decidir para
 * apresentar — o status do alerta para cada severidade, a tradução da ação do
 * contrato para a ação viva do app e o recorte dos itens que pertencem à casa
 * de cada tela.
 *
 * Nada de re-derivar severidade, ordem, texto, ação ou visibilidade no cliente
 * (o servidor devolve vazio quando o escopo não é do ator).
 */

type WidgetAlertStatus = "accent" | "danger" | "warning";

/**
 * Severidade do item → status do `WidgetAlert` (galeria aprovada): o alerta do
 * app não tem `info` no vocabulário (accent/danger/default/success/warning), e
 * os cartões aprovados mostram os itens `info` no `accent`.
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
 * O que a ação precisa saber do ITEM — o recorte comum entre o item de
 * pendência e o item da central de notificações (IBX-0077). `PendingItem`
 * satisfaz este shape sem adaptador (o `source` extra traz `type`, permitido),
 * e a notificação monta o seu: `route` = `data.url`, `leagueId` = `data.leagueId`
 * e `source` = a entidade de origem quando ela é a membership.
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
 * O que a AÇÃO do item FAZ — o ÚNICO ponto que traduz o `action` do contrato
 * (enum fechado) para uma ação viva do app: navegação pura abre o destino do
 * ITEM (`route` + `params`), o pagamento gera a cobrança com a MESMA mutation
 * das telas (`payment.charge.createCharge`) e o convite responde com a MESMA
 * mutation da casa do torneio (`tournament.entries.respondPartnerInvite`).
 *
 * No `open_route` o destino é o PAR DO ITEM: `action.params` é sempre nulo nesse
 * tipo (invariante do contrato) e entra só como override, então os `params` da
 * navegação são o merge `item.params` + `action.params` (a ação vence). Sem ler
 * o `item.params`, os CTAs de navegação (Ver/Revisar/Conectar) abriam as rotas
 * com placeholder SEM o id da entidade.
 *
 * `null` = item sem ação resolvível (sem `action`, ou `open_route` sem `route`,
 * ou ação de mutação sem o `params` que ela exige): o renderer OMITE o botão em
 * vez de desenhar botão morto. Nunca se adivinha a ação pelo `kind` nem pelo
 * rótulo, e `actionLabel` NUNCA vira `navigate(route)` cru.
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
      // A cobrança é da MESMA membership: na pendência ela é o `source` do
      // item; na notificação o id viaja em `action.params.membershipId` (o
      // item do feed não tem `source`).
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
    // `league.membership.approve|reject` exigem `{ leagueId, membershipId }`:
    // o id da membership vem da AÇÃO e a liga do item (params da pendência,
    // `data.leagueId` na notificação). Sem os dois não há botão.
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
    // `tournament.entries.approve|reject` só precisam da inscrição.
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
 * Itens que pertencem à casa de UMA liga: os que carregam o `leagueId` nos
 * `params` (desafios) e os da MESMA membership do viewer — as pendências de
 * mensalidade e de inatividade não têm rota nem params (a identidade delas é o
 * `league_membership`) e sem esta segunda chave ficariam de fora da tela da
 * liga, que é onde o membro as vê.
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
 * Itens da casa de UM torneio. O `tournamentId` viaja nos `params` na maioria
 * dos casos; a pendência de inscrição aguardando pagamento com UMA inscrição
 * (kind 4) não tem `params` nem `route` — ela registra o torneio no `source`
 * (o dado que identifica a entidade), então o recorte cai para a source quando
 * não há params. A guarda de tipo é do `source.type`: o contrato garante que o
 * único kind de escopo player com source de torneio é o 4
 * (`convex/domains/tournament/pendings-rules.ts`, `buildPlayerEntryPendings`).
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
