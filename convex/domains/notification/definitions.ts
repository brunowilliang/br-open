import {
  NOTIFICATION_EVENT_CATEGORY_IDS,
  type NotificationEventType,
  type NotificationPushCategoryId,
} from "../../shared/notifications/protocol";

export type {
  NotificationEventType,
  NotificationPushCategoryId,
} from "../../shared/notifications/protocol";

export type NotificationRecipientRole = "organizer" | "player";

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

// Deep-link a player-facing payment notification to the checkout screen.
// Requires `chargeId` in the notification metadata (set by the charge
// cron / webhook). Falls back to the league root when missing so old
// notifications still resolve.
const getCheckoutUrl = (input: NotificationContentInput) => {
  const chargeId =
    input.metadata && "chargeId" in input.metadata
      ? (input.metadata.chargeId as string | undefined)
      : undefined;
  if (!chargeId) {
    return getLeagueUrl(input);
  }
  return `/checkout/${chargeId}`;
};

const definitions: Record<NotificationEventType, NotificationDefinition> = {
  "league.challenge.cancellation_accepted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} aceitou o cancelamento em ${
        input.leagueName
      }.`,
      title: "Cancelamento aceito",
    }),
  },
  "league.challenge.cancellation_rejected": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} recusou o cancelamento em ${
        input.leagueName
      }.`,
      title: "Cancelamento recusado",
    }),
  },
  "league.challenge.cancellation_requested": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} pediu para cancelar o desafio em ${
        input.leagueName
      }.`,
      title: "Pedido de cancelamento",
    }),
  },
  "league.challenge.cancelled": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `Um desafio da liga ${input.leagueName} foi cancelado.`,
      title: "Desafio cancelado",
    }),
  },
  "league.challenge.counter_proposed": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} sugeriu outro horário em ${
        input.leagueName
      }.`,
      title: "Contraproposta recebida",
    }),
  },
  "league.challenge.created": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} desafiou você na liga ${
        input.leagueName
      }.`,
      title: "Novo desafio recebido",
    }),
  },
  "league.challenge.organizer_approved": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `O organizador aprovou o desafio em ${input.leagueName}.`,
      title: "Desafio aprovado",
    }),
  },
  "league.challenge.organizer_rejected": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `O organizador recusou o desafio em ${input.leagueName}.`,
      title: "Desafio recusado",
    }),
  },
  "league.challenge.proposal_accepted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} aceitou o desafio em ${
        input.leagueName
      }.`,
      title: "Desafio aceito",
    }),
  },
  "league.challenge.proposal_declined": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} recusou o desafio em ${
        input.leagueName
      }.`,
      title: "Desafio recusado",
    }),
  },
  "league.challenge.result_confirmed": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} confirmou o placar em ${
        input.leagueName
      }.`,
      title: "Placar confirmado",
    }),
  },
  "league.challenge.result_correction_requested": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `O organizador pediu correção no placar da liga ${input.leagueName}.`,
      title: "Correção de placar",
    }),
  },
  "league.challenge.result_invalidated": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `O placar do desafio em ${input.leagueName} foi invalidado.`,
      title: "Placar invalidado",
    }),
  },
  "league.challenge.result_reminder_requested": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `O organizador da liga ${input.leagueName} está aguardando o placar do seu desafio.`,
      title: "Lembrete do organizador",
    }),
  },
  "league.challenge.result_submitted": {
    getUrl: getLeagueChallengesUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} enviou o placar do desafio em ${
        input.leagueName
      }.`,
      title: "Placar enviado",
    }),
  },
  "league.membership.approved": {
    template: (input) => ({
      body: `Sua entrada na liga ${input.leagueName} foi aprovada.`,
      title: "Solicitação aprovada",
    }),
  },
  "league.membership.payment_confirmed": {
    getUrl: getLeagueUrl,
    template: (input) => ({
      body: `O pagamento da sua inscrição na liga ${input.leagueName} foi confirmado. Boa sorte!`,
      title: "Pagamento confirmado",
    }),
  },
  "league.membership.payment_due": {
    getUrl: getCheckoutUrl,
    template: (input) => ({
      body: `O pagamento da sua inscrição na liga ${input.leagueName} venceu. Pague para não ser suspenso.`,
      title: "Pagamento atrasado",
    }),
  },
  "league.membership.payment_expired": {
    getUrl: getCheckoutUrl,
    template: (input) => ({
      body: `O PIX da sua inscrição na liga ${input.leagueName} expirou. Gere um novo para concluir.`,
      title: "PIX expirado",
    }),
  },
  "league.membership.payment_refunded": {
    template: (input) => ({
      body: `A liga ${input.leagueName} atingiu o limite de jogadores enquanto você pagava. O reembolso será processado.`,
      title: "Inscrição não concluída",
    }),
  },
  "league.membership.rejected": {
    template: (input) => ({
      body: `Sua entrada na liga ${input.leagueName} foi recusada.`,
      title: "Solicitação recusada",
    }),
  },
  "league.membership.removed": {
    template: (input) => ({
      body: `Seu acesso à liga ${input.leagueName} foi removido.`,
      title: "Você saiu do ranking",
    }),
  },
  "league.membership.renewal_due": {
    getUrl: getCheckoutUrl,
    template: (input) => ({
      body: `Sua inscrição na liga ${input.leagueName} venceu. Renove para voltar a participar.`,
      title: "Inscrição vencida",
    }),
  },
  "league.membership.renewal_reminder": {
    getUrl: getCheckoutUrl,
    template: (input) => ({
      body: `Sua inscrição na liga ${input.leagueName} vence em breve. Renove para continuar participando.`,
      title: "Renovação em 3 dias",
    }),
  },
  "league.membership.requested": {
    categoryId: NOTIFICATION_EVENT_CATEGORY_IDS["league.membership.requested"],
    getUrl: getLeagueRequestsUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} pediu para entrar na liga ${
        input.leagueName
      }.`,
      title: "Nova solicitação de entrada",
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
