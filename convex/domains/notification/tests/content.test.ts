import { describe, expect, it } from "bun:test";

import {
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from "../../../shared/notifications/protocol";
import { buildNotificationContent } from "../definitions";

describe("notification content", () => {
  it("builds the organizer notification for a new entry", () => {
    const content = buildNotificationContent({
      actorName: "Ana Silva",
      eventType: "tournament.entry.created",
      recipientRole: "organizer",
      tournamentId: "tournament-1",
      tournamentName: "Copa Verão",
    });

    expect(content).toEqual({
      body: "Ana Silva se inscreveu em Copa Verão.",
      data: {
        eventType: "tournament.entry.created",
        tournamentId: "tournament-1",
        url: "/tournaments/tournament-1",
      },
      title: "Nova inscrição",
    });
  });

  it("keeps custom data without losing route metadata", () => {
    const content = buildNotificationContent({
      actorName: "Bruno Garcia",
      eventType: "tournament.partner.responded",
      metadata: { accepted: true },
      recipientRole: "player",
      tournamentId: "tournament-2",
      tournamentName: "Copa Verão",
    });

    expect(content).toEqual({
      body: "Bruno Garcia aceitou o convite: a dupla em Copa Verão está fechada.",
      data: {
        accepted: true,
        eventType: "tournament.partner.responded",
        tournamentId: "tournament-2",
        url: "/tournaments/tournament-2",
      },
      title: "Convite respondido",
    });
  });

  it("agrega consequencia ou proximo passo nos avisos de torneio", () => {
    const player = (
      eventType: NotificationEventType,
      metadata?: Record<string, unknown>
    ) =>
      buildNotificationContent({
        eventType,
        metadata,
        recipientRole: "player",
        tournamentName: "Copa Verão",
      });

    // Corpo que so parafraseava o titulo virou o que MUDA para quem le.
    expect(player("tournament.bracket.published").body).toBe(
      "Os confrontos de Copa Verão já estão definidos: veja com quem você joga e a ordem das rodadas."
    );
    expect(player("tournament.cancelled").body).toBe(
      "Quem pagou inscrição em Copa Verão recebe o estorno automático: não é preciso pedir."
    );
    expect(player("tournament.entry.confirmed").body).toBe(
      "Você já está na chave de Copa Verão. Acompanhe os horários dos jogos por aqui."
    );
    expect(player("tournament.entry.rejected").body).toBe(
      "A vaga em Copa Verão voltou para a categoria. Você pode se inscrever em outra ou falar com o organizador."
    );
    expect(player("tournament.finished").body).toBe(
      "Veja o campeão e como terminou a sua campanha em Copa Verão."
    );
    expect(player("tournament.match.reassigned").body).toBe(
      "Seu próximo adversário em Copa Verão pode ter mudado: confira a chave antes de jogar."
    );
    expect(player("tournament.match.result_edited").body).toBe(
      "Confira de novo o seu confronto em Copa Verão: quem avança pode ter mudado."
    );
    expect(player("tournament.partner.awaiting_reply").body).toBe(
      "Sem a resposta, sua vaga em Copa Verão não entra na chave. Fale com quem você convidou ou cancele a inscrição."
    );
    expect(
      buildNotificationContent({
        actorName: "Marina Costa",
        eventType: "tournament.partner.responded",
        metadata: { accepted: false },
        recipientRole: "player",
        tournamentName: "Copa Verão",
      }).body
    ).toBe(
      "Marina Costa recusou o convite: a inscrição foi cancelada e as vagas voltaram."
    );
  });

  it("carrega na copy o que MUDA: horario, quadra e placar do confronto", () => {
    const scheduled = buildNotificationContent({
      eventType: "tournament.match.scheduled",
      metadata: {
        courtName: "Quadra Central",
        matchDate: "2026-09-28",
        matchId: "match-1",
        startMinute: 480,
      },
      recipientRole: "player",
      tournamentName: "Copa Verão",
    });
    const rescheduled = buildNotificationContent({
      eventType: "tournament.match.rescheduled",
      metadata: {
        matchDate: "2026-10-09",
        matchId: "match-1",
        startMinute: 690,
      },
      recipientRole: "player",
      tournamentName: "Copa Verão",
    });
    const result = buildNotificationContent({
      eventType: "tournament.match.result",
      metadata: {
        matchId: "match-1",
        sets: [
          { aGames: 6, bGames: 3, kind: "set" },
          { aGames: 7, bGames: 6, kind: "set" },
        ],
        winnerEntryId: "entry-a",
      },
      recipientRole: "player",
      tournamentName: "Copa Verão",
    });

    expect(scheduled.body).toBe(
      "Seu confronto em Copa Verão foi agendado para 28/09 às 08:00, na Quadra Central."
    );
    expect(rescheduled.body).toBe(
      "Seu confronto em Copa Verão foi reagendado para 09/10 às 11:30."
    );
    expect(result.body).toBe(
      "O resultado do seu confronto em Copa Verão foi publicado: 6-3, 7-6."
    );
    // Sem metadata a frase base continua (nenhum outro emissor destes eventos).
    expect(
      buildNotificationContent({
        eventType: "tournament.match.scheduled",
        recipientRole: "player",
        tournamentName: "Copa Verão",
      }).body
    ).toBe("Seu confronto em Copa Verão foi agendado.");
  });

  it("avisa a proposta do outro lado: horario/quadra, pedido de mudanca e placar", () => {
    const build = (
      eventType: NotificationEventType,
      metadata?: Record<string, unknown>
    ) =>
      buildNotificationContent({
        actorName: "Rafael Salles",
        eventType,
        metadata,
        recipientRole: "player",
        tournamentId: "tournament-2",
        tournamentName: "Copa Verão",
      });
    const slot = {
      courtName: "Quadra Central",
      matchDate: "2026-09-29",
      matchId: "match-1",
      startMinute: 1140,
    };
    const proposed = build("tournament.match.schedule_proposed", slot);

    expect(proposed).toEqual({
      body: "Rafael Salles propôs 29/09 às 19:00, na Quadra Central para o seu confronto em Copa Verão. Aceite ou sugira outro.",
      data: {
        ...slot,
        eventType: "tournament.match.schedule_proposed",
        tournamentId: "tournament-2",
        url: "/tournaments/tournament-2",
      },
      title: "Horário proposto pelo adversário",
    });
    // Contraproposta sobre acerto já fechado é PEDIDO DE MUDANÇA, não proposta nova.
    const reopened = build("tournament.match.schedule_proposed", {
      ...slot,
      reopened: true,
    });

    expect(reopened.title).toBe("Pedido para mudar o horário");
    expect(reopened.body).toBe(
      "Rafael Salles sugeriu 29/09 às 19:00, na Quadra Central para o seu confronto em Copa Verão. Aceite para valer o novo horário."
    );
    // Sem o horario no metadata a frase base continua de pe.
    expect(build("tournament.match.schedule_proposed").body).toBe(
      "Rafael Salles propôs um novo horário para o seu confronto em Copa Verão. Aceite ou sugira outro."
    );

    const score = build("tournament.match.score_proposed", {
      matchId: "match-1",
      sets: [{ aGames: 6, bGames: 0, kind: "set" }],
      walkover: false,
    });

    expect(score.title).toBe("Placar proposto pelo adversário");
    expect(score.body).toBe(
      "Rafael Salles propôs o placar do seu confronto em Copa Verão: 6-0. Confirme para publicar."
    );
    expect(
      build("tournament.match.score_proposed", {
        matchId: "match-1",
        sets: [],
        walkover: true,
      }).body
    ).toBe(
      "Rafael Salles propôs o W.O. do seu confronto em Copa Verão. Confirme para publicar."
    );
    // O nome de quem propos aparece UMA vez (o adversario nao entra na frase).
    expect(proposed.body.match(/Rafael Salles/g)).toHaveLength(1);
    expect(score.body.match(/Rafael Salles/g)).toHaveLength(1);

    // Pedido de mudança sobre horário já fechado tem título e verbo próprios.
    expect(
      build("tournament.match.schedule_proposed", { ...slot, reopened: true })
    ).toMatchObject({
      body: "Rafael Salles sugeriu 29/09 às 19:00, na Quadra Central para o seu confronto em Copa Verão. Aceite para valer o novo horário.",
      title: "Pedido para mudar o horário",
    });

    // RECUSA: o aviso vai para quem propôs, com o que caiu na mesa.
    const scheduleDeclined = build("tournament.match.schedule_declined", slot);

    expect(scheduleDeclined.title).toBe("Horário recusado");
    expect(scheduleDeclined.body).toBe(
      "Rafael Salles recusou 29/09 às 19:00, na Quadra Central para o seu confronto em Copa Verão. Proponha outro para destravar."
    );
    expect(build("tournament.match.schedule_declined").body).toBe(
      "Rafael Salles recusou o horário proposto para o seu confronto em Copa Verão. Proponha outro para destravar."
    );

    const scoreDeclined = build("tournament.match.score_declined", {
      matchId: "match-1",
      sets: [{ aGames: 6, bGames: 0, kind: "set" }],
      walkover: false,
    });

    expect(scoreDeclined.title).toBe("Placar recusado");
    expect(scoreDeclined.body).toBe(
      "Rafael Salles recusou o placar do seu confronto em Copa Verão: 6-0. Combine o placar antes de reenviar."
    );
    expect(
      build("tournament.match.score_declined", {
        matchId: "match-1",
        sets: [],
        walkover: true,
      }).body
    ).toBe(
      "Rafael Salles recusou o W.O. do seu confronto em Copa Verão. Combine o placar antes de reenviar."
    );
  });

  it("retirada da proposta avisa o outro lado com o que saiu da mesa", () => {
    const build = (
      eventType: NotificationEventType,
      metadata?: Record<string, unknown>
    ) =>
      buildNotificationContent({
        actorName: "Rafael Salles",
        eventType,
        metadata,
        recipientRole: "player",
        tournamentId: "tournament-2",
        tournamentName: "Copa Verão",
      });
    const slot = {
      courtName: "Quadra Central",
      matchDate: "2026-09-29",
      matchId: "match-1",
      startMinute: 1140,
    };
    const scheduleCancelled = build(
      "tournament.match.schedule_cancelled",
      slot
    );

    expect(scheduleCancelled.title).toBe("Horário retirado");
    expect(scheduleCancelled.body).toBe(
      "Rafael Salles retirou a proposta de 29/09 às 19:00, na Quadra Central para o seu confronto em Copa Verão. Proponha outro para destravar."
    );
    expect(build("tournament.match.schedule_cancelled").body).toBe(
      "Rafael Salles retirou a proposta de horário para o seu confronto em Copa Verão. Proponha outro para destravar."
    );

    const scoreCancelled = build("tournament.match.score_cancelled", {
      matchId: "match-1",
      sets: [{ aGames: 6, bGames: 0, kind: "set" }],
      walkover: false,
    });

    expect(scoreCancelled.title).toBe("Placar retirado");
    expect(scoreCancelled.body).toBe(
      "Rafael Salles retirou a proposta de placar do seu confronto em Copa Verão: 6-0. Combine o placar e proponha outro."
    );
    expect(
      build("tournament.match.score_cancelled", {
        matchId: "match-1",
        sets: [],
        walkover: true,
      }).body
    ).toBe(
      "Rafael Salles retirou a proposta de W.O. do seu confronto em Copa Verão. Combine o placar e proponha outro."
    );

    // O convite retirado encerra a espera: nao ha mais o que responder.
    expect(build("tournament.partner.invite_cancelled").body).toBe(
      "Rafael Salles cancelou o convite de dupla em Copa Verão. Você não precisa mais responder."
    );
    expect(build("tournament.partner.invite_cancelled").title).toBe(
      "Convite cancelado"
    );
  });

  it("builds content for every protocol event type", () => {
    const contents = NOTIFICATION_EVENT_TYPES.map((eventType) =>
      buildNotificationContent({
        actorName: "Bruno Garcia",
        eventType,
        recipientRole: "player",
        tournamentId: "tournament-1",
        tournamentName: "Copa Verão",
      })
    );

    expect(contents).toHaveLength(NOTIFICATION_EVENT_TYPES.length);
    expect(contents.every((content) => content.title.length > 0)).toBe(true);
    expect(contents.every((content) => content.body.length > 0)).toBe(true);
    expect(contents.map((content) => content.data.eventType)).toEqual([
      ...NOTIFICATION_EVENT_TYPES,
    ]);
  });
});

describe("avisos novos do ciclo da partida", () => {
  const base = {
    actorName: "Bruno Garcia",
    recipientRole: "player" as const,
    tournamentId: "tournament-1",
    tournamentName: "Copa Verão",
  };

  it("confronto definido cita os dois lados e a fase", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.match.ready",
      metadata: {
        sideALabel: "Bruno Willian Garcia e Rodrigo Bittencourt",
        sideBLabel: "Rafa e Dieguinho",
        stageLabel: "Semifinal",
      },
    });

    expect(content).toMatchObject({
      body: "Os dois lados estão definidos: Bruno Willian Garcia e Rodrigo Bittencourt contra Rafa e Dieguinho, Semifinal de Copa Verão. Combine o horário.",
      title: "Seu próximo jogo saiu",
    });
    // Sem matchId no metadata a url base continua valendo.
    expect(content.data.url).toBe("/tournaments/tournament-1");
  });

  it("confronto definido abre o confronto EXATO pelo matchId", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.match.ready",
      metadata: {
        matchId: "match-9",
        sideALabel: "Bruno e Rodrigo",
        sideBLabel: "Rafa e Dieguinho",
        stageLabel: "Semifinal",
      },
    });

    expect(content.data.url).toBe("/tournaments/tournament-1?matchId=match-9");
  });

  it("reembolso concluido cita o valor devolvido", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.entry.refunded",
      metadata: { amountLabel: "R$ 120,00" },
    });

    expect(content).toMatchObject({
      body: "Devolvemos R$ 120,00 da sua inscrição em Copa Verão. O PIX cai na conta que pagou.",
      title: "Reembolso concluído",
    });
  });

  it("inscricao cancelada nomeia quem cancelou e o reembolso quando houver", () => {
    const content = buildNotificationContent({
      ...base,
      actorName: "Rafa",
      eventType: "tournament.entry.cancelled",
      metadata: { refundStarted: true },
      recipientRole: "organizer",
    });

    expect(content).toMatchObject({
      body: "Rafa cancelou a inscrição em Copa Verão. O reembolso já foi iniciado. A vaga está livre.",
      title: "Inscrição cancelada",
    });

    expect(
      buildNotificationContent({
        ...base,
        actorName: "Rafa",
        eventType: "tournament.entry.cancelled",
        metadata: { refundStarted: false },
        recipientRole: "organizer",
      }).body
    ).toBe("Rafa cancelou a inscrição em Copa Verão. A vaga está livre.");
  });
});

