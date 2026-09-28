import { describe, expect, it } from "bun:test";

import {
  buildOrganizerAgreementPendings,
  buildOrganizerConclusionPendings,
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  buildPlayerMatchAgreementPendings,
  formatOpponentSideLabel,
  type TournamentEntryPendingView,
  type TournamentMatchAgreementPendingView,
  type TournamentOrganizerAgreementPendingView,
  type TournamentOrganizerConclusionPendingView,
  type TournamentOrganizerPendingView,
} from "../pendings-rules";

const DEADLINE_MS = Date.parse("2026-09-25T03:00:00.000Z");

function entryView(
  overrides: Partial<TournamentEntryPendingView> & { entryId: string }
): TournamentEntryPendingView {
  return {
    categoryDisplayName: "Duplas Mistas",
    entryFeeCents: 4000,
    invitedName: "Gustavo Lima",
    inviterName: "Marina Costa",
    isCreator: true,
    isInvited: false,
    registrationDeadlineAtMs: DEADLINE_MS,
    status: "pending_partner",
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  };
}

describe("pendencia do jogador: convite de dupla", () => {
  it("convidado ve status info com as DUAS acoes aprovadas (cartao 5)", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-5", isCreator: false, isInvited: true }),
      ],
    });

    expect(item?.kind).toBe("player_tournament_partner_invite_received");
    expect(item?.id).toBe("player_tournament_partner_invite_received:entry-5");
    expect(item?.severity).toBe("info");
    expect(item?.title).toBe("Convite de dupla aguardando sua resposta");
    expect(item?.actionLabel).toBe("Aceitar");
    expect(item?.action).toEqual({
      params: { entryId: "entry-5" },
      type: "accept_partner_invite",
    });
    expect(item?.secondaryAction).toEqual({
      params: { entryId: "entry-5" },
      type: "decline_partner_invite",
    });
    expect(item?.secondaryActionLabel).toBe("Recusar");
    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Marina Costa" },
          {
            text: " convidou você para jogar Duplas Mistas na Copa Dracena 8.",
          },
        ],
      },
    ]);
    // A acao do convite e uma MUTACAO (responder): o ALVO e action.params.
    // Route/params do item sao CONTEXTO da entidade — o recorte da casa do
    // torneio le o params.tournamentId, e sem ele o convite sumia da tela.
    expect(item?.route).toBe("/tournaments/[tournamentId]");
    expect(item?.params).toEqual({ tournamentId: "tournament-1" });
    expect(item?.moneyCents).toBe(4000);
    expect(item?.deadlineAt).toBe(DEADLINE_MS);
    expect(item?.source).toEqual({ id: "entry-5", type: "tournament_entry" });
  });

  it("criador ve o convite ENVIADO sem acao e com o convidado no destaque (cartao 6)", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [entryView({ entryId: "entry-6" })],
    });

    expect(item?.kind).toBe("player_tournament_partner_invite_sent");
    expect(item?.severity).toBe("info");
    expect(item?.title).toBe("Convite de dupla enviado");
    expect(item?.action).toBeNull();
    expect(item?.actionLabel).toBeNull();
    expect(item?.secondaryAction).toBeNull();
    expect(item?.secondaryActionLabel).toBeNull();
    expect(item?.route).toBe("/tournaments/[tournamentId]");
    expect(item?.params).toEqual({ tournamentId: "tournament-1" });
    expect(item?.description).toEqual([
      {
        parts: [
          { text: "Aguardando " },
          { isHighlighted: true, text: "Gustavo Lima" },
          {
            text: " aceitar o convite para Duplas Mistas na Copa Dracena 8.",
          },
        ],
      },
    ]);
  });
});

