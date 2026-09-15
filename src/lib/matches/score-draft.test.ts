import { describe, expect, it } from "bun:test";

import {
  buildEmptyDraftSet,
  buildScoreboard,
  getLineLabel,
  isDraftSetBlank,
  toLeagueScoreSets,
  toScoreDraftSets,
  trimTrailingBlankSets,
} from "./score-draft";

describe("score-draft", () => {
  describe("buildEmptyDraftSet", () => {
    it("starts a score line blank", () => {
      expect(buildEmptyDraftSet("set")).toEqual({
        aGames: 0,
        bGames: 0,
        kind: "set",
      });
    });

    it("starts a standalone tie-break line blank", () => {
      expect(buildEmptyDraftSet("tiebreak")).toEqual({
        aGames: 0,
        bGames: 0,
        kind: "tiebreak",
      });
    });
  });

  describe("isDraftSetBlank", () => {
    it("detects a blank line only when both sides are zero", () => {
      expect(isDraftSetBlank({ aGames: 0, bGames: 0, kind: "set" })).toBe(true);
      expect(isDraftSetBlank({ aGames: 1, bGames: 0, kind: "set" })).toBe(
        false
      );
    });
  });

  describe("trimTrailingBlankSets", () => {
    it("drops only the trailing blank lines", () => {
      const sets = [
        { aGames: 7, bGames: 5, kind: "set" },
        { aGames: 0, bGames: 0, kind: "set" },
        { aGames: 0, bGames: 0, kind: "tiebreak" },
      ] satisfies ScoreDraftFixture[];

      expect(trimTrailingBlankSets(sets)).toEqual([
        { aGames: 7, bGames: 5, kind: "set" },
      ]);
    });

    it("keeps blank lines that are followed by played lines", () => {
      const sets = [
        { aGames: 7, bGames: 5, kind: "set" },
        { aGames: 0, bGames: 0, kind: "tiebreak" },
        { aGames: 3, bGames: 7, kind: "set" },
      ] satisfies ScoreDraftFixture[];

      expect(trimTrailingBlankSets(sets)).toEqual(sets);
    });
  });

  describe("side conversions", () => {
    it("maps A/B onto the league challenger/challenged vocabulary and back", () => {
      const draftSets = [
        { aGames: 7, bGames: 5, kind: "set" },
        { aGames: 2, bGames: 7, kind: "set" },
      ] satisfies ScoreDraftFixture[];

      const leagueSets = toLeagueScoreSets(draftSets);

      expect(leagueSets).toEqual([
        { challengedGames: 5, challengerGames: 7, kind: "set" },
        { challengedGames: 7, challengerGames: 2, kind: "set" },
      ]);
      expect(toScoreDraftSets(leagueSets)).toEqual(draftSets);
    });

    it("carries the attached tie-break mini-score across both vocabularies", () => {
      const draftSets = [
        {
          aGames: 7,
          bGames: 6,
          kind: "set",
          tieBreak: { aPoints: 8, bPoints: 6 },
        },
      ] satisfies ScoreDraftFixture[];

      const leagueSets = toLeagueScoreSets(draftSets);

      expect(leagueSets).toEqual([
        {
          challengedGames: 6,
          challengerGames: 7,
          kind: "set",
          tieBreak: { challengedPoints: 6, challengerPoints: 8 },
        },
      ]);
      expect(toScoreDraftSets(leagueSets)).toEqual(draftSets);
    });

    it("round-trips a standalone tie-break line", () => {
      const draftSets = [
        { aGames: 10, bGames: 8, kind: "tiebreak" },
      ] satisfies ScoreDraftFixture[];

      expect(toScoreDraftSets(toLeagueScoreSets(draftSets))).toEqual(draftSets);
    });
  });

  describe("getLineLabel", () => {
    it("numbers score lines and names tie-break lines", () => {
      const lines = [
        { aGames: 7, bGames: 5, kind: "set" },
        { aGames: 6, bGames: 7, kind: "set" },
        { aGames: 10, bGames: 8, kind: "tiebreak" },
        { aGames: 6, bGames: 2, kind: "set" },
      ] satisfies ScoreDraftFixture[];

      expect(getLineLabel(lines, 0)).toBe("Set 1");
      expect(getLineLabel(lines, 1)).toBe("Set 2");
      expect(getLineLabel(lines, 2)).toBe("Tie-break");
      expect(getLineLabel(lines, 3)).toBe("Set 3");
    });

    it("names a hydrated super tie-break line", () => {
      const lines = [
        { aGames: 10, bGames: 7, kind: "super_tiebreak" },
      ] satisfies ScoreDraftFixture[];

      expect(getLineLabel(lines, 0)).toBe("Super tie-break");
    });
  });

  describe("buildScoreboard", () => {
    it("counts each line for the side with more games/points", () => {
      expect(
        buildScoreboard([
          { aGames: 7, bGames: 5, kind: "set" },
          { aGames: 3, bGames: 7, kind: "set" },
          { aGames: 10, bGames: 8, kind: "tiebreak" },
        ])
      ).toEqual({ aLineWins: 2, bLineWins: 1, winnerSide: "a" });
    });

    it("keeps the match undecided while the lines are tied", () => {
      expect(
        buildScoreboard([
          { aGames: 7, bGames: 5, kind: "set" },
          { aGames: 3, bGames: 7, kind: "set" },
        ])
      ).toEqual({ aLineWins: 1, bLineWins: 1, winnerSide: null });
    });

    it("treats a tied line as no win for either side (3x3)", () => {
      expect(
        buildScoreboard([
          { aGames: 3, bGames: 3, kind: "set" },
          { aGames: 3, bGames: 3, kind: "set" },
        ])
      ).toEqual({ aLineWins: 0, bLineWins: 0, winnerSide: null });
    });

    it("counts a games-tied line for the side ahead on the attached tie-break", () => {
      expect(
        buildScoreboard([
          {
            aGames: 6,
            bGames: 6,
            kind: "set",
            tieBreak: { aPoints: 7, bPoints: 3 },
          },
        ])
      ).toEqual({ aLineWins: 1, bLineWins: 0, winnerSide: "a" });
    });

    it("leaves a games-tied line with a tied tie-break out of the count", () => {
      expect(
        buildScoreboard([
          {
            aGames: 6,
            bGames: 6,
            kind: "set",
            tieBreak: { aPoints: 5, bPoints: 5 },
          },
        ])
      ).toEqual({ aLineWins: 0, bLineWins: 0, winnerSide: null });
    });

    it("counts a standalone tie-break line for the winner side", () => {
      expect(
        buildScoreboard([
          { aGames: 6, bGames: 4, kind: "set" },
          { aGames: 10, bGames: 12, kind: "tiebreak" },
        ])
      ).toEqual({ aLineWins: 1, bLineWins: 1, winnerSide: null });
    });

    it("returns an empty scoreboard for no lines", () => {
      expect(buildScoreboard([])).toEqual({
        aLineWins: 0,
        bLineWins: 0,
        winnerSide: null,
      });
    });
  });
});

type ScoreDraftFixture = {
  aGames: number;
  bGames: number;
  kind: "set" | "super_tiebreak" | "tiebreak";
  tieBreak?: { aPoints: number; bPoints: number };
};
