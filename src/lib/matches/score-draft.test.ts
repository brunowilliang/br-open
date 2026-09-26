import { describe, expect, it } from "bun:test";

import {
  buildEmptyDraftSet,
  buildScoreboard,
  canAttachTieBreak,
  getLineLabel,
  isDraftSetBlank,
  settleAttachedTieBreak,
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

  describe("canAttachTieBreak", () => {
    it("offers the tie-break button on a tied set", () => {
      expect(canAttachTieBreak({ aGames: 1, bGames: 1, kind: "set" })).toBe(
        true
      );
      expect(canAttachTieBreak({ aGames: 2, bGames: 2, kind: "set" })).toBe(
        true
      );
      expect(canAttachTieBreak({ aGames: 3, bGames: 3, kind: "set" })).toBe(
        true
      );
    });

    it("hides the button on a blank set", () => {
      expect(canAttachTieBreak({ aGames: 0, bGames: 0, kind: "set" })).toBe(
        false
      );
    });

    it("hides the button once the set is decided", () => {
      expect(canAttachTieBreak({ aGames: 6, bGames: 3, kind: "set" })).toBe(
        false
      );
      expect(canAttachTieBreak({ aGames: 3, bGames: 6, kind: "set" })).toBe(
        false
      );
    });

    it("keeps the button hidden while a tie-break is attached", () => {
      expect(
        canAttachTieBreak({
          aGames: 1,
          bGames: 1,
          kind: "set",
          tieBreak: { aPoints: 7, bPoints: 3 },
        })
      ).toBe(false);
    });

    it("applies the same tied rule to super tie-break lines", () => {
      expect(
        canAttachTieBreak({ aGames: 0, bGames: 0, kind: "super_tiebreak" })
      ).toBe(false);
      expect(
        canAttachTieBreak({ aGames: 9, bGames: 9, kind: "super_tiebreak" })
      ).toBe(true);
    });

    it("never offers the tie-break button on a tie-break line (no nesting)", () => {
      expect(
        canAttachTieBreak({ aGames: 0, bGames: 0, kind: "tiebreak" })
      ).toBe(false);
      expect(
        canAttachTieBreak({ aGames: 7, bGames: 3, kind: "tiebreak" })
      ).toBe(false);
      expect(
        canAttachTieBreak({ aGames: 7, bGames: 7, kind: "tiebreak" })
      ).toBe(false);
    });
  });

  describe("settleAttachedTieBreak", () => {
    it("keeps the attached tie-break when the set stays tied", () => {
      const current = {
        aGames: 4,
        bGames: 4,
        kind: "set",
        tieBreak: { aPoints: 6, bPoints: 2 },
      } satisfies ScoreDraftFixture;

      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 5, bGames: 5 })
      ).toEqual({
        aGames: 5,
        bGames: 5,
        kind: "set",
        tieBreak: { aPoints: 6, bPoints: 2 },
      });
    });

    it("clears the attached tie-break once the set is decided", () => {
      const current = {
        aGames: 4,
        bGames: 4,
        kind: "set",
        tieBreak: { aPoints: 6, bPoints: 2 },
      } satisfies ScoreDraftFixture;

      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 5, bGames: 4 })
      ).toEqual({
        aGames: 5,
        bGames: 4,
        kind: "set",
        tieBreak: null,
      });
      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 4, bGames: 6 })
      ).toEqual({
        aGames: 4,
        bGames: 6,
        kind: "set",
        tieBreak: null,
      });
    });

    it("clears the attached tie-break when the score returns to blank", () => {
      const current = {
        aGames: 4,
        bGames: 4,
        kind: "set",
        tieBreak: { aPoints: 6, bPoints: 2 },
      } satisfies ScoreDraftFixture;

      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 0, bGames: 0 })
      ).toEqual({
        aGames: 0,
        bGames: 0,
        kind: "set",
        tieBreak: null,
      });
    });

    it("never touches the tie-break when only its own points change", () => {
      const current = {
        aGames: 4,
        bGames: 4,
        kind: "set",
        tieBreak: { aPoints: 0, bPoints: 0 },
      } satisfies ScoreDraftFixture;

      expect(
        settleAttachedTieBreak(current, {
          ...current,
          tieBreak: { aPoints: 6, bPoints: 2 },
        })
      ).toEqual({
        aGames: 4,
        bGames: 4,
        kind: "set",
        tieBreak: { aPoints: 6, bPoints: 2 },
      });
    });

    it("leaves a standalone tie-break line untouched", () => {
      const current = {
        aGames: 0,
        bGames: 0,
        kind: "tiebreak",
      } satisfies ScoreDraftFixture;
      const next = {
        aGames: 7,
        bGames: 3,
        kind: "tiebreak",
      } satisfies ScoreDraftFixture;

      expect(settleAttachedTieBreak(current, next)).toEqual(next);
    });

    it("applies the same rule to super tie-break lines", () => {
      const current = {
        aGames: 9,
        bGames: 9,
        kind: "super_tiebreak",
        tieBreak: { aPoints: 10, bPoints: 8 },
      } satisfies ScoreDraftFixture;

      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 10, bGames: 9 })
      ).toEqual({
        aGames: 10,
        bGames: 9,
        kind: "super_tiebreak",
        tieBreak: null,
      });
      expect(
        settleAttachedTieBreak(current, { ...current, aGames: 10, bGames: 10 })
      ).toEqual({
        aGames: 10,
        bGames: 10,
        kind: "super_tiebreak",
        tieBreak: { aPoints: 10, bPoints: 8 },
      });
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
