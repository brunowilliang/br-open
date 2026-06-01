import { describe, expect, it } from "bun:test";

import { DEFAULT_LEAGUE_MATCH_CONFIG } from "@convex/domains/league/contract";

import { buildChallengeCardScoreSummary } from "./challenge-card-score-summary";

describe("buildChallengeCardScoreSummary", () => {
  it("shows single-set game score for best-of-one matches", () => {
    expect(
      buildChallengeCardScoreSummary({
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 1,
        },
        sets: [
          {
            challengedGames: 3,
            challengerGames: 6,
            kind: "set",
          },
        ],
      })
    ).toEqual({
      challengedScore: "3",
      challengerScore: "6",
      setsSummary: null,
    });
  });

  it("shows sets won and per-set breakdown for best-of-three matches", () => {
    expect(
      buildChallengeCardScoreSummary({
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 3,
        },
        sets: [
          {
            challengedGames: 1,
            challengerGames: 6,
            kind: "set",
          },
          {
            challengedGames: 6,
            challengerGames: 4,
            kind: "set",
          },
          {
            challengedGames: 2,
            challengerGames: 6,
            kind: "set",
          },
        ],
      })
    ).toEqual({
      challengedScore: "1",
      challengerScore: "2",
      setsSummary: "6x1 | 4x6 | 6x2",
    });
  });

  it("shows sets won and per-set breakdown for best-of-five matches", () => {
    expect(
      buildChallengeCardScoreSummary({
        matchConfig: {
          ...DEFAULT_LEAGUE_MATCH_CONFIG,
          bestOfSets: 5,
        },
        sets: [
          {
            challengedGames: 1,
            challengerGames: 6,
            kind: "set",
          },
          {
            challengedGames: 4,
            challengerGames: 6,
            kind: "set",
          },
          {
            challengedGames: 6,
            challengerGames: 4,
            kind: "set",
          },
          {
            challengedGames: 6,
            challengerGames: 2,
            kind: "set",
          },
          {
            challengedGames: 2,
            challengerGames: 6,
            kind: "set",
          },
        ],
      })
    ).toEqual({
      challengedScore: "2",
      challengerScore: "3",
      setsSummary: "6x1 | 6x4 | 4x6 | 2x6 | 6x2",
    });
  });
});
