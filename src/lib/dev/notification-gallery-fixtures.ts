import {
  buildNotificationContent,
  type NotificationContentInput,
  type NotificationEventType,
} from "@convex/domains/notification/definitions";
import { buildNotificationPresentation } from "@convex/domains/notification/presentation";
import { NOTIFICATION_EVENT_TYPES } from "@convex/shared/notifications/protocol";

import type { NotificationCardItem } from "@/lib/notifications/notification-view";

/**
 * Fixtures da galeria dev do item da central: cada cartão chama os DOIS builders
 * do servidor (`buildNotificationContent` e `buildNotificationPresentation`)
 * com a MESMA entrada (`NotificationContentInput`), sem adaptador nem copy
 * digitada aqui — texto alterado no servidor aparece na galeria sem tocar neste
 * arquivo. Fixture é só o INPUT (ator, competição e os ids do emissor).
 *
 * `NOTIFICATION_GALLERY_GROUPS` cobre os 44 tipos do catálogo, um a um; um teste
 * co-localizado garante que o conjunto é EXATAMENTE o catálogo.
 */

/** Quem recebe o evento (`ORGANIZER_RECIPIENT_EVENTS` do orchestrator); todo o
 * resto resolve ator jogador. */
const ORGANIZER_EVENT_TYPES: readonly NotificationEventType[] = [
  "league.membership.requested",
  "tournament.entry.created",
];

/** Ação real de hoje por evento acionável (12 dos 44): rótulo do builder de
 * apresentação, mutation executada pelo runner de pendências. Evento fora do
 * mapa é INFORMATIVO (`buildNotificationPresentation` devolve `null`). */
export const GALLERY_ACTION_NOTES: Partial<
  Record<NotificationEventType, string>
> = {
  "league.challenge.cancellation_requested":
    "Aceitar/Recusar · league.challenges.respondCancellationRequest (gate: pedido de cancelamento aberto)",
  "league.challenge.counter_proposed":
    "Aceitar/Recusar · league.challenges.acceptProposal|declineProposal",
  "league.challenge.created":
    "Aceitar/Recusar · league.challenges.acceptProposal|declineProposal",
  "league.challenge.result_submitted":
    "Confirmar · league.challenges.confirmResult",
  "league.challenge.walkover_submitted":
    "Confirmar · league.challenges.confirmResult (mesmo caminho do W.O.)",
  "league.membership.payment_due":
    "Pagar · payment.charge.createCharge (source league_membership)",
  "league.membership.payment_expired":
    "Pagar · payment.charge.createCharge (source league_membership)",
  "league.membership.renewal_due":
    "Renovar · payment.charge.createCharge (source league_membership)",
  "league.membership.renewal_reminder":
    "Renovar · payment.charge.createCharge (source league_membership)",
  "league.membership.requested":
    "Aprovar/Recusar · league.membership.approve|reject (gate de status, BUG-0048)",
  "tournament.entry.created":
    "Aprovar/Recusar · tournament.entries.approve|reject (gate: pending_approval)",
  "tournament.partner.invited":
    "Aceitar/Recusar · tournament.entries.respondPartnerInvite (gate: pending_partner)",
};

