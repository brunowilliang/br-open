import { describe, expect, it } from "bun:test";

import {
  ACTIVE_CHALLENGE_BLOCKING_STATUSES,
  applyChallengeResultToRanking,
  buildResponseDeadline,
  canPlayersCancelChallenge,
  isChallengeSlotBlocked,
  resolveAcceptedChallengeStatus,
  resolveChallengeRankingRestore,
  resolveChallengeScoreOutcome,
  resolveConfirmedChallengeResult,
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  resolveReopenedChallengeStatus,
  resolveResponseDeadline,
  resolveScoreConfirmationStatus,
  resolveWalkoverScoreError,
} from "../challenge-rules";
import {
  DEFAULT_LEAGUE_MATCH_CONFIG,
  type LeagueChallengeScore,
} from "../contract";

describe("league challenge rules", () => {
  it("resets the response deadline on each counterproposal", () => {
    const nextDeadline = buildResponseDeadline({
      now: new Date("2026-05-21T12:00:00.000Z"),
      responseDeadlineHours: 48,
    });

    expect(nextDeadline.toISOString()).toBe("2026-05-23T12:00:00.000Z");
  });

  it("builds a real deadline when the response deadline rule is enabled", () => {
    const deadline = resolveResponseDeadline({
      now: new Date("2026-06-23T12:00:00.000Z"),
      rule: { enabled: true, value: 48 },
    });

    expect(deadline.toISOString()).toBe("2026-06-25T12:00:00.000Z");
  });

  it("builds a far-future deadline when the response deadline rule is disabled", () => {
    const now = new Date("2026-06-23T12:00:00.000Z");
    const deadline = resolveResponseDeadline({
      now,
      rule: { enabled: false, value: 48 },
    });

    expect(deadline.getUTCFullYear()).toBe(now.getUTCFullYear() + 100);
  });

  it("locks into pending admin validation when both players agree and the league is manual", () => {
    expect(
      resolveAcceptedChallengeStatus({
        challengeValidationMode: "manual",
      })
    ).toBe("pending_organizer_challenge_validation");
  });

  it("locks directly into confirmed when both players agree and the league is automatic", () => {
    expect(
      resolveAcceptedChallengeStatus({
        challengeValidationMode: "automatic",
      })
    ).toBe("confirmed");
  });

  it("moves confirmed scores into pending admin validation when the league is manual", () => {
    expect(
      resolveScoreConfirmationStatus({
        resultValidationMode: "manual",
      })
    ).toBe("pending_organizer_result_validation");
  });

  it("finishes confirmed scores immediately when the league is automatic", () => {
    expect(
      resolveScoreConfirmationStatus({
        resultValidationMode: "automatic",
      })
    ).toBe("finished");
  });

  it("marks silent responses for admin decision", () => {
    expect(resolveNoResponseStatus()).toBe("pending_organizer_decision");
  });

  it("marks matches without score after the scheduled time as pending result submission", () => {
    expect(
      resolveMissingResultStatus({
        hasSubmittedResult: false,
        now: new Date("2026-05-21T13:30:00.000Z"),
        scheduledEndAt: new Date("2026-05-21T13:00:00.000Z"),
      })
    ).toBe("pending_result_submission");
  });

  it("allows players to cancel only before the scheduled time", () => {
    expect(
      canPlayersCancelChallenge({
        now: new Date("2026-05-21T11:59:00.000Z"),
        scheduledStartAt: new Date("2026-05-21T12:00:00.000Z"),
      })
    ).toBe(true);

    expect(
      canPlayersCancelChallenge({
        now: new Date("2026-05-21T12:00:00.000Z"),
        scheduledStartAt: new Date("2026-05-21T12:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("blocks the court slot for active challenge statuses", () => {
    for (const status of ACTIVE_CHALLENGE_BLOCKING_STATUSES) {
      expect(isChallengeSlotBlocked(status)).toBe(true);
    }
  });

  it("keeps the court slot blocked while cancellation is waiting for the other player", () => {
    expect(isChallengeSlotBlocked("pending_cancellation_acceptance")).toBe(
      true
    );
  });

  it("releases the court slot for closed challenge statuses", () => {
    expect(isChallengeSlotBlocked("declined")).toBe(false);
    expect(isChallengeSlotBlocked("cancelled")).toBe(false);
    expect(isChallengeSlotBlocked("finished")).toBe(false);
    expect(isChallengeSlotBlocked("invalidated")).toBe(false);
  });

  it("swaps challenger and challenged positions when the challenger wins and takes the opponent position", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        winBehavior: "take_opponent_position",
        winnerMembershipId: "membership-4",
      })
    ).toEqual(["membership-1", "membership-4", "membership-3", "membership-2"]);
  });

  it("moves the challenger one slot up when the challenger wins with climb one position", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        winBehavior: "climb_one_position",
        winnerMembershipId: "membership-4",
      })
    ).toEqual(["membership-1", "membership-2", "membership-4", "membership-3"]);
  });

  it("keeps positions unchanged when the challenger loses and the rule is stay put", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        winBehavior: "take_opponent_position",
        winnerMembershipId: "membership-2",
      })
    ).toEqual(["membership-1", "membership-2", "membership-3", "membership-4"]);
  });

  it("drops the challenger one slot when the challenger loses and the rule is drop one position", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-3",
        lossBehavior: "drop_one_position",
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        winBehavior: "take_opponent_position",
        winnerMembershipId: "membership-2",
      })
    ).toEqual(["membership-1", "membership-2", "membership-4", "membership-3"]);
  });

  it("reopens to the receiver that did not propose the current slot", () => {
    expect(
      resolveReopenedChallengeStatus({
        challengerMembershipId: "membership-1",
        proposedByMembershipId: "membership-1",
      })
    ).toBe("pending_opponent_response");

    expect(
      resolveReopenedChallengeStatus({
        challengerMembershipId: "membership-1",
        proposedByMembershipId: "membership-2",
      })
    ).toBe("pending_creator_reapproval");
  });

  it("validates and resolves the winner for a straight-sets best-of-three result", () => {
    const score = {
      sets: [
        {
          challengedGames: 3,
          challengerGames: 6,
          kind: "set" as const,
        },
        {
          challengedGames: 4,
          challengerGames: 6,
          kind: "set" as const,
        },
      ],
      winnerMembershipId: "membership-1",
    };

    const outcome = resolveChallengeScoreOutcome({
      challengedMembershipId: "membership-2",
      challengerMembershipId: "membership-1",
      score,
    });

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("describes the automatic challenge cycle from acceptance to ranking update", () => {
    const acceptedStatus = resolveAcceptedChallengeStatus({
      challengeValidationMode: "automatic",
    });
    const score = {
      sets: [
        {
          challengedGames: 4,
          challengerGames: 6,
          kind: "set" as const,
        },
        {
          challengedGames: 4,
          challengerGames: 6,
          kind: "set" as const,
        },
      ],
      winnerMembershipId: "membership-4",
    };

    expect(acceptedStatus).toBe("confirmed");
    expect(
      resolveChallengeScoreOutcome({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        score,
      }).error
    ).toBeNull();
    expect(
      resolveConfirmedChallengeResult({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        resultValidationMode: "automatic",
        score,
        winBehavior: "take_opponent_position",
      })
    ).toEqual({
      nextStatus: "finished",
      ok: true,
      rankingMembershipIds: [
        "membership-1",
        "membership-4",
        "membership-3",
        "membership-2",
      ],
      winnerMembershipId: "membership-4",
    });
  });

  it("finishes an automatically confirmed result and returns the next ranking", () => {
    expect(
      resolveConfirmedChallengeResult({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        resultValidationMode: "automatic",
        score: {
          sets: [
            {
              challengedGames: 4,
              challengerGames: 6,
              kind: "set",
            },
            {
              challengedGames: 4,
              challengerGames: 6,
              kind: "set",
            },
          ],
          winnerMembershipId: "membership-4",
        },
        winBehavior: "take_opponent_position",
      })
    ).toEqual({
      nextStatus: "finished",
      ok: true,
      rankingMembershipIds: [
        "membership-1",
        "membership-4",
        "membership-3",
        "membership-2",
      ],
      winnerMembershipId: "membership-4",
    });
  });

  it("keeps ranking unchanged until admin approval when result validation is manual", () => {
    expect(
      resolveConfirmedChallengeResult({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        lossBehavior: "stay_put",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        rankingMembershipIds: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
        resultValidationMode: "manual",
        score: {
          sets: [
            {
              challengedGames: 4,
              challengerGames: 6,
              kind: "set",
            },
            {
              challengedGames: 4,
              challengerGames: 6,
              kind: "set",
            },
          ],
          winnerMembershipId: "membership-4",
        },
        winBehavior: "take_opponent_position",
      })
    ).toEqual({
      nextStatus: "pending_organizer_result_validation",
      ok: true,
      rankingMembershipIds: null,
      winnerMembershipId: "membership-4",
    });
  });

  it("restores the previous ranking only when the current ranking still matches the result snapshot", () => {
    expect(
      resolveChallengeRankingRestore({
        currentRankingMembershipIds: [
          "membership-1",
          "membership-4",
          "membership-3",
          "membership-2",
        ],
        hasRankingApplied: true,
        rankingSnapshotAfterResult: [
          "membership-1",
          "membership-4",
          "membership-3",
          "membership-2",
        ],
        rankingSnapshotBeforeResult: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
      })
    ).toEqual({
      ok: true,
      rankingMembershipIds: [
        "membership-1",
        "membership-2",
        "membership-3",
        "membership-4",
      ],
    });
  });

  it("blocks ranking restore when another ranking change already happened", () => {
    expect(
      resolveChallengeRankingRestore({
        currentRankingMembershipIds: [
          "membership-4",
          "membership-1",
          "membership-3",
          "membership-2",
        ],
        hasRankingApplied: true,
        rankingSnapshotAfterResult: [
          "membership-1",
          "membership-4",
          "membership-3",
          "membership-2",
        ],
        rankingSnapshotBeforeResult: [
          "membership-1",
          "membership-2",
          "membership-3",
          "membership-4",
        ],
      })
    ).toEqual({
      error:
        "O ranking atual já mudou depois dessa partida e não pode ser reaberto automaticamente.",
      ok: false,
    });
  });

  it("split 1-1 sem linha decisiva é aceito com vencedor explícito", () => {
    expect(
      resolveChallengeScoreOutcome({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [
            {
              challengedGames: 3,
              challengerGames: 6,
              kind: "set",
            },
            {
              challengedGames: 6,
              challengerGames: 4,
              kind: "set",
            },
          ],
          winnerMembershipId: "membership-1",
        },
      })
    ).toEqual({ error: null, winnerMembershipId: "membership-1" });
  });
});