describe("pendencia do jogador: inscricao aguardando pagamento (cartao 4)", () => {
  it("agrega as inscricoes do MESMO torneio em UM item com a contagem", () => {
    const items = buildPlayerEntryPendings({
      entries: [
        entryView({
          categoryDisplayName: "Simples Masculino",
          entryFeeCents: 3000,
          entryId: "entry-a",
          status: "awaiting_payment",
        }),
        entryView({
          categoryDisplayName: "Duplas Masculinas",
          entryFeeCents: 5000,
          entryId: "entry-b",
          status: "awaiting_payment",
        }),
        entryView({
          categoryDisplayName: "Duplas Mistas",
          entryFeeCents: 4000,
          entryId: "entry-c",
          registrationDeadlineAtMs: DEADLINE_MS - 86_400_000,
          status: "awaiting_payment",
        }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("player_tournament_entries_awaiting_payment");
    expect(items[0]?.id).toBe(
      "player_tournament_entries_awaiting_payment:tournament-1"
    );
    expect(items[0]?.count).toBe(3);
    expect(items[0]?.title).toBe("3 inscrições aguardando pagamento");
    expect(items[0]?.severity).toBe("warning");
    expect(items[0]?.description).toBe(
      "Confirme o pagamento para garantir sua vaga na chave."
    );
    expect(items[0]?.actionLabel).toBe("Pagar");
    // N inscricoes de torneios/categorias diferentes no MESMO item: nao ha
    // pagamento unico, entao a acao e abrir a casa do torneio.
    expect(items[0]?.action).toEqual({ params: null, type: "open_route" });
    expect(items[0]?.moneyCents).toBe(12_000);
    expect(items[0]?.deadlineAt).toBe(DEADLINE_MS - 86_400_000);
    expect(items[0]?.source).toEqual({
      id: "tournament-1",
      type: "tournament",
    });
  });

  it("uma inscricao so usa o titulo no singular", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [entryView({ entryId: "entry-1", status: "awaiting_payment" })],
    });

    expect(item?.count).toBe(1);
    expect(item?.title).toBe("1 inscrição aguardando pagamento");
  });

  it("agrega por torneio, nunca entre torneios diferentes", () => {
    const items = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-1", status: "awaiting_payment" }),
        entryView({
          entryId: "entry-2",
          status: "awaiting_payment",
          tournamentId: "tournament-2",
          tournamentName: "Copa Vila",
        }),
      ],
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.count)).toEqual([1, 1]);
  });

  it("inscricao de SIMPLES aguardando pagamento entra mesmo sem parceiro", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [
        entryView({
          categoryDisplayName: "Simples Masculino",
          entryId: "entry-simples",
          invitedName: "",
          status: "awaiting_payment",
        }),
      ],
    });

    expect(item?.kind).toBe("player_tournament_entries_awaiting_payment");
    expect(item?.count).toBe(1);
    expect(item?.moneyCents).toBe(4000);
  });

  it("convite sem o nome de quem convidou nao vira item", () => {
    expect(
      buildPlayerEntryPendings({
        entries: [
          entryView({
            entryId: "entry-sem-nome",
            inviterName: "",
            isCreator: false,
            isInvited: true,
          }),
        ],
      })
    ).toEqual([]);
  });

  it("convite enviado sem o nome do convidado nao vira item", () => {
    expect(
      buildPlayerEntryPendings({
        entries: [entryView({ entryId: "entry-8", invitedName: "" })],
      })
    ).toEqual([]);
  });

  it("os tres kinds de inscricao carregam a CASA do torneio como contexto", () => {
    const items = buildPlayerEntryPendings({
      entries: [
        entryView({ entryId: "entry-1", isCreator: false, isInvited: true }),
        entryView({ entryId: "entry-2" }),
        entryView({
          entryId: "entry-3",
          isCreator: false,
          isInvited: true,
          status: "pending_approval",
        }),
      ],
    });

    expect(items.map((item) => item.kind).sort()).toEqual([
      "player_tournament_entry_awaiting_approval",
      "player_tournament_partner_invite_received",
      "player_tournament_partner_invite_sent",
    ]);

    for (const item of items) {
      expect(item.params).toEqual({ tournamentId: "tournament-1" });
      expect(item.route).toBe("/tournaments/[tournamentId]");
    }
  });

  it("o convidado NAO recebe a pendencia de pagamento (quem paga e o lado A)", () => {
    expect(
      buildPlayerEntryPendings({
        entries: [
          entryView({
            entryId: "entry-9",
            isCreator: false,
            isInvited: true,
            status: "awaiting_payment",
          }),
        ],
      })
    ).toEqual([]);
  });
});

