import { describe, expect, it } from "bun:test";

import {
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  type TournamentEntryPendingView,
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
