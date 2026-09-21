import type {
  NotificationPresentation,
  NotificationPresentationAction,
} from "./contract";
import {
  buildNotificationContent,
  type NotificationContentInput,
} from "./definitions";
import type { NotificationEventType } from "./definitions";

/**
 * Apresentacao acionavel do item da central (IBX-0077 / PLN-0009).
 *
 * Modulo PURO, molde de `./definitions`: sem runtime de servidor, sem `ctx`,
 * funcao deterministica do input. Ele recebe o MESMO input do
 * `buildNotificationContent` e devolve o que a tela precisa para desenhar a
 * DECISAO do item, ou `null` quando o evento e INFORMATIVO.
 *
 * Duas coisas nascem aqui e em nenhum outro lugar:
 *
 * 1. QUAIS eventos tem botao e QUAL acao cada botao executa — o mapa
 *    declarativo `EVENT_PRESENTATION_BUILDERS` abaixo. A tela nao infere acao
 *    por `eventType` (mesma regra do item de pendencias: o servidor decide).
 * 2. QUAIS palavras do corpo vao em negrito (`bodyHighlights`).
 *
 * Quem consome:
 * - `../../functions/notification/orchestrator` persiste o resultado em
 *   `notificationFeed.presentation` no ponto unico de criacao (toda linha nova
 *   ja nasce com a decisao tomada);
 * - a galeria dev do app importa ESTA funcao para montar os cartoes com os
 *   rotulos reais, sem copiar copy.
 *
 * REGRA DE PRODUTO (aprovada no IBX-0077): botao so onde existe mutation viva
 * E gate de estado que impede o botao de agir sobre coisa ja resolvida. Evento
 * que ja aconteceu (resultado confirmado, inscricao aprovada, entrada paga,
 * convite respondido) NAO ganha botao: o botao mentiria. Por isso
 * `tournament.entry.confirmed` (pos pagamento) e todos os desfechos ficam
 * informativos.
 *
 * Os ids que a acao precisa viajam em `data` (o `metadata` do emissor). Quando
 * o emissor nao manda o id, a funcao devolve `null` em vez de montar uma acao
 * quebrada: item sem id vira informativo, nunca botao morto.
 *
 * Regra dos rotulos: UMA palavra, portugues, a mesma copy dos cartoes ja
 * aprovados no IBX-0076 (`Aceitar` / `Recusar` no convite de dupla).
 */

type NotificationActionSpecInput = {
  metadata?: Record<string, unknown> | undefined;
};

type NotificationActionSpec = {
  action: NotificationPresentationAction | null;
  actionLabel: string | null;
  highlightsActorName: boolean;
  secondaryAction: NotificationPresentationAction | null;
  secondaryActionLabel: string | null;
};

type NotificationActionSpecBuilder = (
  input: NotificationActionSpecInput
) => NotificationActionSpec | null;

/**
 * Le um id do `metadata` do emissor. String vazia conta como ausente — o mesmo
 * criterio do `readString` que resolve a acao no cliente
 * (`src/lib/notifications/response-intent.ts`).
 */