/** Linha do template em `convex/domains/notification/definitions.ts`. */
export const GALLERY_TEMPLATE_LINES: Record<NotificationEventType, number> = {
  "league.challenge.cancellation_accepted": 130,
  "league.challenge.cancellation_rejected": 139,
  "league.challenge.cancellation_requested": 148,
  "league.challenge.cancelled": 157,
  "league.challenge.counter_proposed": 164,
  "league.challenge.created": 173,
  "league.challenge.organizer_approved": 182,
  "league.challenge.organizer_rejected": 189,
  "league.challenge.proposal_accepted": 196,
  "league.challenge.proposal_declined": 205,
  "league.challenge.result_confirmed": 214,
  "league.challenge.result_correction_requested": 223,
  "league.challenge.result_edited": 230,
  "league.challenge.result_invalidated": 237,
  "league.challenge.result_reminder_requested": 244,
  "league.challenge.result_submitted": 251,
  "league.challenge.walkover_confirmed": 260,
  "league.challenge.walkover_submitted": 269,
  "league.membership.approved": 278,
  "league.membership.payment_confirmed": 284,
  "league.membership.payment_due": 291,
  "league.membership.payment_expired": 298,
  "league.membership.payment_refunded": 305,
  "league.membership.rejected": 311,
  "league.membership.removed": 317,
  "league.membership.renewal_due": 323,
  "league.membership.renewal_reminder": 330,
  "league.membership.requested": 338,
  "tournament.bracket.placement_failed": 348,
  "tournament.bracket.published": 355,
  "tournament.cancelled": 362,
  "tournament.entry.confirmed": 369,
  "tournament.entry.created": 376,
  "tournament.entry.refund_requested": 383,
  "tournament.entry.rejected": 393,
  "tournament.finished": 400,
  "tournament.match.reassigned": 407,
  "tournament.match.rescheduled": 414,
  "tournament.match.result": 421,
  "tournament.match.result_edited": 428,
  "tournament.match.scheduled": 435,
  "tournament.partner.awaiting_reply": 442,
  "tournament.partner.invited": 449,
  "tournament.partner.responded": 456,
};

const GALLERY_EXTRA_NOTES: Partial<Record<NotificationEventType, string>> = {
  "league.membership.renewal_reminder":
    "O MESMO evento muda de texto pelo `metadata.daysLeft` que o cron reescreve todo dia (definitions.ts:98-127): as 4 variantes estão neste cartão em LabeledBlock.",
  "tournament.bracket.placement_failed":
    "Texto de ORGANIZADOR no corpo, mas o evento resolve ator JOGADOR: não está em ORGANIZER_RECIPIENT_EVENTS (orchestrator.ts:120-124). Divergência apontada no levantamento, não corrigida aqui.",
  "tournament.entry.confirmed":
    "INFORMATIVO por decisão de produto: evento pós-pagamento (a inscrição já está ativa e o charge já está PAID, um botão Pagar mentiria). O CTA de pagar do torneio vive na pendência, não no feed.",
};

/** Metadata do emissor por evento: é dela que o builder de apresentação tira os
 * ids da ação (id ausente vira INFORMATIVO, nunca botão quebrado). */
const GALLERY_METADATA: Partial<
  Record<NotificationEventType, Record<string, unknown>>
> = {
  "league.challenge.cancellation_accepted": {
    challengeId: "gallery-challenge-1",
  },
  "league.challenge.cancellation_rejected": {
    challengeId: "gallery-challenge-1",
  },
  "league.challenge.cancellation_requested": {
    challengeId: "gallery-challenge-1",
  },
  "league.challenge.cancelled": { challengeId: "gallery-challenge-1" },
  "league.challenge.counter_proposed": { challengeId: "gallery-challenge-1" },
  "league.challenge.created": { challengeId: "gallery-challenge-1" },
  "league.challenge.organizer_approved": { challengeId: "gallery-challenge-1" },
  "league.challenge.organizer_rejected": { challengeId: "gallery-challenge-1" },
  "league.challenge.proposal_accepted": { challengeId: "gallery-challenge-1" },
  "league.challenge.proposal_declined": { challengeId: "gallery-challenge-1" },
  "league.challenge.result_confirmed": { challengeId: "gallery-challenge-1" },
  "league.challenge.result_correction_requested": {
    challengeId: "gallery-challenge-1",
  },
  "league.challenge.result_edited": { challengeId: "gallery-challenge-1" },
  "league.challenge.result_invalidated": { challengeId: "gallery-challenge-1" },
  "league.challenge.result_reminder_requested": {
    challengeId: "gallery-challenge-1",
  },
  "league.challenge.result_submitted": { challengeId: "gallery-challenge-1" },
  "league.challenge.walkover_confirmed": { challengeId: "gallery-challenge-1" },
  "league.challenge.walkover_submitted": { challengeId: "gallery-challenge-1" },
  "league.membership.payment_due": {
    chargeId: "gallery-charge-1",
    membershipId: "gallery-membership-1",
  },
  "league.membership.payment_expired": {
    chargeId: "gallery-charge-1",
    membershipId: "gallery-membership-1",
  },
  "league.membership.renewal_due": {
    chargeId: "gallery-charge-1",
    membershipId: "gallery-membership-1",
  },
  "league.membership.renewal_reminder": {
    chargeId: "gallery-charge-1",
    daysLeft: 5,
    membershipId: "gallery-membership-1",
  },
  "league.membership.requested": { membershipId: "gallery-membership-1" },
  "tournament.entry.created": { entryId: "gallery-entry-1" },
  "tournament.entry.refund_requested": { reason: "category_full" },
  "tournament.partner.invited": { entryId: "gallery-entry-1" },
  "tournament.partner.responded": { accepted: true },
};