describe("placar manual livre (REWORK-2)", () => {
  const freeScore = (input: {
    sets: LeagueChallengeScore["sets"];
    winnerMembershipId?: null | string;
  }) => ({
    challengedMembershipId: "membership-2",
    challengerMembershipId: "membership-1",
    score: input,
  });

  it("deriva o vencedor pelas linhas vencidas (explícito null)", () => {
    const outcome = resolveChallengeScoreOutcome(
      freeScore({
        sets: [
          { challengedGames: 3, challengerGames: 6, kind: "set" },
          { challengedGames: 4, challengerGames: 6, kind: "set" },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("aceita 3x3 e números livres; empate total exige vencedor explícito", () => {
    const explicit = resolveChallengeScoreOutcome(
      freeScore({
        sets: [{ challengedGames: 3, challengerGames: 3, kind: "set" }],
        winnerMembershipId: "membership-2",
      })
    );

    expect(explicit.error).toBeNull();
    expect(explicit.winnerMembershipId).toBe("membership-2");

    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 3, challengerGames: 3, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("linha avulsa de tie-break conta como linha e aceita pontos livres", () => {
    const outcome = resolveChallengeScoreOutcome(
      freeScore({
        sets: [
          { challengedGames: 3, challengerGames: 6, kind: "set" },
          { challengedGames: 3, challengerGames: 7, kind: "tiebreak" },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("tieBreak anexo é livre (sem forma exigida), inclusive em super TB", () => {
    const sets: LeagueChallengeScore["sets"] = [
      {
        challengedGames: 7,
        challengerGames: 6,
        kind: "set",
        tieBreak: { challengedPoints: 6, challengerPoints: 7 },
      },
      {
        challengedGames: 5,
        challengerGames: 7,
        kind: "set",
        tieBreak: { challengedPoints: 3, challengerPoints: 7 },
      },
      {
        challengedGames: 8,
        challengerGames: 10,
        kind: "super_tiebreak",
        tieBreak: { challengedPoints: 8, challengerPoints: 10 },
      },
    ];
    expect(
      resolveChallengeScoreOutcome(
        freeScore({ sets, winnerMembershipId: null })
      ).error
    ).toBeNull();
  });

  it("6x6 com TB anexo decide a linha (sem vencedor explícito)", () => {
    const outcome = resolveChallengeScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 6,
            kind: "set",
            tieBreak: { challengedPoints: 3, challengerPoints: 7 },
          },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("6x6 sem TB é empate real (explícito exigido)", () => {
    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 6, challengerGames: 6, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("7x6 com TB segue decidido pelos games da linha", () => {
    const outcome = resolveChallengeScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 7,
            kind: "set",
            // TB invertido de propósito: na linha, os games mandam.
            tieBreak: { challengedPoints: 7, challengerPoints: 3 },
          },
        ],
        winnerMembershipId: null,
      })
    );

    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-1");
  });

  it("TB anexo empatado = linha de ninguém", () => {
    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [
            {
              challengedGames: 6,
              challengerGames: 6,
              kind: "set",
              tieBreak: { challengedPoints: 5, challengerPoints: 5 },
            },
          ],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("O placar não define o vencedor; informe o vencedor do confronto.");
  });

  it("multi-linha: o TB anexo decide o confronto", () => {
    const outcome = resolveChallengeScoreOutcome(
      freeScore({
        sets: [
          {
            challengedGames: 6,
            challengerGames: 6,
            kind: "set",
            tieBreak: { challengedPoints: 7, challengerPoints: 3 },
          },
          { challengedGames: 4, challengerGames: 4, kind: "set" },
        ],
        winnerMembershipId: null,
      })
    );

    // Linha 1 vai pro desafiado pelo TB; linha 2 (4x4 sem TB) é de ninguém.
    expect(outcome.error).toBeNull();
    expect(outcome.winnerMembershipId).toBe("membership-2");
  });

  it("rejeita vencedor explícito que contradiz o placar", () => {
    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [
            { challengedGames: 3, challengerGames: 6, kind: "set" },
            { challengedGames: 4, challengerGames: 6, kind: "set" },
          ],
          winnerMembershipId: "membership-2",
        })
      ).error
    ).toBe("O vencedor informado não corresponde ao resultado.");
  });

  it("rejeita vencedor fora dos participantes", () => {
    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [{ challengedGames: 3, challengerGames: 6, kind: "set" }],
          winnerMembershipId: "membership-3",
        })
      ).error
    ).toBe("O vencedor informado não participa dessa partida.");
  });

  it("sanidade da regra: valores inválidos e placar vazio são rejeitados", () => {
    expect(
      resolveChallengeScoreOutcome(
        freeScore({
          sets: [{ challengedGames: -1, challengerGames: 6, kind: "set" }],
          winnerMembershipId: null,
        })
      ).error
    ).toBe("Placar inválido.");

    expect(
      resolveChallengeScoreOutcome(
        freeScore({ sets: [], winnerMembershipId: null })
      ).error
    ).toBe("Informe pelo menos uma linha do placar.");
  });
});

describe("walkover no resultado do desafio (IBX-0026)", () => {
  const walkoverScore = (winnerMembershipId: string) => ({
    sets: [{ challengedGames: 0, challengerGames: 0, kind: "set" as const }],
    walkover: true,
    winnerMembershipId,
  });

  it("aceita W.O. com vencedor participante e placeholder de 1 set zerado", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: walkoverScore("membership-1"),
        walkoverBehavior: "automatic_loss",
      })
    ).toBeNull();
  });

  it("não-walkover passa direto (backward compat)", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [{ challengedGames: 6, challengerGames: 3, kind: "set" }],
          winnerMembershipId: "membership-1",
        },
        walkoverBehavior: "cancel_challenge",
      })
    ).toBeNull();
  });

  it("liga com walkoverBehavior cancel_challenge rejeita W.O. como resultado", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: walkoverScore("membership-1"),
        walkoverBehavior: "cancel_challenge",
      })
    ).toContain("Cancele o desafio");
  });

  it("rejeita vencedor fora dos lados do desafio", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: walkoverScore("membership-3"),
        walkoverBehavior: "automatic_loss",
      })
    ).toBe("O vencedor do W.O. precisa ser um dos participantes do desafio.");
  });

  it("rejeita placar por sets em W.O.", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [
            { challengedGames: 6, challengerGames: 0, kind: "set" },
            { challengedGames: 6, challengerGames: 0, kind: "set" },
          ],
          walkover: true,
          winnerMembershipId: "membership-1",
        },
        walkoverBehavior: "automatic_loss",
      })
    ).toBe("Em W.O. não há resultado por sets.");
  });

  it("rejeita placeholder com games diferentes de 0-0", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [{ challengedGames: 6, challengerGames: 0, kind: "set" }],
          walkover: true,
          winnerMembershipId: "membership-1",
        },
        walkoverBehavior: "automatic_loss",
      })
    ).toBe("Em W.O. não há resultado por sets.");
  });

  it("aceita tieBreak null no placeholder (contrato nullish: null = ausente)", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [
            {
              challengedGames: 0,
              challengerGames: 0,
              kind: "set",
              tieBreak: null,
            },
          ],
          walkover: true,
          winnerMembershipId: "membership-1",
        },
        walkoverBehavior: "automatic_loss",
      })
    ).toBeNull();
  });

  it("rejeita mini-placar de tie-break no placeholder de W.O.", () => {
    expect(
      resolveWalkoverScoreError({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        score: {
          sets: [
            {
              challengedGames: 0,
              challengerGames: 0,
              kind: "set",
              tieBreak: { challengedPoints: 3, challengerPoints: 7 },
            },
          ],
          walkover: true,
          winnerMembershipId: "membership-1",
        },
        walkoverBehavior: "automatic_loss",
      })
    ).toBe("Em W.O. não há resultado por sets.");
  });
});

