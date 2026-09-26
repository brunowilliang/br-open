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
 * `NOTIFICATION_GALLERY_GROUPS` cobre os 16 tipos do catálogo, um a um; um teste
 * co-localizado garante que o conjunto é EXATAMENTE o catálogo.
 */

/** Quem recebe o evento (`ORGANIZER_RECIPIENT_EVENTS` do orchestrator); todo o
 * resto resolve ator jogador. */
const ORGANIZER_EVENT_TYPES: readonly NotificationEventType[] = [
  "tournament.entry.created",
];

/** Ação real de hoje por evento acionável (2 dos 16): rótulo do builder de
 * apresentação, mutation executada pelo runner de pendências. Evento fora do
 * mapa é INFORMATIVO (`buildNotificationPresentation` devolve `null`). */
export const GALLERY_ACTION_NOTES: Partial<
  Record<NotificationEventType, string>
> = {
  "tournament.entry.created":
    "Aprovar/Recusar · tournament.entries.approve|reject (gate: pending_approval)",
  "tournament.partner.invited":
    "Aceitar/Recusar · tournament.entries.respondPartnerInvite (gate: pending_partner)",
};

/** Linha do template em `convex/domains/notification/definitions.ts`. */
export const GALLERY_TEMPLATE_LINES: Record<NotificationEventType, number> = {
  "tournament.bracket.placement_failed": 42,
  "tournament.bracket.published": 49,
  "tournament.cancelled": 56,
  "tournament.entry.confirmed": 63,
  "tournament.entry.created": 70,
  "tournament.entry.refund_requested": 77,
  "tournament.entry.rejected": 87,
  "tournament.finished": 94,
  "tournament.match.reassigned": 101,
  "tournament.match.rescheduled": 108,
  "tournament.match.result": 115,
  "tournament.match.result_edited": 122,
  "tournament.match.scheduled": 129,
  "tournament.partner.awaiting_reply": 136,
  "tournament.partner.invited": 143,
  "tournament.partner.responded": 150,
};

const GALLERY_EXTRA_NOTES: Partial<Record<NotificationEventType, string>> = {
  "tournament.bracket.placement_failed":
    "Texto de ORGANIZADOR no corpo, mas o evento resolve ator JOGADOR: não está em ORGANIZER_RECIPIENT_EVENTS (orchestrator.ts:99-101). Divergência apontada no levantamento, não corrigida aqui.",
  "tournament.entry.confirmed":
    "INFORMATIVO por decisão de produto: evento pós-pagamento (a inscrição já está ativa e o charge já está PAID, um botão Pagar mentiria). O CTA de pagar do torneio vive na pendência, não no feed.",
};

/** Metadata do emissor por evento: é dela que o builder de apresentação tira os
 * ids da ação (id ausente vira INFORMATIVO, nunca botão quebrado). */
const GALLERY_METADATA: Partial<
  Record<NotificationEventType, Record<string, unknown>>
> = {
  "tournament.entry.created": { entryId: "gallery-entry-1" },
  "tournament.entry.refund_requested": { reason: "category_full" },
  "tournament.partner.invited": { entryId: "gallery-entry-1" },
  "tournament.partner.responded": { accepted: true },
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
  return {
    actorName: GALLERY_ACTOR_NAME,
    eventType,
    metadata: { ...GALLERY_METADATA[eventType], ...metadata },
    recipientRole: isOrganizerNotificationEvent(eventType)
      ? "organizer"
      : "player",
    ...GALLERY_TOURNAMENT,
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

/** Os 5 grupos na ordem da galeria — que NÃO é a ordem do catálogo. */
export const NOTIFICATION_GALLERY_GROUPS: {
  eventTypes: readonly NotificationEventType[];
  title: string;
}[] = [
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

/** Os 16 tipos na ordem em que a galeria desenha (numeração dos títulos). */
export const NOTIFICATION_GALLERY_EVENT_TYPES: readonly NotificationEventType[] =
  NOTIFICATION_GALLERY_GROUPS.flatMap((group) => group.eventTypes);

/** Catálogo do servidor, para o teste de cobertura (grupos x catálogo). */
export const NOTIFICATION_CATALOG_EVENT_TYPES = NOTIFICATION_EVENT_TYPES;
