import { describe, expect, test } from "bun:test";

import { buildBracketScoreTokens, type ScoreSet } from "./score-display";

describe("buildBracketScoreTokens", () => {
  const sets: ScoreSet[] = [
    { aGames: 6, bGames: 3, kind: "set" },
    {
      aGames: 7,
      bGames: 6,
      kind: "set",
      tieBreak: { aPoints: 5, bPoints: 2 },
    },
    { aGames: 3, bGames: 6, kind: "set" },
  ];

  test("marks the side that won each set", () => {
    expect(buildBracketScoreTokens(sets, "a")).toEqual([
      { games: 6, isSetWinner: true, tieBreakPoints: null },
      { games: 7, isSetWinner: true, tieBreakPoints: 5 },
      { games: 3, isSetWinner: false, tieBreakPoints: null },
    ]);
  });

  test("mirrors the same sets for side B", () => {
    expect(buildBracketScoreTokens(sets, "b")).toEqual([
      { games: 3, isSetWinner: false, tieBreakPoints: null },
      { games: 6, isSetWinner: false, tieBreakPoints: 2 },
      { games: 6, isSetWinner: true, tieBreakPoints: null },
    ]);
  });

  test("decides a tied line by the attached tie-break", () => {
    const tied: ScoreSet[] = [
      {
        aGames: 6,
        bGames: 6,
        kind: "set",
        tieBreak: { aPoints: 7, bPoints: 5 },
      },
    ];

    expect(buildBracketScoreTokens(tied, "a")).toEqual([
      { games: 6, isSetWinner: true, tieBreakPoints: 7 },
    ]);
    expect(buildBracketScoreTokens(tied, "b")).toEqual([
      { games: 6, isSetWinner: false, tieBreakPoints: 5 },
    ]);
  });

  test("highlights neither side on a tie without a deciding tie-break", () => {
    const walkover: ScoreSet[] = [{ aGames: 0, bGames: 0, kind: "set" }];

    expect(buildBracketScoreTokens(walkover, "a")).toEqual([
      { games: 0, isSetWinner: false, tieBreakPoints: null },
    ]);
    expect(buildBracketScoreTokens(walkover, "b")).toEqual([
      { games: 0, isSetWinner: false, tieBreakPoints: null },
    ]);

    const tiedTieBreak: ScoreSet[] = [
      {
        aGames: 6,
        bGames: 6,
        kind: "set",
        tieBreak: { aPoints: 5, bPoints: 5 },
      },
    ];

    expect(buildBracketScoreTokens(tiedTieBreak, "a")[0]?.isSetWinner).toBe(
      false
    );
    expect(buildBracketScoreTokens(tiedTieBreak, "b")[0]?.isSetWinner).toBe(
      false
    );
  });

  test("applies the same rule to super tie-break and standalone lines", () => {
    const lines: ScoreSet[] = [
      { aGames: 10, bGames: 8, kind: "super_tiebreak" },
      { aGames: 3, bGames: 3, kind: "tiebreak" },
    ];

    expect(buildBracketScoreTokens(lines, "a")).toEqual([
      { games: 10, isSetWinner: true, tieBreakPoints: null },
      { games: 3, isSetWinner: false, tieBreakPoints: null },
    ]);
    expect(buildBracketScoreTokens(lines, "b")).toEqual([
      { games: 8, isSetWinner: false, tieBreakPoints: null },
      { games: 3, isSetWinner: false, tieBreakPoints: null },
    ]);
  });

  test("treats null tie-break (draft noise) as no tie-break points", () => {
    expect(
      buildBracketScoreTokens(
        [{ aGames: 6, bGames: 4, kind: "set", tieBreak: null }],
        "a"
      )
    ).toEqual([{ games: 6, isSetWinner: true, tieBreakPoints: null }]);
  });
});