describe("pendencia do jogador: aguardando aprovacao (cartao 7)", () => {
  it("vira status info sem acao, com o valor e o prazo da inscricao", () => {
    const [item] = buildPlayerEntryPendings({
      entries: [
        entryView({
          entryId: "entry-7",
          isCreator: false,
          isInvited: true,
          status: "pending_approval",
        }),
      ],
    });

    expect(item?.kind).toBe("player_tournament_entry_awaiting_approval");
    expect(item?.severity).toBe("info");
    expect(item?.title).toBe("Inscrição aguardando aprovação");
    expect(item?.description).toBe(
      "O organizador precisa liberar sua inscrição para você entrar na chave."
    );
    expect(item?.actionLabel).toBeNull();
    expect(item?.moneyCents).toBe(4000);
    expect(item?.deadlineAt).toBe(DEADLINE_MS);
  });
});

describe("pendencia do jogador: inscricao terminal nao gera item", () => {
  it("ignora active, cancelled e rejected", () => {
    expect(
      buildPlayerEntryPendings({
        entries: [
          entryView({ entryId: "entry-1", status: "active" }),
          entryView({ entryId: "entry-2", status: "cancelled" }),
          entryView({ entryId: "entry-3", status: "rejected" }),
        ],
      })
    ).toEqual([]);
  });
});

