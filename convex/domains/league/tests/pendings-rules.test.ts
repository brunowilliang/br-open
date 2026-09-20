import { describe, expect, it } from "bun:test";

import { ORGANIZER_ATTENTION_CHALLENGE_STATUSES } from "../challenge-status";
import { LeagueChallengeStatusOptions } from "../contract";
import {
  buildLeagueInactivityPending,
  buildLeagueJoinRequestsPending,
  buildOrganizerChallengePendingItem,
  buildPlayerChallengePendingItem,
  ORGANIZER_ATTENTION_PROPOSAL_STATUSES,
  ORGANIZER_ATTENTION_SCAN_STATUSES,
  ORGANIZER_ATTENTION_VALIDATION_STATUSES,
  resolveLeagueInactivityRisk,
  resolvePlayerChallengePendingActionKind,
} from "../pendings-rules";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse("2026-09-20T12:00:00.000Z");

describe("pendencias de liga: paridade com os sets de atencao do servidor", () => {
  it("resultados + propostas formam EXATAMENTE o set de atencao do organizador", () => {
    const union = new Set([
      ...ORGANIZER_ATTENTION_VALIDATION_STATUSES,
      ...ORGANIZER_ATTENTION_PROPOSAL_STATUSES,
    ]);

    expect(union).toEqual(new Set(ORGANIZER_ATTENTION_CHALLENGE_STATUSES));
  });

  it("os dois conjuntos sao disjuntos (nenhum status conta duas vezes)", () => {
    for (const status of ORGANIZER_ATTENTION_VALIDATION_STATUSES) {
      expect(ORGANIZER_ATTENTION_PROPOSAL_STATUSES.has(status)).toBe(false);
    }
  });

  it("todo status da varredura existe no enum canonico", () => {
    const valid = new Set<string>(LeagueChallengeStatusOptions);

    for (const status of ORGANIZER_ATTENTION_SCAN_STATUSES) {
      expect(valid.has(status)).toBe(true);
    }
  });

  it("a varredura cobre o set de atencao e as origens que derivam por tempo", () => {
    for (const status of ORGANIZER_ATTENTION_CHALLENGE_STATUSES) {
      expect(ORGANIZER_ATTENTION_SCAN_STATUSES.has(status)).toBe(true);
    }

    for (const status of ["confirmed", "pending_opponent_response"] as const) {
      expect(ORGANIZER_ATTENTION_SCAN_STATUSES.has(status)).toBe(true);
    }
  });
});

describe("pendencia do jogador: quem deve o resultado", () => {
  it("mapeia cada status de resultado na acao do viewer", () => {
    expect(
      resolvePlayerChallengePendingActionKind({
        status: "pending_result_submission",
        submittedByMembershipId: null,
        viewerMembershipId: "m-1",
      })
    ).toBe("register_result");
    expect(
      resolvePlayerChallengePendingActionKind({
        status: "pending_result_correction",
        submittedByMembershipId: "m-2",
        viewerMembershipId: "m-1",
      })
    ).toBe("request_correction");
  });

  it("em confirmacao, quem publicou o placar nao tem nada a fazer", () => {
    expect(
      resolvePlayerChallengePendingActionKind({
        status: "pending_result_confirmation",
        submittedByMembershipId: "m-1",
        viewerMembershipId: "m-1",
      })
    ).toBeNull();
    expect(
      resolvePlayerChallengePendingActionKind({
        status: "pending_result_confirmation",
        submittedByMembershipId: "m-2",
        viewerMembershipId: "m-1",
      })
    ).toBe("confirm_result");
  });

  it("status fora do conjunto de resultado nao pede acao do jogador", () => {
    for (const status of [
      "confirmed",
      "finished",
      "pending_opponent_response",
      "pending_organizer_result_validation",
    ]) {
      expect(
        resolvePlayerChallengePendingActionKind({
          status,
          submittedByMembershipId: null,
          viewerMembershipId: "m-1",
        })
      ).toBeNull();
    }
  });
});

