import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_MATCH_CONFIG,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_RULE_CONFIG,
  DEFAULT_LEAGUE_STORAGE,
} from "@convex/domains/league/contract";

export function buildCreateLeagueDefaultValues(): LeagueScreenValues {
  return {
    name: "",
    description: "",
    city: "",
    state: "",
    locationNotes: "",
    visibility: "public",
    categories: [],
    courts: [],
    maxPlayers: null,
    monthlyPriceCents: DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
    priceBillingInterval: DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
    coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
    avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
    ruleConfig: {
      ...DEFAULT_LEAGUE_RULE_CONFIG,
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
