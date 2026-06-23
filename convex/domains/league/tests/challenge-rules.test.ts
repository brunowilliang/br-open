import { describe, expect, it } from "bun:test";

import {
  ACTIVE_CHALLENGE_BLOCKING_STATUSES,
  applyChallengeResultToRanking,
  buildChallengeScoreProgress,
  buildResponseDeadline,
  canPlayersCancelChallenge,
  getExpectedSetKind,
  getRequiredSetWins,
  isChallengeSlotBlocked,
  resolveAcceptedChallengeStatus,
  resolveChallengeScoreWinnerMembershipId,
  resolveChallengeRankingRestore,
  resolveConfirmedChallengeResult,
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  resolveReopenedChallengeStatus,
  resolveResponseDeadline,
  resolveScoreConfirmationStatus,
  validateChallengeScore,
} from "../challenge-rules";
import { DEFAULT_LEAGUE_MATCH_CONFIG } from "../contract";

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
    ).toBe("pending_admin_challenge_validation");
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
    ).toBe("pending_admin_result_validation");
  });

  it("finishes confirmed scores immediately when the league is automatic", () => {
    expect(
      resolveScoreConfirmationStatus({
        resultValidationMode: "automatic",
      })
    ).toBe("finished");
  });

  it("marks silent responses for admin decision", () => {
    expect(resolveNoResponseStatus()).toBe("pending_admin_decision");
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

  it("calculates the number of sets needed to win from the best-of format", () => {
    expect(getRequiredSetWins(1)).toBe(1);
    expect(getRequiredSetWins(3)).toBe(2);
    expect(getRequiredSetWins(5)).toBe(3);
  });

  it("reveals the deciding third set only after a best-of-three match reaches one set each", () => {
    const initialProgress = buildChallengeScoreProgress({
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 3,
      },
      sets: [],
    });

    expect(initialProgress.visibleSetCount).toBe(2);

    const splitMatchProgress = buildChallengeScoreProgress({
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 3,
      },
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
    });

    expect(splitMatchProgress.visibleSetCount).toBe(3);
    expect(splitMatchProgress.winnerSide).toBeNull();
  });

  it("reveals the fourth and fifth sets progressively in a best-of-five match", () => {
    const threeSetProgress = buildChallengeScoreProgress({
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 5,
      },
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
        {
          challengedGames: 4,
          challengerGames: 6,
          kind: "set",
        },
      ],
    });

    expect(threeSetProgress.visibleSetCount).toBe(4);
    expect(threeSetProgress.winnerSide).toBeNull();

    const fourSetProgress = buildChallengeScoreProgress({
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
        bestOfSets: 5,
      },
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
        {
          challengedGames: 4,
          challengerGames: 6,
          kind: "set",
        },
        {
          challengedGames: 6,
          challengerGames: 3,
          kind: "set",
        },
      ],
    });

    expect(fourSetProgress.visibleSetCount).toBe(5);
    expect(fourSetProgress.winnerSide).toBeNull();
  });

  it("uses a super tie-break only in the deciding set when configured", () => {
    const matchConfig = {
      ...DEFAULT_LEAGUE_MATCH_CONFIG,
      bestOfSets: 3,
      finalSetMode: "super_tiebreak" as const,
    };

    expect(getExpectedSetKind(matchConfig, 0)).toBe("set");
    expect(getExpectedSetKind(matchConfig, 1)).toBe("set");
    expect(getExpectedSetKind(matchConfig, 2)).toBe("super_tiebreak");
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

    expect(
      validateChallengeScore({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        score,
      })
    ).toBeNull();

    expect(
      resolveChallengeScoreWinnerMembershipId({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        sets: score.sets,
      })
    ).toBe("membership-1");
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
      validateChallengeScore({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-4",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        score,
      })
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
      nextStatus: "pending_admin_result_validation",
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

  it("rejects a best-of-three score without the deciding set after a one-set-each split", () => {
    expect(
      validateChallengeScore({
        challengedMembershipId: "membership-2",
        challengerMembershipId: "membership-1",
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
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
    ).toBe("Esse placar ainda não define o vencedor da partida.");
  });
});
