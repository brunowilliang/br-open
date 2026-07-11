import type { ApiOutputs } from "@convex/shared/api";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type RuleConfig = LeagueOverview["ruleConfig"];

export function formatResponseDeadlineHours(hours: number): string {
  switch (hours) {
    case 12:
      return "12 horas";
    case 24:
      return "24 horas";
    case 48:
      return "48 horas";
    case 72:
      return "3 dias";
    case 120:
      return "5 dias";
    case 168:
      return "7 dias";
    default:
      return `${hours} horas`;
  }
}

export function formatWinBehavior(
  value: RuleConfig["winBehavior"],
  opts?: { style?: "fragment" | "full" }
): string {
  const style = opts?.style ?? "full";

  switch (value) {
    case "climb_one_position":
      return style === "full" ? "Quem vence sobe 1 posição." : "sobe 1 posição";
    default:
      return style === "full"
        ? "Quem vence assume a posição do adversário."
        : "assume a posição do adversário";
  }
}

export function formatLossBehavior(
  value: RuleConfig["lossBehavior"],
  opts?: { style?: "fragment" | "full" }
): string {
  const style = opts?.style ?? "full";

  switch (value) {
    case "drop_one_position":
      return style === "full" ? "Quem perde cai 1 posição." : "cai 1 posição";
    default:
      return style === "full"
        ? "Quem perde permanece onde está."
        : "permanece onde está";
  }
}

export function formatWalkoverBehavior(
  value: RuleConfig["walkoverBehavior"]
): string {
  switch (value) {
    case "automatic_loss_and_move_to_end":
      return "W.O. conta como derrota e leva o jogador ao final do ranking.";
    case "cancel_challenge":
      return "W.O. cancela o desafio e libera os jogadores.";
    default:
      return "W.O. conta como derrota automática.";
  }
}

export function formatNewPlayerPlacement(
  value: RuleConfig["newPlayerPlacement"],
  opts?: { style?: "fragment" | "full" }
): string {
  const style = opts?.style ?? "full";

  if (style === "fragment") {
    return "Ao entrar, você já aparece na tabela da liga.";
  }

  switch (value) {
    case "end_of_ranking":
    default:
      return "Novos jogadores entram no final do ranking.";
  }
}

export function formatScoringMode(
  value: RuleConfig["matchConfig"]["scoringMode"]
): string {
  switch (value) {
    case "no_advantage":
      return "Sem vantagem";
    default:
      return "Com vantagem";
  }
}

export function formatTieBreak(ruleConfig: RuleConfig): string {
  const { matchConfig } = ruleConfig;

  if (!matchConfig.hasTieBreak) {
    return "Sets sem tie-break";
  }

  const differenceRule = matchConfig.tieBreakMustWinByTwo
    ? "com 2 de diferença"
    : "ponto decisivo";

  return `Tie-break em ${matchConfig.tieBreakAtGamesAll}x${matchConfig.tieBreakAtGamesAll}, ${matchConfig.tieBreakPoints} pontos, ${differenceRule}`;
}

export function formatFinalSet(ruleConfig: RuleConfig): string {
  const { matchConfig } = ruleConfig;

  switch (matchConfig.finalSetMode) {
    case "custom_set":
      return `Último set com ${matchConfig.finalSetGamesPerSet} games`;
    case "super_tiebreak":
      return `Último set em super tie-break de ${matchConfig.finalSetSuperTieBreakPoints} pontos`;
    default:
      return "Último set igual aos anteriores";
  }
}

export function formatInactivity(ruleConfig: RuleConfig): string {
  if (!ruleConfig.hasInactivityPenalty) {
    return "A liga não aplica queda automática por inatividade.";
  }

  if (ruleConfig.inactivityPenaltyType === "move_to_ranking_end") {
    return `Após ${ruleConfig.inactivityPenaltyDays} dias sem jogar, o jogador vai para o final do ranking.`;
  }

  return `Após ${ruleConfig.inactivityPenaltyDays} dias sem jogar, o jogador cai 1 posição.`;
}