describe("pendencia do organizador: inscricoes por torneio (cartoes 11 e 12)", () => {
  const tournamentView = (
    overrides: Partial<TournamentOrganizerPendingView>
  ): TournamentOrganizerPendingView => ({
    awaitingApprovalCount: 0,
    awaitingPaymentCount: 0,
    awaitingPaymentFeeCents: 0,
    registrationDeadlineAtMs: DEADLINE_MS,
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  });

  it("aguardando aprovacao vira info com CTA Ver na aba de pendencias", () => {
    const items = buildOrganizerEntryPendings({
      tournaments: [tournamentView({ awaitingApprovalCount: 3 })],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe(
      "organization_tournament_entries_awaiting_approval"
    );
    expect(items[0]?.severity).toBe("info");
    expect(items[0]?.title).toBe("3 inscrições aguardando aprovação");
    expect(items[0]?.description).toBe(
      "Revise para liberar ou recusar quem entra na chave."
    );
    expect(items[0]?.actionLabel).toBe("Ver");
    expect(items[0]?.action).toEqual({ params: null, type: "open_route" });
    expect(items[0]?.route).toBe("/tournaments/[tournamentId]/entries");
    expect(items[0]?.params).toEqual({
      initialTab: "pending",
      tournamentId: "tournament-1",
    });
    expect(items[0]?.moneyCents).toBeNull();
  });

  it("aguardando pagamento vira warning com o dinheiro parado", () => {
    const items = buildOrganizerEntryPendings({
      tournaments: [
        tournamentView({
          awaitingPaymentCount: 2,
          awaitingPaymentFeeCents: 9000,
        }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe(
      "organization_tournament_entries_awaiting_payment"
    );
    expect(items[0]?.severity).toBe("warning");
    expect(items[0]?.title).toBe("2 inscrições aguardando pagamento");
    expect(items[0]?.description).toBe(
      "A vaga entra na chave depois do pagamento confirmado."
    );
    expect(items[0]?.moneyCents).toBe(9000);
  });

  it("torneio sem inscricao pendente nao gera item", () => {
    expect(buildOrganizerEntryPendings({ tournaments: [] })).toEqual([]);
    expect(
      buildOrganizerEntryPendings({ tournaments: [tournamentView({})] })
    ).toEqual([]);
  });
});

describe("pendencia do organizador: concluir torneio", () => {
  const conclusionView = (
    overrides: Partial<TournamentOrganizerConclusionPendingView> = {}
  ): TournamentOrganizerConclusionPendingView => ({
    canConclude: true,
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  });

  it("torneio com todas as categorias decididas gera o item que SO o organizador encerra", () => {
    const [item] = buildOrganizerConclusionPendings({
      tournaments: [conclusionView()],
    });

    expect(item?.kind).toBe("organization_tournament_awaiting_conclusion");
    expect(item?.id).toBe(
      "organization_tournament_awaiting_conclusion:tournament-1"
    );
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("Concluir torneio");
    expect(item?.actionLabel).toBe("Concluir");
    expect(item?.action).toEqual({
      params: { tournamentId: "tournament-1" },
      type: "conclude_tournament",
    });
    expect(item?.description).toBe(
      "Copa Dracena 8 já tem campeão em todas as categorias. Conclua para definir o resultado final."
    );
    expect(item?.source).toEqual({ id: "tournament-1", type: "tournament" });
    // Item de ESTADO: o alvo e o proprio torneio, sem destino de navegacao.
    expect(item?.route).toBeNull();
    expect(item?.params).toBeNull();
  });

  it("final ainda em aberto nao gera item", () => {
    expect(buildOrganizerConclusionPendings({ tournaments: [] })).toEqual([]);
    expect(
      buildOrganizerConclusionPendings({
        tournaments: [conclusionView({ canConclude: false })],
      })
    ).toEqual([]);
  });
});

describe("pendencia do jogador: acerto recebido", () => {
  const matchView = (
    overrides: Partial<TournamentMatchAgreementPendingView> = {}
  ): TournamentMatchAgreementPendingView => ({
    channel: "schedule",
    matchId: "match-1",
    opponentName: "Rodrigo Bittencourt",
    proposalLabel: "28/09 às 08:00, na Quadra Central",
    proposedAt: 1_789_653_600_000,
    proposerName: "Diego Barros",
    reopened: false,
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  });

  it("horario proposto gera o item que espera a resposta do outro lado", () => {
    const [item] = buildPlayerMatchAgreementPendings({
      matches: [matchView()],
    });

    expect(item?.kind).toBe("player_tournament_match_schedule_proposed");
    expect(item?.id).toBe("player_tournament_match_schedule_proposed:match-1");
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("Horário proposto pelo outro lado");
    // UM TOQUE aceita a proposta; abrir o confronto é o botão secundário.
    expect(item?.actionLabel).toBe("Aceitar");
    expect(item?.action).toEqual({
      params: { matchId: "match-1" },
      type: "accept_match_schedule",
    });
    // O secundario abre o Combinar jogo (propor outro horario/placar).
    expect(item?.secondaryActionLabel).toBe("Combinar");
    expect(item?.secondaryAction).toEqual({ params: null, type: "open_route" });
    expect(item?.route).toBe("/tournaments/[tournamentId]");
    expect(item?.params).toEqual({
      matchId: "match-1",
      tournamentId: "tournament-1",
    });
    expect(item?.source).toEqual({ id: "match-1", type: "tournament_match" });
    expect(item?.count).toBeNull();
    expect(item?.deadlineAt).toBeNull();
    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Diego Barros" },
          {
            text: " propôs 28/09 às 08:00, na Quadra Central para o confronto com Rodrigo Bittencourt em Copa Dracena 8.",
          },
        ],
      },
    ]);
  });

  it("placar proposto e pedido de mudanca saem em kinds proprios", () => {
    const [score] = buildPlayerMatchAgreementPendings({
      matches: [matchView({ channel: "score", proposalLabel: "6-3, 6-2" })],
    });
    expect(score?.kind).toBe("player_tournament_match_score_proposed");
    expect(score?.title).toBe("Placar proposto pelo outro lado");
    expect(score?.actionLabel).toBe("Confirmar");
    expect(score?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Diego Barros" },
          {
            text: " propôs 6-3, 6-2 para o confronto com Rodrigo Bittencourt em Copa Dracena 8.",
          },
        ],
      },
    ]);
    expect(score?.action).toEqual({
      params: { matchId: "match-1" },
      type: "confirm_match_score",
    });

    const [reopened] = buildPlayerMatchAgreementPendings({
      matches: [matchView({ reopened: true })],
    });
    expect(reopened?.kind).toBe("player_tournament_match_reschedule_requested");
    expect(reopened?.title).toBe("Pedido para mudar o horário");
    // Pedido de mudança aceita o horário novo pelo mesmo toque.
    expect(reopened?.action).toEqual({
      params: { matchId: "match-1" },
      type: "accept_match_schedule",
    });
    expect(reopened?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Diego Barros" },
          {
            text: " sugeriu 28/09 às 08:00, na Quadra Central para o confronto com Rodrigo Bittencourt em Copa Dracena 8.",
          },
        ],
      },
    ]);
  });

  it("a assinatura acompanha a proposta vigente", () => {
    const [before] = buildPlayerMatchAgreementPendings({
      matches: [matchView()],
    });
    const [sameTable] = buildPlayerMatchAgreementPendings({
      matches: [matchView()],
    });
    const [nextProposal] = buildPlayerMatchAgreementPendings({
      matches: [matchView({ proposedAt: 1_789_653_661_000 })],
    });

    expect(before?.signature).toBeTruthy();
    expect(sameTable?.signature).toBe(before?.signature);
    expect(nextProposal?.signature).not.toBe(before?.signature);
  });

  it("sem acerto recebido nao ha item", () => {
    expect(buildPlayerMatchAgreementPendings({ matches: [] })).toEqual([]);
  });

  it("confronto simples nao repete o nome de quem propos no fim da frase", () => {
    const [item] = buildPlayerMatchAgreementPendings({
      matches: [matchView({ opponentName: "" })],
    });

    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "Diego Barros" },
          {
            text: " propôs 28/09 às 08:00, na Quadra Central para o confronto em Copa Dracena 8.",
          },
        ],
      },
    ]);
  });
});