describe("efeito de W.O. no ranking (IBX-0026)", () => {
  const ranking = ["m1", "m2", "m3", "m4", "m5"];

  it("automatic_loss mantém o efeito padrão (vencedor toma a posição)", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "m2",
        challengerMembershipId: "m4",
        lossBehavior: "stay_put",
        rankingMembershipIds: ranking,
        walkover: true,
        walkoverBehavior: "automatic_loss",
        winBehavior: "take_opponent_position",
        winnerMembershipId: "m4",
      })
    ).toEqual(["m1", "m4", "m3", "m2", "m5"]);
  });

  it("automatic_loss_and_move_to_end manda o perdedor pro fim", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "m2",
        challengerMembershipId: "m4",
        lossBehavior: "stay_put",
        rankingMembershipIds: ranking,
        walkover: true,
        walkoverBehavior: "automatic_loss_and_move_to_end",
        winBehavior: "take_opponent_position",
        winnerMembershipId: "m4",
      })
    ).toEqual(["m1", "m4", "m3", "m5", "m2"]);
  });

  it("move_to_end com desafiado vencedor: desafiante cai pro fim", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "m5",
        challengerMembershipId: "m1",
        lossBehavior: "stay_put",
        rankingMembershipIds: ranking,
        walkover: true,
        walkoverBehavior: "automatic_loss_and_move_to_end",
        winBehavior: "take_opponent_position",
        winnerMembershipId: "m5",
      })
    ).toEqual(["m2", "m3", "m4", "m5", "m1"]);
  });

  it("sem W.O. o comportamento fica exatamente como antes", () => {
    expect(
      applyChallengeResultToRanking({
        challengedMembershipId: "m2",
        challengerMembershipId: "m4",
        lossBehavior: "stay_put",
        rankingMembershipIds: ranking,
        winBehavior: "take_opponent_position",
        winnerMembershipId: "m4",
      })
    ).toEqual(["m1", "m4", "m3", "m2", "m5"]);
  });
});