describe("avisos de janela e cancelamento", () => {
  const base = {
    actorName: "Bruno Garcia",
    recipientRole: "player" as const,
    tournamentId: "tournament-1",
    tournamentName: "Copa Verão",
  };

  it("cancelamento leva o horário que saiu, o motivo e o confronto exato", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.match.suspended",
      metadata: {
        matchDate: "2026-10-13",
        matchId: "match-9",
        reason: "Chuva",
        startMinute: 960,
      },
    });

    expect(content.body).toBe(
      "Seu jogo do dia 13/10 às 16:00 em Copa Verão foi suspenso (motivo: Chuva). Combinem um novo horário com o outro lado."
    );
    expect(content.title).toBe("Jogo suspenso");
    expect(content.data.url).toBe("/tournaments/tournament-1?matchId=match-9");
  });

  it("cancelamento sem motivo no metadata não inventa motivo", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.match.suspended",
      metadata: { matchId: "match-9" },
    });

    expect(content.body).toBe(
      "Seu jogo em Copa Verão foi suspenso. Combinem um novo horário com o outro lado."
    );
  });

  it("torneio estendido cita o novo último dia", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.window_extended",
      metadata: { endDate: "2026-10-22" },
    });

    expect(content).toMatchObject({
      body: "O torneio foi estendido até 22/10. Os dias do novo período já podem receber jogos.",
      title: "Torneio estendido",
    });
  });

  it("janela vencida avisa o organizador com o fim e o próximo passo", () => {
    const content = buildNotificationContent({
      ...base,
      eventType: "tournament.window_expired",
      metadata: { endDate: "2026-10-20" },
      recipientRole: "organizer",
    });

    expect(content).toMatchObject({
      body: "A janela de Copa Verão vai até 20/10 e ainda tem confronto sem horário. Estenda a janela no Editar torneio.",
      title: "Fim da janela",
    });
    expect(content.data.url).toBe("/tournaments/tournament-1");
  });
});
