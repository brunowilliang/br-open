import type { ApiOutputs } from "@convex/shared/api";
import {
  ChampionIcon,
  RankingIcon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type RuleConfig = LeagueOverview["ruleConfig"];

export type PreviewFeature = {
  description: string;
  icon: HugeiconsProps["icon"];
  title: string;
};

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatResponseDeadlineHours(hours: number) {
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

function formatWinBehavior(value: RuleConfig["winBehavior"]) {
  switch (value) {
    case "climb_one_position":
      return "sobe 1 posição";
    default:
      return "assume a posição do adversário";
  }
}

function formatLossBehavior(value: RuleConfig["lossBehavior"]) {
  switch (value) {
    case "drop_one_position":
      return "cai 1 posição";
    default:
      return "permanece onde está";
  }
}

function formatRankingEntry(value: RuleConfig["newPlayerPlacement"]) {
  switch (value) {
    case "end_of_ranking":
    default:
      return "Ao entrar, você já aparece na tabela da liga.";
  }
}

export function buildPreviewFeatures(ruleConfig: RuleConfig): PreviewFeature[] {
  return [
    {
      description: `${formatRankingEntry(ruleConfig.newPlayerPlacement)} A partir daí, já pode disputar desafios e buscar posições acima.`,
      icon: RankingIcon,
      title: "Comece no ranking",
    },
    {
      description: `Você pode desafiar ${
        ruleConfig.maxChallengeDistance.enabled
          ? formatCount(
              ruleConfig.maxChallengeDistance.value,
              "posição",
              "posições"
            )
          : "qualquer posição"
      } acima e o adversário tem ${
        ruleConfig.responseDeadlineHours.enabled
          ? formatResponseDeadlineHours(ruleConfig.responseDeadlineHours.value)
          : "sem prazo"
      } para responder.`,
      icon: Target02Icon,
      title: "Faça/Receba Desafios",
    },
    {
      description: `Quem vence ${formatWinBehavior(ruleConfig.winBehavior)}. Quem perde ${formatLossBehavior(ruleConfig.lossBehavior)}.`,
      icon: ChampionIcon,
      title: "Suba jogando",
    },
  ];
}
