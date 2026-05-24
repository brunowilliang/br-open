import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MATCH_CONFIG,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
} from "@convex/domains/league/contract";

export function buildCreateLeagueDefaultValues(): LeagueScreenValues {
  return {
    name: "",
    description: "",
    city: "",
    state: "",
    locationNotes: "",
    visibility: "private",
    categories: [],
    courts: [],
    ruleConfig: {
      maxChallengeDistance: 4,
      maxActiveChallengesPerPlayer: 1,
      maxChallengesPerMonth: 4,
      responseDeadlineHours: 48,
      winBehavior: "take_opponent_position",
      lossBehavior: "stay_put",
      walkoverBehavior: "automatic_loss",
      newPlayerPlacement: "end_of_ranking",
      challengeValidationMode: DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode: DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
      hasInactivityPenalty: false,
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
      },
    },
  };
}
