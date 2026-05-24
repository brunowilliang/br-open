import { describe, expect, it } from "bun:test";

import {
  ACTIVE_CHALLENGE_BLOCKING_STATUSES,
  applyChallengeResultToRanking,
  buildResponseDeadline,
  canPlayersCancelChallenge,
  isChallengeSlotBlocked,
  resolveAcceptedChallengeStatus,
  resolveMissingResultStatus,
  resolveNoResponseStatus,
  resolveReopenedChallengeStatus,
  resolveScoreConfirmationStatus,
} from "../challenge-rules";

describe("league challenge rules", () => {
  it("resets the response deadline on each counterproposal", () => {
    const nextDeadline = buildResponseDeadline({
      now: new Date("2026-05-21T12:00:00.000Z"),
      responseDeadlineHours: 48,
    });

    expect(nextDeadline.toISOString()).toBe("2026-05-23T12:00:00.000Z");
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
});
