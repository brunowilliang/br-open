import type { TournamentMatchConfig } from "@convex/domains/tournament/contract";
import {
  formatFinalSet,
  formatScoringMode,
  formatTieBreak,
} from "@/lib/leagues/rule-format";

export type TournamentRulesView = {
  duration: string;
  finalSet: string;
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
    finalSet: formatFinalSet(matchConfig),
    format: `Melhor de ${matchConfig.bestOfSets} sets`,
    scoring: formatScoringMode(matchConfig.scoringMode),
    setFormat: `${matchConfig.gamesPerSet} games`,
    tieBreak: formatTieBreak(matchConfig),
  };
}
