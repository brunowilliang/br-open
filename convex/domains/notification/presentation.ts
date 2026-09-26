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
 * Apresentacao acionavel do item da central: mapa declarativo evento -> decisao
 * + destaque do corpo. Modulo PURO (molde de `./definitions`); `null` = item
 * INFORMATIVO, e linha anterior a este campo tambem chega `null` (sem migration).
 *
 * REGRA DE PRODUTO: botao so onde existe mutation viva E gate de estado — evento
 * ja acontecido (entrada paga, convite respondido) nao ganha botao, porque
 * mentiria. Sem o id em `data` a funcao devolve `null`: item vira informativo,
 * nunca botao morto.
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

/** Le um id do `metadata`; string vazia conta como ausente. */
function readMetadataId(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = metadata?.[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

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

/** Mesmos rotulos do item de pendencia do mesmo caso (`../tournament/pendings-rules.ts`). */
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
 * Mapa declarativo evento -> decisao. Tipo ausente = INFORMATIVO (a maioria dos
 * eventos): o item cai no cartao de hoje. Tipo novo com botao entra AQUI e
 * nada mais muda no servidor.
 */
const EVENT_PRESENTATION_BUILDERS: Partial<
  Record<NotificationEventType, NotificationActionSpecBuilder>
> = {
  "tournament.entry.created": buildTournamentEntryDecision,
  "tournament.partner.invited": buildPartnerInviteDecision,
};

export const NOTIFICATION_ACTIONABLE_EVENT_TYPES = Object.keys(
  EVENT_PRESENTATION_BUILDERS
) as NotificationEventType[];

/**
 * Destaque e sempre subtrecho LITERAL do corpo renderizado (comparacao sem
 * caixa), nunca da entrada — template que formate o nome ainda gera negrito.
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
 * `bodyHighlights` e DERIVADO DO CORPO (nunca da entrada): o nome do ator entra
 * em negrito so quando o texto realmente o cita, e o trecho e o que o corpo
 * mostra. Ator ausente nao gera destaque.
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