describe("pendencia do jogador: desafios com atencao (cartao 8)", () => {
  it("usa UMA linha por tipo, com o destaque na expressao da pendencia", () => {
    const item = buildPlayerChallengePendingItem({
      counts: { confirmResult: 1, registerResult: 2, requestCorrection: 0 },
      leagueId: "league-1",
    });

    expect(item?.kind).toBe("player_league_challenges_pending_actions");
    expect(item?.id).toBe("player_league_challenges_pending_actions:league-1");
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("3 desafios precisando de atenção");
    expect(item?.count).toBe(3);
    expect(item?.actionLabel).toBe("Ver");
    expect(item?.action).toEqual({ params: null, type: "open_route" });
    expect(item?.route).toBe("/leagues/[leagueId]/challenges");
    expect(item?.params).toEqual({ leagueId: "league-1" });
    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "2 resultados" },
          { text: " para registrar" },
        ],
      },
      {
        parts: [
          { isHighlighted: true, text: "1 resultado" },
          { text: " para confirmar" },
        ],
      },
    ]);
  });

  it("inclui a linha de correcao quando ha pedido de correcao", () => {
    const item = buildPlayerChallengePendingItem({
      counts: { confirmResult: 0, registerResult: 0, requestCorrection: 1 },
      leagueId: "league-1",
    });

    expect(item?.title).toBe("1 desafio precisando de atenção");
    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "1 resultado" },
          { text: " para corrigir" },
        ],
      },
    ]);
  });

  it("sem nenhuma pendencia de resultado nao gera item", () => {
    expect(
      buildPlayerChallengePendingItem({
        counts: { confirmResult: 0, registerResult: 0, requestCorrection: 0 },
        leagueId: "league-1",
      })
    ).toBeNull();
  });
});

describe("pendencia do organizador: desafios esperando validacao (cartao 14)", () => {
  it("agrega resultados a validar e propostas a decidir em linhas proprias", () => {
    const item = buildOrganizerChallengePendingItem({
      organizationId: "org-1",
      proposals: 1,
      results: 2,
    });

    expect(item?.kind).toBe(
      "organization_league_challenges_awaiting_validation"
    );
    expect(item?.id).toBe(
      "organization_league_challenges_awaiting_validation:org-1"
    );
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("3 desafios esperando sua validação");
    expect(item?.count).toBe(3);
    expect(item?.action).toBeNull();
    expect(item?.actionLabel).toBeNull();
    expect(item?.route).toBeNull();
    expect(item?.description).toEqual([
      {
        parts: [
          { isHighlighted: true, text: "2 resultados" },
          { text: " para validar" },
        ],
      },
      {
        parts: [
          { isHighlighted: true, text: "1 proposta" },
          { text: " para decidir" },
        ],
      },
    ]);
    expect(item?.source).toEqual({ id: "org-1", type: "organization" });
  });

  it("sem desafio esperando validacao nao gera item", () => {
    expect(
      buildOrganizerChallengePendingItem({
        organizationId: "org-1",
        proposals: 0,
        results: 0,
      })
    ).toBeNull();
  });
});

describe("pendencia do organizador: solicitacoes de entrada (cartao 13)", () => {
  it("vira warning com CTA Revisar que leva a aba da liga", () => {
    const item = buildLeagueJoinRequestsPending({
      count: 4,
      leagueId: "league-1",
    });

    expect(item?.kind).toBe("organization_league_join_requests");
    expect(item?.id).toBe("organization_league_join_requests:league-1");
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("4 solicitações de entrada");
    expect(item?.description).toBe(
      "Jogadores esperando aprovação para entrar na liga."
    );
    expect(item?.actionLabel).toBe("Revisar");
    expect(item?.action).toEqual({ params: null, type: "open_route" });
    expect(item?.route).toBe("/leagues/[leagueId]/requests");
    expect(item?.params).toEqual({ leagueId: "league-1" });
    expect(item?.count).toBe(4);
  });

  it("liga sem solicitacao nao gera item", () => {
    expect(
      buildLeagueJoinRequestsPending({ count: 0, leagueId: "league-1" })
    ).toBeNull();
  });
});

