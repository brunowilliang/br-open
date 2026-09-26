import type { MatchConfig } from "@convex/domains/match/contract";
import { formatScoringMode, formatTieBreak } from "@/lib/rules/rule-format";

export type TournamentRulesView = {
  duration: string;
  format: string;
  scoring: string;
  setFormat: string;
  tieBreak: string;
};

export function buildTournamentRulesView(
  matchConfig: MatchConfig
): TournamentRulesView {
  return {
    duration: `${matchConfig.defaultDurationMinutes} min`,
    format: `Melhor de ${matchConfig.bestOfSets} sets`,
    scoring: formatScoringMode(matchConfig.scoringMode),
    setFormat: `${matchConfig.gamesPerSet} games`,
    tieBreak: formatTieBreak(matchConfig),
  };
}
