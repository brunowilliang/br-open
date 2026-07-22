import { describe, expect, it } from "bun:test";

import {
  resolveMembershipForms,
  type FormFinishedChallenge,
} from "../challenge-form";

function finishedChallenge(input: {
  challenger: string;
  challenged: string;
  winner: string;
  finishedAt: number;
}): FormFinishedChallenge {
  return {
    challengedMembershipId: input.challenged,
    challengerMembershipId: input.challenger,
    finishedAt: input.finishedAt,
    winnerMembershipId: input.winner,
  };
}

describe("resolveMembershipForms", () => {
  it("attributes a win to the winner side and a loss to the loser side", () => {
    const forms = resolveMembershipForms([
      finishedChallenge({
        challenged: "b",
        challenger: "a",
        finishedAt: 100,
        winner: "a",
      }),
    ]);

    expect(forms.get("a")).toEqual([{ finishedAt: 100, isWin: true }]);
    expect(forms.get("b")).toEqual([{ finishedAt: 100, isWin: false }]);
  });

  it("returns entries ordered oldest → newest (left → right)", () => {
    const forms = resolveMembershipForms([
      finishedChallenge({
        challenged: "a",
        challenger: "x",
        finishedAt: 300,
        winner: "a",
      }),
      finishedChallenge({
        challenged: "a",
        challenger: "y",
        finishedAt: 100,
        winner: "a",
      }),
      finishedChallenge({
        challenged: "a",
        challenger: "z",
        finishedAt: 200,
        winner: "a",
      }),
    ]);

    expect(forms.get("a")).toEqual([
      { finishedAt: 100, isWin: true },
      { finishedAt: 200, isWin: true },
      { finishedAt: 300, isWin: true },
    ]);
  });

  it("keeps only the most recent five games per membership", () => {
    const challenges: FormFinishedChallenge[] = Array.from(
      { length: 7 },
      (_, index) =>
        finishedChallenge({
          challenged: "a",
          challenger: `o${index}`,
          finishedAt: 1000 + index,
          winner: "a",
        })
    );

    const forms = resolveMembershipForms(challenges);

    expect(forms.get("a")).toHaveLength(5);
    // Drops the two oldest, keeps the five most recent in oldest → newest order.
    expect(forms.get("a")?.[0]?.finishedAt).toBe(1002);
    expect(forms.get("a")?.[4]?.finishedAt).toBe(1006);
  });

  it("omits memberships that never finished a game", () => {
    const forms = resolveMembershipForms([
      finishedChallenge({
        challenged: "b",
        challenger: "a",
        finishedAt: 100,
        winner: "a",
      }),
    ]);

    expect(forms.has("c")).toBe(false);
  });

  it("ignores challenges without a winner on either side", () => {
    const forms = resolveMembershipForms([
      finishedChallenge({
        challenged: "b",
        challenger: "a",
        finishedAt: 100,
        winner: "someone-else",
      }),
    ]);

    expect(forms.has("a")).toBe(false);
    expect(forms.has("b")).toBe(false);
  });

  it("ignores challenges with an invalid finishedAt timestamp", () => {
    const forms = resolveMembershipForms([
      finishedChallenge({
        challenged: "b",
        challenger: "a",
        finishedAt: Number.NaN,
        winner: "a",
      }),
    ]);

    expect(forms.size).toBe(0);
  });
});
