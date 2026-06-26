import { describe, expect, it } from "bun:test";

import {
  buildRankingFormByMembership,
  padRankingForm,
  RANKING_FORM_SLOTS,
  type RankingFormEntry,
} from "./ranking-form";

const win = (finishedAt = 0): RankingFormEntry => ({ finishedAt, isWin: true });
const loss = (finishedAt = 0): RankingFormEntry => ({
  finishedAt,
  isWin: false,
});

describe("padRankingForm", () => {
  it("pads an empty form with null slots up to the default slot count", () => {
    expect(padRankingForm([])).toEqual(
      new Array(RANKING_FORM_SLOTS).fill(null)
    );
  });

  it("prepends null slots before the played games, preserving order", () => {
    const form = [win(1), loss(2), win(3)];

    expect(padRankingForm(form)).toEqual([null, null, win(1), loss(2), win(3)]);
  });

  it("returns exactly the requested slot count when provided", () => {
    expect(padRankingForm([], 3)).toHaveLength(3);
  });

  it("trims forms longer than the slot count, anchoring to the right", () => {
    const form = [win(1), loss(2), win(3), loss(4), win(5), win(6)];

    expect(padRankingForm(form)).toHaveLength(RANKING_FORM_SLOTS);
    expect(padRankingForm(form)?.[RANKING_FORM_SLOTS - 1]).toEqual(win(5));
  });

  it("returns an empty array for a non-positive slot count", () => {
    expect(padRankingForm([win(1)], 0)).toEqual([]);
  });
});

describe("buildRankingFormByMembership", () => {
  it("maps each membershipId to its form array copy", () => {
    const result = buildRankingFormByMembership([
      { form: [win(1), loss(2)], membershipId: "a" },
      { form: [win(3)], membershipId: "b" },
    ]);

    expect(result).toEqual({
      a: [win(1), loss(2)],
      b: [win(3)],
    });
  });

  it("returns an empty object for no forms", () => {
    expect(buildRankingFormByMembership([])).toEqual({});
  });
});