describe("pendencia do jogador: risco de inatividade (cartao 9)", () => {
  it("nao gera risco quando a liga nao aplica penalidade", () => {
    expect(
      resolveLeagueInactivityRisk({
        hasInactivityPenalty: false,
        inactivityPenaltyDays: 30,
        lastMatchAtMs: null,
        nowMs: NOW_MS,
      })
    ).toBeNull();
  });

  it("nao gera risco quando o numero de dias da penalidade nao existe", () => {
    expect(
      resolveLeagueInactivityRisk({
        hasInactivityPenalty: true,
        inactivityPenaltyDays: null,
        lastMatchAtMs: null,
        nowMs: NOW_MS,
      })
    ).toBeNull();
  });

  it("fora da janela de 7 dias nao vira alerta; dentro dela vira warning", () => {
    expect(
      resolveLeagueInactivityRisk({
        hasInactivityPenalty: true,
        inactivityPenaltyDays: 30,
        lastMatchAtMs: NOW_MS - 12 * MS_PER_DAY,
        nowMs: NOW_MS,
      })
    ).toBeNull();

    const risk = resolveLeagueInactivityRisk({
      hasInactivityPenalty: true,
      inactivityPenaltyDays: 30,
      lastMatchAtMs: NOW_MS - 23 * MS_PER_DAY,
      nowMs: NOW_MS,
    });

    expect(risk?.daysSinceLastMatch).toBe(23);
    expect(risk?.daysUntilPenalty).toBe(7);
    expect(risk?.severity).toBe("warning");
    expect(risk?.penaltyAtMs).toBe(NOW_MS - 23 * MS_PER_DAY + 30 * MS_PER_DAY);
  });

  it("prazo estourado vira danger com a penalidade ja vencida", () => {
    const risk = resolveLeagueInactivityRisk({
      hasInactivityPenalty: true,
      inactivityPenaltyDays: 30,
      lastMatchAtMs: NOW_MS - 33 * MS_PER_DAY,
      nowMs: NOW_MS,
    });

    expect(risk?.daysUntilPenalty).toBe(-3);
    expect(risk?.severity).toBe("danger");
    expect(risk?.penaltyAtMs).toBe(NOW_MS - 3 * MS_PER_DAY);
  });

  it("sem partida nenhuma o relogio comeca agora (0 dias desde)", () => {
    const risk = resolveLeagueInactivityRisk({
      hasInactivityPenalty: true,
      inactivityPenaltyDays: 5,
      lastMatchAtMs: null,
      nowMs: NOW_MS,
    });

    expect(risk?.daysSinceLastMatch).toBe(0);
    expect(risk?.daysUntilPenalty).toBe(5);
    expect(risk?.severity).toBe("warning");
    // Sem partida nao ha instante de penalidade para ordenar por prazo.
    expect(risk?.penaltyAtMs).toBeNull();
  });
});

describe("pendencia do jogador: alerta de inatividade montado", () => {
  it("warning destaca o prazo que falta", () => {
    const item = buildLeagueInactivityPending({
      membershipId: "membership-1",
      risk: {
        daysSinceLastMatch: 27,
        daysUntilPenalty: 3,
        penaltyAtMs: NOW_MS + 3 * MS_PER_DAY,
        severity: "warning",
      },
    });

    expect(item.kind).toBe("player_league_inactivity_risk");
    expect(item.id).toBe("player_league_inactivity_risk:membership-1");
    expect(item.severity).toBe("warning");
    expect(item.title).toBe("Risco de queda por inatividade");
    expect(item.description).toEqual([
      {
        parts: [
          { text: "Faltam " },
          { isHighlighted: true, text: "3 dias" },
          { text: " para você cair no ranking." },
        ],
      },
    ]);
    expect(item.action).toBeNull();
    expect(item.actionLabel).toBeNull();
    expect(item.deadlineAt).toBe(NOW_MS + 3 * MS_PER_DAY);
    expect(item.source).toEqual({
      id: "membership-1",
      type: "league_membership",
    });
  });

  it("danger troca titulo e frase e nao tem destaque", () => {
    const item = buildLeagueInactivityPending({
      membershipId: "membership-1",
      risk: {
        daysSinceLastMatch: 33,
        daysUntilPenalty: -3,
        penaltyAtMs: NOW_MS - 3 * MS_PER_DAY,
        severity: "danger",
      },
    });

    expect(item.severity).toBe("danger");
    expect(item.title).toBe("Você está inativo");
    expect(item.description).toBe(
      "Já se passaram 33 dias desde sua última partida."
    );
    expect(item.deadlineAt).toBe(NOW_MS - 3 * MS_PER_DAY);
  });

  it("usa o singular de 'dia' quando o numero e 1", () => {
    const item = buildLeagueInactivityPending({
      membershipId: "membership-1",
      risk: {
        daysSinceLastMatch: 1,
        daysUntilPenalty: -1,
        penaltyAtMs: NOW_MS - MS_PER_DAY,
        severity: "danger",
      },
    });

    expect(item.description).toBe(
      "Já se passaram 1 dia desde sua última partida."
    );
  });
});

describe("pendencias de liga: CTA de uma palavra", () => {
  it("todo rótulo de acao sai com uma palavra so", () => {
    const items = [
      buildPlayerChallengePendingItem({
        counts: { confirmResult: 1, registerResult: 1, requestCorrection: 1 },
        leagueId: "league-1",
      }),
      buildLeagueJoinRequestsPending({ count: 2, leagueId: "league-1" }),
      buildOrganizerChallengePendingItem({
        organizationId: "org-1",
        proposals: 1,
        results: 1,
      }),
    ];

    for (const item of items) {
      for (const label of [item?.actionLabel, item?.secondaryActionLabel]) {
        if (label) {
          expect(label.split(" ")).toHaveLength(1);
        }
      }
    }
  });
});
