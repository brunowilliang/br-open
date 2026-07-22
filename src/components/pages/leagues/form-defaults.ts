import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  DEFAULT_LEAGUE_APPROVAL_MODE,
  DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
  DEFAULT_LEAGUE_GRACE_PERIOD_DAYS,
  DEFAULT_LEAGUE_MATCH_CONFIG,
  DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
  DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
  DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
  DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
  DEFAULT_LEAGUE_RULE_CONFIG,
  DEFAULT_LEAGUE_STORAGE,
} from "@convex/domains/league/contract";

export function buildCreateLeagueDefaultValues(): LeagueScreenValues {
  return {
    approvalMode: DEFAULT_LEAGUE_APPROVAL_MODE,
    avatarStorageId: DEFAULT_LEAGUE_STORAGE.avatarStorageId,
    categories: [],
    city: "",
    courts: [],
    coverStorageId: DEFAULT_LEAGUE_STORAGE.coverStorageId,
    description: "",
    gracePeriodDays: DEFAULT_LEAGUE_GRACE_PERIOD_DAYS,
    locationNotes: "",
    maxPlayers: null,
    monthlyPriceCents: DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS,
    name: "",
    priceBillingInterval: DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL,
    reminderDaysBefore: DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE,
    ruleConfig: {
      ...DEFAULT_LEAGUE_RULE_CONFIG,
      challengeValidationMode: DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      hasInactivityPenalty: false,
      lossBehavior: "stay_put",
      matchConfig: {
        ...DEFAULT_LEAGUE_MATCH_CONFIG,
      },
      newPlayerPlacement: "end_of_ranking",
      resultValidationMode: DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
      walkoverBehavior: "automatic_loss",
      winBehavior: "take_opponent_position",
    },
    state: "",
    visibility: "public",
  };
}
