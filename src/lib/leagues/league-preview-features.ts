import type { ApiOutputs } from "@convex/shared/api";
import {
  ChampionIcon,
  RankingIcon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";

import { formatCount } from "@/lib/format/pluralize";
import {
  formatLossBehavior,
  formatNewPlayerPlacement,
  formatResponseDeadlineHours,
  formatWinBehavior,
} from "@/lib/leagues/rule-format";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type RuleConfig = LeagueOverview["ruleConfig"];

export type PreviewFeature = {
  description: string;
  icon: HugeiconsProps["icon"];
  title: string;
};

export function buildPreviewFeatures(ruleConfig: RuleConfig): PreviewFeature[] {
  return [
    {
      description: `${formatNewPlayerPlacement(ruleConfig.newPlayerPlacement, { style: "fragment" })} A partir daí, já pode disputar desafios e buscar posições acima.`,
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
      description: `Quem vence ${formatWinBehavior(ruleConfig.winBehavior, { style: "fragment" })}. Quem perde ${formatLossBehavior(ruleConfig.lossBehavior, { style: "fragment" })}.`,
      icon: ChampionIcon,
      title: "Suba jogando",
    },
  ];
}