describe("pendencia do organizador: confrontos sem resposta no acerto", () => {
  const agreementView = (
    overrides: Partial<TournamentOrganizerAgreementPendingView> = {}
  ): TournamentOrganizerAgreementPendingView => ({
    proposals: [
      {
        channel: "schedule",
        matchId: "match-1",
        proposedAt: 1_789_653_600_000,
      },
    ],
    stalledMatchCount: 3,
    tournamentId: "tournament-1",
    tournamentName: "Copa Dracena 8",
    ...overrides,
  });

  it("agrega os confrontos por torneio em UMA pendencia com contagem", () => {
    const [item] = buildOrganizerAgreementPendings({
      tournaments: [agreementView()],
    });

    expect(item?.kind).toBe(
      "organization_tournament_matches_awaiting_agreement"
    );
    expect(item?.id).toBe(
      "organization_tournament_matches_awaiting_agreement:tournament-1"
    );
    expect(item?.count).toBe(3);
    expect(item?.title).toBe("3 confrontos sem resposta");
    expect(item?.actionLabel).toBe("Ver");
    expect(item?.action).toEqual({ params: null, type: "open_route" });
    expect(item?.route).toBe("/tournaments/[tournamentId]");
    expect(item?.params).toEqual({ tournamentId: "tournament-1" });
    expect(item?.source).toEqual({ id: "tournament-1", type: "tournament" });
    expect(item?.description).toBe(
      "Você pode agendar ou lançar o resultado direto no confronto, sem esperar o Combinar jogo."
    );
  });

  it("qualquer proposta nova do agregado muda a assinatura", () => {
    const [before] = buildOrganizerAgreementPendings({
      tournaments: [agreementView()],
    });
    const [after] = buildOrganizerAgreementPendings({
      tournaments: [
        agreementView({
          proposals: [
            {
              channel: "schedule",
              matchId: "match-1",
              proposedAt: 1_789_653_661_000,
            },
          ],
        }),
      ],
    });

    expect(before?.signature).toBeTruthy();
    expect(after?.signature).not.toBe(before?.signature);
  });

  it("singular no titulo quando so um confronto esta parado", () => {
    const [item] = buildOrganizerAgreementPendings({
      tournaments: [agreementView({ stalledMatchCount: 1 })],
    });
    expect(item?.title).toBe("1 confronto sem resposta");
  });

  it("torneio sem acerto aberto nao gera item", () => {
    expect(buildOrganizerAgreementPendings({ tournaments: [] })).toEqual([]);
    expect(
      buildOrganizerAgreementPendings({
        tournaments: [agreementView({ stalledMatchCount: 0 })],
      })
    ).toEqual([]);
  });
});

