import type { ApiOutputs } from "@convex/shared/api";
import { Text } from "@/components/core/text";
import { View } from "react-native";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

/**
 * Visão do visitante na casa da liga (plano de conteúdo IBX-0071: só a
 * descrição em texto simples; card de features e alerta de pagamento dos
 * sub-estados guest saíram). O rodapé fixo de entrada (JoinFooter, modo
 * liga) continua montado pela página para o papel guest.
 */
export function GuestOverview(props: { league: LeagueOverview }) {
  const { league } = props;

  return (
    <View className="gap-4">
      {league.description ? <Text>{league.description}</Text> : null}
    </View>
  );
}