const GALLERY_LEAGUE = {
  leagueId: "gallery-league-1",
  leagueName: "Liga do Parque",
};

const GALLERY_TOURNAMENT = {
  tournamentId: "gallery-tournament-1",
  tournamentName: "Copa Dracena 8",
};

/** Ator dos exemplos: nome DECLARADO (nunca um nome de teste). */
const GALLERY_ACTOR_NAME = "Marina Costa";

/** Instante fixo do exemplo: 21/09/2026 14:32 UTC (determinístico para o QA). */
const GALLERY_OCCURRED_AT = Date.UTC(2026, 8, 21, 14, 32);

function isOrganizerNotificationEvent(eventType: NotificationEventType) {
  return ORGANIZER_EVENT_TYPES.includes(eventType);
}

/** Entrada de exemplo de UM evento, no mesmo shape que o emissor manda. */
export function buildGalleryNotificationInput(
  eventType: NotificationEventType,
  metadata?: Record<string, unknown>
): NotificationContentInput {
  const isTournament = eventType.startsWith("tournament.");

  return {
    actorName: GALLERY_ACTOR_NAME,
    eventType,
    metadata: { ...GALLERY_METADATA[eventType], ...metadata },
    recipientRole: isOrganizerNotificationEvent(eventType)
      ? "organizer"
      : "player",
    ...(isTournament ? GALLERY_TOURNAMENT : GALLERY_LEAGUE),
  };
}

/** O cartão da galeria é o componente REAL do feed: o dado tem que entrar no
 * shape do contrato (`notificationFeedItemSchema`), como o serializer manda. */
export function buildGalleryNotificationItem(
  eventType: NotificationEventType,
  input?: {
    isRead?: boolean;
    metadata?: Record<string, unknown>;
  }
): NotificationCardItem {
  const contentInput = buildGalleryNotificationInput(
    eventType,
    input?.metadata
  );
  const content = buildNotificationContent(contentInput);

  return {
    body: content.body,
    data: content.data,
    id: `gallery-${eventType}`,
    isRead: input?.isRead ?? false,
    occurredAt: GALLERY_OCCURRED_AT,
    presentation: buildNotificationPresentation(contentInput),
    sourceEntityId: null,
    sourceEntityType: null,
    title: content.title,
  };
}

export function buildGalleryNotificationNote(
  eventType: NotificationEventType
): string {
  const role = isOrganizerNotificationEvent(eventType)
    ? "organizador"
    : "jogador";
  const action = GALLERY_ACTION_NOTES[eventType];
  const parts = [
    `Copy do servidor (definitions.ts:${GALLERY_TEMPLATE_LINES[eventType]})`,
    `papel ${role}`,
    action
      ? `ACIONÁVEL · ${action} · rótulos do builder de apresentação`
      : "INFORMATIVO (sem ação no builder de apresentação)",
  ];

  if (GALLERY_EXTRA_NOTES[eventType]) {
    parts.push(GALLERY_EXTRA_NOTES[eventType] as string);
  }

  return parts.join(" · ");
}

