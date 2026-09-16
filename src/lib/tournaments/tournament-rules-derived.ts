import type { TournamentMatchConfig } from "@convex/domains/tournament/contract";
import { formatScoringMode, formatTieBreak } from "@/lib/leagues/rule-format";

export type TournamentRulesView = {
  duration: string;
  format: string;
  scoring: string;
  setFormat: string;
  tieBreak: string;
};

export function buildTournamentRulesView(
  matchConfig: TournamentMatchConfig
): TournamentRulesView {
  return {
    duration: `${matchConfig.defaultDurationMinutes} min`,
    format: `Melhor de ${matchConfig.bestOfSets} sets`,
    scoring: formatScoringMode(matchConfig.scoringMode),
    setFormat: `${matchConfig.gamesPerSet} games`,
    tieBreak: formatTieBreak(matchConfig),
  };
}