function readMetadataId(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = metadata?.[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Par de botoes (principal + secundario) de UMA decisao. */
function buildDecision(input: {
  action: NotificationPresentationAction;
  actionLabel: string;
  highlightsActorName?: boolean;
  secondaryAction: NotificationPresentationAction;
  secondaryActionLabel: string;
}): NotificationActionSpec {
  return {
    action: input.action,
    actionLabel: input.actionLabel,
    highlightsActorName: input.highlightsActorName ?? false,
    secondaryAction: input.secondaryAction,
    secondaryActionLabel: input.secondaryActionLabel,
  };
}

/** Botao unico (sem par) de UMA decisao. */
function buildSingleAction(input: {
  action: NotificationPresentationAction;
  actionLabel: string;
  highlightsActorName?: boolean;
}): NotificationActionSpec {
  return {
    action: input.action,
    actionLabel: input.actionLabel,
    highlightsActorName: input.highlightsActorName ?? false,
    secondaryAction: null,
    secondaryActionLabel: null,
  };
}

/**
 * Aceitar / Recusar o desafio de `challengeId` — `acceptProposal` /
 * `declineProposal` (`../../functions/league/challenges.ts`). Vale para o
 * desafio recem criado e para a contraproposta: nos dois a decisao pendente e a
 * proposta vigente do mesmo desafio.
 */
function buildChallengeProposalDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const challengeId = readMetadataId(input.metadata, "challengeId");

  return challengeId
    ? buildDecision({
        action: { params: { challengeId }, type: "accept_challenge_proposal" },
        actionLabel: "Aceitar",
        highlightsActorName: true,
        secondaryAction: {
          params: { challengeId },
          type: "decline_challenge_proposal",
        },
        secondaryActionLabel: "Recusar",
      })
    : null;
}

/**
 * Aceitar / Recusar o pedido de cancelamento — `respondCancellationRequest`
 * (`../../functions/league/challenges.ts`).
 */
function buildChallengeCancellationDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const challengeId = readMetadataId(input.metadata, "challengeId");

  return challengeId
    ? buildDecision({
        action: {
          params: { challengeId },
          type: "accept_challenge_cancellation",
        },
        actionLabel: "Aceitar",
        highlightsActorName: true,
        secondaryAction: {
          params: { challengeId },
          type: "decline_challenge_cancellation",
        },
        secondaryActionLabel: "Recusar",
      })
    : null;
}

/**
 * Confirmar o resultado ja enviado pelo adversario — `confirmResult`
 * (`../../functions/league/challenges.ts`). O envio por W.O. pede a mesma
 * decisao, por isso os dois eventos compartilham este construtor.
 */
function buildConfirmResultDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const challengeId = readMetadataId(input.metadata, "challengeId");

  return challengeId
    ? buildSingleAction({
        action: { params: { challengeId }, type: "confirm_challenge_result" },
        actionLabel: "Confirmar",
        highlightsActorName: true,
      })
    : null;
}

/**
 * Aprovar / Recusar a solicitacao de entrada na liga — `approve` / `reject`
 * (`../../functions/league/membership.ts`), com o gate de status exigido pelo
 * BUG-0048.
 */
function buildLeagueMembershipDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const membershipId = readMetadataId(input.metadata, "membershipId");

  return membershipId
    ? buildDecision({
        action: { params: { membershipId }, type: "approve_league_membership" },
        actionLabel: "Aprovar",
        highlightsActorName: true,
        secondaryAction: {
          params: { membershipId },
          type: "reject_league_membership",
        },
        secondaryActionLabel: "Recusar",
      })
    : null;
}

/**
 * Aprovar / Recusar a inscricao no torneio — `approve` / `reject`
 * (`../../functions/tournament/entries.ts`; os dois exigem `pending_approval`).
 */
function buildTournamentEntryDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const entryId = readMetadataId(input.metadata, "entryId");

  return entryId
    ? buildDecision({
        action: { params: { entryId }, type: "approve_tournament_entry" },
        actionLabel: "Aprovar",
        highlightsActorName: true,
        secondaryAction: {
          params: { entryId },
          type: "reject_tournament_entry",
        },
        secondaryActionLabel: "Recusar",
      })
    : null;
}

/**
 * Aceitar / Recusar o convite de dupla — `respondPartnerInvite`
 * (`../../functions/tournament/entries.ts`; exige `pending_partner`). Mesmos
 * rotulos do item de pendencia do mesmo caso
 * (`../tournament/pendings-rules.ts`, kind
 * `player_tournament_partner_invite_received`).
 */
function buildPartnerInviteDecision(
  input: NotificationActionSpecInput
): NotificationActionSpec | null {
  const entryId = readMetadataId(input.metadata, "entryId");

  return entryId
    ? buildDecision({
        action: { params: { entryId }, type: "accept_partner_invite" },
        actionLabel: "Aceitar",
        highlightsActorName: true,
        secondaryAction: {
          params: { entryId },
          type: "decline_partner_invite",
        },
        secondaryActionLabel: "Recusar",
      })
    : null;
}

