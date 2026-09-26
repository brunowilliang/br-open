import type { NotificationEventType } from "../../shared/notifications/protocol";

export type { NotificationEventType } from "../../shared/notifications/protocol";

export type NotificationRecipientRole = "organizer" | "player";

/**
 * Generic notification content input. The (`tournamentId` + `tournamentName`)
 * pair identifies the source record the notification is about; both stay
 * optional at the type level so rows written without a source resolve fine
 * (`buildNotificationContent` falls back to the root URL).
 */
export type NotificationContentInput = {
  actorName?: string | null;
  eventType: NotificationEventType;
  metadata?: Record<string, unknown>;
  recipientRole: NotificationRecipientRole;
  tournamentId?: string;
  tournamentName?: string;
};

export type NotificationContent = {
  body: string;
  data: Record<string, unknown>;
  title: string;
};

type NotificationTemplate = Pick<NotificationContent, "body" | "title">;

type NotificationDefinition = {
  getUrl?: (input: NotificationContentInput) => string;
  template: (input: NotificationContentInput) => NotificationTemplate;
};

const getActorName = (actorName?: string | null) =>
  actorName?.trim() || "Um jogador";

const getTournamentUrl = (input: NotificationContentInput) =>
  `/tournaments/${input.tournamentId}`;

const definitions: Record<NotificationEventType, NotificationDefinition> = {
  "tournament.bracket.placement_failed": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `A inscrição de ${getActorName(input.actorName)} em ${input.tournamentName} confirmou, mas a chave tem ajustes manuais que impedem o encaixe automático. Sorteie a chave novamente.`,
      title: "Inscrição fora da chave",
    }),
  },
  "tournament.bracket.published": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `A chave de ${input.tournamentName} foi publicada. Confira os confrontos!`,
      title: "Chave publicada",
    }),
  },
  "tournament.cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${input.tournamentName} foi cancelado. Inscrições pagas serão estornadas.`,
      title: "Torneio cancelado",
    }),
  },
  "tournament.entry.confirmed": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Sua inscrição em ${input.tournamentName} foi confirmada. Boa sorte!`,
      title: "Inscrição confirmada",
    }),
  },
  "tournament.entry.created": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} se inscreveu em ${input.tournamentName}.`,
      title: "Nova inscrição",
    }),
  },
  "tournament.entry.refund_requested": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body:
        input.metadata?.reason === "category_full"
          ? `A categoria da sua inscrição em ${input.tournamentName} lotou. O pagamento será estornado.`
          : `A inscrição em ${input.tournamentName} foi cancelada e o estorno do pagamento foi iniciado.`,
      title: "Estorno em andamento",
    }),
  },
  "tournament.entry.rejected": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Sua inscrição em ${input.tournamentName} foi recusada.`,
      title: "Inscrição recusada",
    }),
  },
  "tournament.finished": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${input.tournamentName} terminou! Confira os campeões.`,
      title: "Torneio finalizado",
    }),
  },
  "tournament.match.reassigned": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Um confronto de ${input.tournamentName} teve as posições ajustadas pelo organizador.`,
      title: "Chave ajustada",
    }),
  },
  "tournament.match.rescheduled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Seu confronto em ${input.tournamentName} foi reagendado.`,
      title: "Confronto reagendado",
    }),
  },
  "tournament.match.result": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `O resultado do seu confronto em ${input.tournamentName} foi publicado.`,
      title: "Resultado publicado",
    }),
  },
  "tournament.match.result_edited": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `O organizador corrigiu o resultado de uma partida em ${input.tournamentName}.`,
      title: "Resultado corrigido",
    }),
  },
  "tournament.match.scheduled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Seu confronto em ${input.tournamentName} foi agendado.`,
      title: "Confronto agendado",
    }),
  },
  "tournament.partner.awaiting_reply": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Sua dupla em ${input.tournamentName} segue sem resposta do convite e o torneio está começando.`,
      title: "Convite sem resposta",
    }),
  },
  "tournament.partner.invited": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} convidou você para formar dupla em ${input.tournamentName}.`,
      title: "Convite de dupla",
    }),
  },
  "tournament.partner.responded": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} ${
        input.metadata?.accepted ? "aceitou" : "recusou"
      } o convite de dupla em ${input.tournamentName}.`,
      title: "Convite respondido",
    }),
  },
};

export function buildNotificationContent(
  input: NotificationContentInput
): NotificationContent {
  const definition = definitions[input.eventType];
  const template = definition.template(input);
  const url =
    definition.getUrl?.(input) ??
    (input.tournamentId ? getTournamentUrl(input) : "/");

  return {
    ...template,
    data: {
      ...input.metadata,
      eventType: input.eventType,
      ...(input.tournamentId ? { tournamentId: input.tournamentId } : {}),
      url,
    },
  };
}
