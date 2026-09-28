import {
  formatMatchMonthDay,
  formatMatchScoreLabel,
  formatMatchSlotLabel,
} from "../match/labels";
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

/**
 * O aviso de confronto leva o id DELE na url: o toque cai no confronto exato,
 * nao na casa do torneio. Sem o id, a url base continua valendo.
 */
const getMatchUrl = (input: NotificationContentInput) => {
  const matchId = input.metadata?.matchId;

  return typeof matchId === "string" && matchId.length > 0
    ? `${getTournamentUrl(input)}?matchId=${matchId}`
    : getTournamentUrl(input);
};

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
      body: `Os confrontos de ${input.tournamentName} já estão definidos: veja com quem você joga e a ordem das rodadas.`,
      title: "Chave publicada",
    }),
  },
  "tournament.cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Quem pagou inscrição em ${input.tournamentName} recebe o estorno automático: não é preciso pedir.`,
      title: "Torneio cancelado",
    }),
  },
  "tournament.entry.cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} cancelou a inscrição em ${input.tournamentName}.${
        input.metadata?.refundStarted ? " O reembolso já foi iniciado." : ""
      } A vaga está livre.`,
      title: "Inscrição cancelada",
    }),
  },
  "tournament.entry.confirmed": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Você já está na chave de ${input.tournamentName}. Acompanhe os horários dos jogos por aqui.`,
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
  "tournament.entry.refunded": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Devolvemos ${input.metadata?.amountLabel ?? "o valor"} da sua inscrição em ${input.tournamentName}. O PIX cai na conta que pagou.`,
      title: "Reembolso concluído",
    }),
  },
  "tournament.entry.rejected": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `A vaga em ${input.tournamentName} voltou para a categoria. Você pode se inscrever em outra ou falar com o organizador.`,
      title: "Inscrição recusada",
    }),
  },
  "tournament.finished": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Veja o campeão e como terminou a sua campanha em ${input.tournamentName}.`,
      title: "Torneio finalizado",
    }),
  },
  "tournament.match.ready": {
    getUrl: getMatchUrl,
    template: (input) => ({
      body: `Os dois lados estão definidos: ${input.metadata?.sideALabel ?? "um lado"} contra ${input.metadata?.sideBLabel ?? "o outro"}, ${
        input.metadata?.stageLabel ?? "no confronto"
      } de ${input.tournamentName}. Combine o horário.`,
      title: "Seu próximo jogo saiu",
    }),
  },
  "tournament.match.reassigned": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Seu próximo adversário em ${input.tournamentName} pode ter mudado: confira a chave antes de jogar.`,
      title: "Chave ajustada",
    }),
  },
  "tournament.match.rescheduled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Seu confronto em ${input.tournamentName} foi reagendado${matchScheduleTail(input.metadata)}.`,
      title: "Confronto reagendado",
    }),
  },
  "tournament.match.result": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `O resultado do seu confronto em ${input.tournamentName} foi publicado${matchScoreTail(input.metadata)}.`,
      title: "Resultado publicado",
    }),
  },
  "tournament.match.result_edited": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Confira de novo o seu confronto em ${input.tournamentName}: quem avança pode ter mudado.`,
      title: "Resultado corrigido",
    }),
  },
  "tournament.match.schedule_cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} retirou a proposta de ${matchSlotLabel(input.metadata) || "horário"} para o seu confronto em ${input.tournamentName}. Proponha outro para destravar.`,
      title: "Horário retirado",
    }),
  },
  "tournament.match.schedule_declined": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} recusou ${matchSlotLabel(input.metadata) || "o horário proposto"} para o seu confronto em ${input.tournamentName}. Proponha outro para destravar.`,
      title: "Horário recusado",
    }),
  },
  "tournament.match.schedule_proposed": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: input.metadata?.reopened
        ? `${getActorName(input.actorName)} sugeriu ${matchSlotLabel(input.metadata) || "um novo horário"} para o seu confronto em ${input.tournamentName}. Aceite para valer o novo horário.`
        : `${getActorName(input.actorName)} propôs ${matchSlotLabel(input.metadata) || "um novo horário"} para o seu confronto em ${input.tournamentName}. Aceite ou sugira outro.`,
      title: input.metadata?.reopened
        ? "Pedido para mudar o horário"
        : "Horário proposto pelo adversário",
    }),
  },
  "tournament.match.scheduled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Seu confronto em ${input.tournamentName} foi agendado${matchScheduleTail(input.metadata)}.`,
      title: "Confronto agendado",
    }),
  },
  "tournament.match.score_cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: input.metadata?.walkover
        ? `${getActorName(input.actorName)} retirou a proposta de W.O. do seu confronto em ${input.tournamentName}. Combine o placar e proponha outro.`
        : `${getActorName(input.actorName)} retirou a proposta de placar do seu confronto em ${input.tournamentName}${matchScoreTail(input.metadata)}. Combine o placar e proponha outro.`,
      title: "Placar retirado",
    }),
  },
  "tournament.match.score_declined": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: input.metadata?.walkover
        ? `${getActorName(input.actorName)} recusou o W.O. do seu confronto em ${input.tournamentName}. Combine o placar antes de reenviar.`
        : `${getActorName(input.actorName)} recusou o placar do seu confronto em ${input.tournamentName}${matchScoreTail(input.metadata)}. Combine o placar antes de reenviar.`,
      title: "Placar recusado",
    }),
  },
  "tournament.match.score_proposed": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: input.metadata?.walkover
        ? `${getActorName(input.actorName)} propôs o W.O. do seu confronto em ${input.tournamentName}. Confirme para publicar.`
        : `${getActorName(input.actorName)} propôs o placar do seu confronto em ${input.tournamentName}${matchScoreTail(input.metadata)}. Confirme para publicar.`,
      title: "Placar proposto pelo adversário",
    }),
  },
  "tournament.match.suspended": {
    getUrl: getMatchUrl,
    template: (input) => ({
      body: `Seu jogo${matchSuspensionSlotTail(input.metadata)} em ${input.tournamentName} foi suspenso${suspensionReasonTail(input.metadata)}. Combinem um novo horário com o outro lado.`,
      title: "Jogo suspenso",
    }),
  },
  "tournament.partner.awaiting_reply": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `Sem a resposta, sua vaga em ${input.tournamentName} não entra na chave. Fale com quem você convidou ou cancele a inscrição.`,
      title: "Convite sem resposta",
    }),
  },
  "tournament.partner.invite_cancelled": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: `${getActorName(input.actorName)} cancelou o convite de dupla em ${input.tournamentName}. Você não precisa mais responder.`,
      title: "Convite cancelado",
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
        input.metadata?.accepted
          ? `aceitou o convite: a dupla em ${input.tournamentName} está fechada.`
          : "recusou o convite: a inscrição foi cancelada e as vagas voltaram."
      }`,
      title: "Convite respondido",
    }),
  },
  "tournament.window_expired": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: windowEndLabel(input.metadata)
        ? `A janela de ${input.tournamentName} vai até ${windowEndLabel(input.metadata)} e ainda tem confronto sem horário. Estenda a janela no Editar torneio.`
        : `A janela de ${input.tournamentName} acabou e ainda tem confronto sem horário. Estenda a janela no Editar torneio.`,
      title: "Fim da janela",
    }),
  },
  "tournament.window_extended": {
    getUrl: getTournamentUrl,
    template: (input) => ({
      body: windowEndLabel(input.metadata)
        ? `O torneio foi estendido até ${windowEndLabel(input.metadata)}. Os dias do novo período já podem receber jogos.`
        : "O torneio foi estendido. Os dias do novo período já podem receber jogos.",
      title: "Torneio estendido",
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

/** Rótulo do horário na mesa: "28/09 às 08:00, na Quadra Central". Vazio sem data/hora no
 * metadata (a frase volta ao texto base). */
function matchSlotLabel(metadata?: Record<string, unknown>) {
  const matchDate =
    typeof metadata?.matchDate === "string" ? metadata.matchDate : null;
  const startMinute =
    typeof metadata?.startMinute === "number" ? metadata.startMinute : null;

  if (!(matchDate && startMinute !== null)) {
    return "";
  }

  const courtName =
    typeof metadata?.courtName === "string" && metadata.courtName
      ? `, na ${metadata.courtName}`
      : "";

  return `${formatMatchSlotLabel({ matchDate, startMinute })}${courtName}`;
}

/**
 * Cauda do aviso de agendamento: " para 28/09 às 08:00, na Quadra Central".
 * Vazia quando o emissor nao mandou data/hora (a frase volta ao texto base).
 */
function matchScheduleTail(metadata?: Record<string, unknown>) {
  const label = matchSlotLabel(metadata);

  return label ? ` para ${label}` : "";
}

/** Cauda do aviso de resultado: ": 6-3, 6-2"; vazia sem placar no metadata. */
function matchScoreTail(metadata?: Record<string, unknown>) {
  const sets = Array.isArray(metadata?.sets) ? metadata.sets : null;

  if (!sets || sets.length === 0) {
    return "";
  }

  const label = formatMatchScoreLabel(
    sets as { aGames: number; bGames: number }[]
  );

  return label ? `: ${label}` : "";
}

/** " do dia 13/10 às 16:00" no cancelamento; vazio sem data/hora no metadata. */
function matchSuspensionSlotTail(metadata?: Record<string, unknown>) {
  const label = matchSlotLabel(metadata);

  return label ? ` do dia ${label}` : "";
}

/** " (motivo: Chuva)" no aviso de cancelamento; vazio sem motivo. */
function suspensionReasonTail(metadata?: Record<string, unknown>) {
  const reason =
    typeof metadata?.reason === "string" ? metadata.reason.trim() : "";

  return reason ? ` (motivo: ${reason})` : "";
}

/** "22/10" a partir do dia de fim no metadata; nulo sem a data. */
function windowEndLabel(metadata?: Record<string, unknown>) {
  const endDate = metadata?.endDate;

  return typeof endDate === "string" && endDate
    ? formatMatchMonthDay(endDate)
    : null;
}