describe("pendencias de torneio: CTA de uma palavra", () => {
  it("todo rótulo de acao sai com uma palavra so", () => {
    const items = [
      ...buildPlayerEntryPendings({
        entries: [
          entryView({ entryId: "entry-1", isCreator: false, isInvited: true }),
          entryView({ entryId: "entry-2", status: "awaiting_payment" }),
        ],
      }),
      ...buildOrganizerEntryPendings({
        tournaments: [
          {
            awaitingApprovalCount: 1,
            awaitingPaymentCount: 1,
            awaitingPaymentFeeCents: 4000,
            registrationDeadlineAtMs: DEADLINE_MS,
            tournamentId: "tournament-1",
            tournamentName: "Copa Dracena 8",
          },
        ],
      }),
      ...buildOrganizerConclusionPendings({
        tournaments: [
          {
            canConclude: true,
            tournamentId: "tournament-1",
            tournamentName: "Copa Dracena 8",
          },
        ],
      }),
      ...buildPlayerMatchAgreementPendings({
        matches: [
          {
            channel: "schedule",
            matchId: "match-1",
            opponentName: "Rodrigo Bittencourt",
            proposalLabel: "28/09 às 08:00",
            proposedAt: 1_789_653_600_000,
            proposerName: "Diego Barros",
            reopened: false,
            tournamentId: "tournament-1",
            tournamentName: "Copa Dracena 8",
          },
        ],
      }),
      ...buildOrganizerAgreementPendings({
        tournaments: [
          {
            proposals: [
              {
                channel: "schedule",
                matchId: "match-1",
                proposedAt: 1_789_653_600_000,
              },
            ],
            stalledMatchCount: 2,
            tournamentId: "tournament-1",
            tournamentName: "Copa Dracena 8",
          },
        ],
      }),
    ];

    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      for (const label of [item.actionLabel, item.secondaryActionLabel]) {
        if (label) {
          expect(label.split(" ")).toHaveLength(1);
        }
      }
    }
  });
});

describe("acerto: nome do lado adversário", () => {
  it("nomeia a dupla inteira quando os dois lados existem", () => {
    expect(formatOpponentSideLabel(["Rafael Salles", "Diego Barros"])).toBe(
      "Rafael Salles e Diego Barros"
    );
  });

  it("não repete quem propôs e cai para vazio quando só ele sobra", () => {
    // Era a leitura do bug: "Rafael Salles propôs ... com Rafael Salles".
    expect(
      formatOpponentSideLabel(
        ["Rafael Salles", "Diego Barros"],
        "Rafael Salles"
      )
    ).toBe("Diego Barros");
    expect(formatOpponentSideLabel(["Rafael Salles"], "Rafael Salles")).toBe(
      ""
    );
  });

  it("degrada para um nome, ignora vazio e nunca repete o mesmo nome", () => {
    expect(formatOpponentSideLabel(["Diego Barros", null])).toBe(
      "Diego Barros"
    );
    expect(formatOpponentSideLabel([null, undefined])).toBe("");
    expect(formatOpponentSideLabel(["  Rafael Salles  ", ""])).toBe(
      "Rafael Salles"
    );
  });
});