/**
 * Pagar / Renovar a mensalidade — `payment.charge.createCharge` com
 * `sourceType: "league_membership"`. O id viaja em `action.params.membershipId`
 * porque o item do feed nao tem `source` (a pendencia do mesmo caso le
 * `source.id`).
 *
 * `chargeId` NAO entra na acao de proposito: o `createCharge` ja reusa a
 * cobranca PENDING valida do mesmo dono, entao o botao nao gera um segundo PIX
 * nem depende de um id que pode ter expirado.
 */
function buildPayMembershipAction(
  actionLabel: "Pagar" | "Renovar"
): NotificationActionSpecBuilder {
  return (input) => {
    const membershipId = readMetadataId(input.metadata, "membershipId");

    return membershipId
      ? buildSingleAction({
          action: { params: { membershipId }, type: "pay_league_membership" },
          actionLabel,
        })
      : null;
  };
}

/**
 * Mapa declarativo: evento -> decisao. Tipo ausente = INFORMATIVO (a maioria
 * dos 44 eventos), e o item cai no cartao de hoje.
 *
 * Um lugar so. Tipo novo com botao entra AQUI e nada mais muda no servidor: o
 * orquestrador persiste o que esta funcao devolver e o serializer ja entrega o
 * campo para o app.
 */
const EVENT_PRESENTATION_BUILDERS: Partial<
  Record<NotificationEventType, NotificationActionSpecBuilder>
> = {
  "league.challenge.cancellation_requested": buildChallengeCancellationDecision,
  "league.challenge.counter_proposed": buildChallengeProposalDecision,
  "league.challenge.created": buildChallengeProposalDecision,
  "league.challenge.result_submitted": buildConfirmResultDecision,
  "league.challenge.walkover_submitted": buildConfirmResultDecision,
  "league.membership.payment_due": buildPayMembershipAction("Pagar"),
  "league.membership.payment_expired": buildPayMembershipAction("Pagar"),
  "league.membership.renewal_due": buildPayMembershipAction("Renovar"),
  "league.membership.renewal_reminder": buildPayMembershipAction("Renovar"),
  "league.membership.requested": buildLeagueMembershipDecision,
  "tournament.entry.created": buildTournamentEntryDecision,
  "tournament.partner.invited": buildPartnerInviteDecision,
};

/** Os eventos que ganham botao hoje. Derivado do mapa, nunca digitado. */
export const NOTIFICATION_ACTIONABLE_EVENT_TYPES = Object.keys(
  EVENT_PRESENTATION_BUILDERS
) as NotificationEventType[];

/**
 * Recorta do PROPRIO corpo renderizado o trecho que cita o ator, comparando sem
 * caixa. O destaque passa a ser sempre subtrecho LITERAL do texto que o app
 * mostra: um template que formate o nome (maiuscula, por exemplo) continua
 * gerando negrito, em vez de perder o destaque em silencio por a entrada ter
 * outra caixa.
 */
export function findActorNameInBody(
  body: string,
  actorName: string
): string | null {
  const pattern = actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(pattern, "i"));

  return match ? match[0] : null;
}

/**
 * Apresentacao do item, ou `null` quando o evento e informativo.
 *
 * `bodyHighlights` e DERIVADO DO CORPO (nunca da entrada): o nome do ator entra
 * em negrito somente quando o texto realmente cita esse nome, e o trecho
 * destacado e o que o corpo mostra (o dado que o destinatario precisa
 * reconhecer para decidir, a mesma regua dos cartoes aprovados no IBX-0076).
 * Ator ausente (o corpo cai no generico `Um jogador`) nao gera destaque.
 */
export function buildNotificationPresentation(
  input: NotificationContentInput
): NotificationPresentation | null {
  const buildSpec = EVENT_PRESENTATION_BUILDERS[input.eventType];

  if (!buildSpec) {
    return null;
  }

  const spec = buildSpec({ metadata: input.metadata });

  if (!spec) {
    return null;
  }

  const actorName = input.actorName?.trim() || null;
  const highlightedActorName =
    spec.highlightsActorName && actorName
      ? findActorNameInBody(buildNotificationContent(input).body, actorName)
      : null;

  return {
    action: spec.action,
    actionLabel: spec.actionLabel,
    bodyHighlights: highlightedActorName ? [highlightedActorName] : [],
    secondaryAction: spec.secondaryAction,
    secondaryActionLabel: spec.secondaryActionLabel,
  };
}
