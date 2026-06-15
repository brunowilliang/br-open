import {
  NOTIFICATION_EVENT_CATEGORY_IDS,
  type NotificationEventType,
  type NotificationPushCategoryId,
} from "../../shared/notifications/protocol";

export type {
  NotificationEventType,
  NotificationPushCategoryId,
} from "../../shared/notifications/protocol";

export type NotificationRecipientRole = "manager" | "player";

export type NotificationContentInput = {
  actorName?: string | null;
  eventType: NotificationEventType;
  leagueId: string;
  leagueName: string;
  metadata?: Record<string, unknown>;
  recipientRole: NotificationRecipientRole;
};

export type NotificationContent = {
  body: string;
  categoryId?: NotificationPushCategoryId;
  data: Record<string, unknown>;
  title: string;
};

type NotificationTemplate = Pick<NotificationContent, "body" | "title">;

type NotificationDefinition = {
  categoryId?: NotificationPushCategoryId;
  getUrl?: (input: NotificationContentInput) => string;
  template: (input: NotificationContentInput) => NotificationTemplate;
};

const getActorName = (actorName?: string | null) =>
  actorName?.trim() || "Um jogador";

const getLeagueUrl = (input: NotificationContentInput) =>
  `/leagues/${input.leagueId}`;

const getLeagueRequestsUrl = (input: NotificationContentInput) =>
  `/leagues/${input.leagueId}/requests`;

const getLeagueChallengesUrl = (input: NotificationContentInput) =>
  `/leagues/${input.leagueId}/challenges`;

const definitions: Record<NotificationEventType, NotificationDefinition> = {
  "league.membership.requested": {
    categoryId: NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"],
    getUrl: getLeagueRequestsUrl,
    template: (input) => ({
      title: "Nova solicitação de entrada",
      body: `${getActorName(input.actorName)} pediu para entrar na liga ${
        input.leagueName
      }.`,
    }),
  },
  "league.membership.approved": {
    template: (input) => ({
      title: "Solicitação aprovada",
      body: `Sua entrada na liga ${input.leagueName} foi aprovada.`,
    }),
  },
  "league.membership.rejected": {
    template: (input) => ({
      title: "Solicitação recusada",
      body: `Sua entrada na liga ${input.leagueName} foi recusada.`,
    }),
  },
  "league.membership.removed": {
    template: (input) => ({
      title: "Você saiu do ranking",
      body: `Seu acesso à liga ${input.leagueName} foi removido.`,
    }),
  },
  "league.challenge.created": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Novo desafio recebido",
      body: `${getActorName(input.actorName)} desafiou você na liga ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.counter_proposed": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Contraproposta recebida",
      body: `${getActorName(input.actorName)} sugeriu outro horário em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.proposal_accepted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Desafio aceito",
      body: `${getActorName(input.actorName)} aceitou o desafio em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.proposal_declined": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Desafio recusado",
      body: `${getActorName(input.actorName)} recusou o desafio em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.cancelled": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Desafio cancelado",
      body: `Um desafio da liga ${input.leagueName} foi cancelado.`,
    }),
  },
  "league.challenge.cancellation_requested": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Pedido de cancelamento",
      body: `${getActorName(input.actorName)} pediu para cancelar o desafio em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.cancellation_accepted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Cancelamento aceito",
      body: `${getActorName(input.actorName)} aceitou o cancelamento em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.cancellation_rejected": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Cancelamento recusado",
      body: `${getActorName(input.actorName)} recusou o cancelamento em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.result_submitted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Placar enviado",
      body: `${getActorName(input.actorName)} enviou o placar do desafio em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.result_confirmed": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Placar confirmado",
      body: `${getActorName(input.actorName)} confirmou o placar em ${
        input.leagueName
      }.`,
    }),
  },
  "league.challenge.result_correction_requested": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Correção de placar",
      body: `O organizador pediu correção no placar da liga ${input.leagueName}.`,
    }),
  },
  "league.challenge.result_invalidated": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Placar invalidado",
      body: `O placar do desafio em ${input.leagueName} foi invalidado.`,
    }),
  },
  "league.challenge.admin_approved": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Desafio aprovado",
      body: `O organizador aprovou o desafio em ${input.leagueName}.`,
    }),
  },
  "league.challenge.admin_rejected": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      title: "Desafio recusado",
      body: `O organizador recusou o desafio em ${input.leagueName}.`,
    }),
  },
};

function isNotificationEventType(
  eventType: string
): eventType is NotificationEventType {
  return eventType in definitions;
}

export function getNotificationPushCategoryId(eventType: string) {
  if (!isNotificationEventType(eventType)) {
    return;
  }

  return definitions[eventType].categoryId;
}

export function buildNotificationContent(
  input: NotificationContentInput
): NotificationContent {
  const definition = definitions[input.eventType];
  const template = definition.template(input);
  const url = definition.getUrl?.(input) ?? getLeagueUrl(input);

  return {
    ...template,
    ...(definition.categoryId ? { categoryId: definition.categoryId } : {}),
    data: {
      ...input.metadata,
      eventType: input.eventType,
      leagueId: input.leagueId,
      url,
    },
  };
}
