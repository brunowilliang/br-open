import type {
  LeagueChallengeScore,
  LeagueMatchConfig,
} from "@convex/domains/league/contract";

type ChallengeCardScoreSummary = {
  challengedScore: string;
  challengerScore: string;
  setsSummary: string | null;
};

type BuildChallengeCardScoreSummaryInput = {
  matchConfig: LeagueMatchConfig;
  sets: LeagueChallengeScore["sets"];
};

export function buildChallengeCardScoreSummary(
  input: BuildChallengeCardScoreSummaryInput
): ChallengeCardScoreSummary | null {
  if (input.sets.length === 0) {
    return null;
  }

  if (input.matchConfig.bestOfSets === 1) {
    const [firstSet] = input.sets;

    if (!firstSet) {
      return null;
    }

    return {
      challengedScore: String(firstSet.challengedGames),
      challengerScore: String(firstSet.challengerGames),
      setsSummary: null,
    };
  }

  let challengerSetsWon = 0;
  let challengedSetsWon = 0;

  for (const set of input.sets) {
    if (set.challengerGames > set.challengedGames) {
      challengerSetsWon += 1;
      continue;
    }

    if (set.challengedGames > set.challengerGames) {
      challengedSetsWon += 1;
    }
  }

  return {
    challengedScore: String(challengedSetsWon),
    challengerScore: String(challengerSetsWon),
    setsSummary: input.sets
      .map((set) => `${set.challengerGames}x${set.challengedGames}`)
      .join(" | "),
  };
}
