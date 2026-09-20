import type {
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
  | { accept: boolean; entryId: string; kind: "respond_invite" };

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
  item: PendingItem
): PendingActionResolution | null {
  const { action } = item;

  if (!action) {
    return null;
  }

  switch (action.type) {
    case "open_route":
      return item.route
        ? {
            kind: "navigate",
            params: { ...(item.params ?? {}), ...(action.params ?? {}) },
            route: item.route,
          }
        : null;
    case "pay_league_membership":
      // A cobrança é da MESMA membership do item (o tipo vem da AÇÃO).
      return { kind: "pay_membership", sourceId: item.source.id };
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