/** Os 8 grupos na ordem da galeria — que NÃO é a ordem do catálogo: o grupo 1
 * abre em `league.membership.approved`, o catálogo em `...requested`. */
export const NOTIFICATION_GALLERY_GROUPS: {
  eventTypes: readonly NotificationEventType[];
  title: string;
}[] = [
  {
    eventTypes: [
      "league.membership.approved",
      "league.membership.rejected",
      "league.membership.removed",
      "league.membership.payment_confirmed",
      "league.membership.payment_due",
      "league.membership.payment_expired",
      "league.membership.payment_refunded",
      "league.membership.renewal_due",
      "league.membership.renewal_reminder",
    ],
    title: "Liga · entrada e mensalidade (jogador)",
  },
  {
    eventTypes: ["league.membership.requested"],
    title: "Liga · entrada e mensalidade (organizador)",
  },
  {
    eventTypes: [
      "league.challenge.created",
      "league.challenge.counter_proposed",
      "league.challenge.proposal_accepted",
      "league.challenge.proposal_declined",
      "league.challenge.cancelled",
      "league.challenge.cancellation_requested",
      "league.challenge.cancellation_accepted",
      "league.challenge.cancellation_rejected",
      "league.challenge.result_submitted",
      "league.challenge.result_confirmed",
      "league.challenge.result_edited",
      "league.challenge.result_correction_requested",
      "league.challenge.result_invalidated",
      "league.challenge.result_reminder_requested",
      "league.challenge.walkover_submitted",
      "league.challenge.walkover_confirmed",
      "league.challenge.organizer_approved",
      "league.challenge.organizer_rejected",
    ],
    title: "Liga · desafios (jogador)",
  },
  {
    eventTypes: [
      "tournament.entry.confirmed",
      "tournament.entry.rejected",
      "tournament.entry.refund_requested",
    ],
    title: "Torneio · inscrição (jogador)",
  },
  {
    eventTypes: ["tournament.entry.created"],
    title: "Torneio · inscrição (organizador)",
  },
  {
    eventTypes: [
      "tournament.partner.invited",
      "tournament.partner.responded",
      "tournament.partner.awaiting_reply",
    ],
    title: "Torneio · dupla e convite (jogador)",
  },
  {
    eventTypes: [
      "tournament.bracket.published",
      "tournament.bracket.placement_failed",
      "tournament.match.scheduled",
      "tournament.match.rescheduled",
      "tournament.match.reassigned",
      "tournament.match.result",
      "tournament.match.result_edited",
    ],
    title: "Torneio · chave e partidas (jogador)",
  },
  {
    eventTypes: ["tournament.finished", "tournament.cancelled"],
    title: "Torneio · ciclo (jogador)",
  },
];

/** Os 44 tipos na ordem em que a galeria desenha (numeração dos títulos). */
export const NOTIFICATION_GALLERY_EVENT_TYPES: readonly NotificationEventType[] =
  NOTIFICATION_GALLERY_GROUPS.flatMap((group) => group.eventTypes);

/** Catálogo do servidor, para o teste de cobertura (grupos x catálogo). */
export const NOTIFICATION_CATALOG_EVENT_TYPES = NOTIFICATION_EVENT_TYPES;

/** Variantes de texto do MESMO evento de renovação (o `daysLeft` do cron). */
export const RENEWAL_REMINDER_DAYS_LEFT_VARIANTS: readonly {
  daysLeft: null | number;
  label: string;
}[] = [
  { daysLeft: null, label: "sem contagem (linha antiga, sem `daysLeft`)" },
  { daysLeft: 0, label: "vence hoje (`daysLeft`: 0)" },
  { daysLeft: 1, label: "vence amanhã (`daysLeft`: 1)" },
  { daysLeft: 5, label: "5 dias (`daysLeft`: 5)" },
];
