import type { ApiOutputs } from "@convex/shared/api";
import { Text } from "@/components/core/text";
import { View } from "react-native";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

/**
 * Visão do visitante na casa do torneio (plano de conteúdo IBX-0071: só a
 * descrição em texto simples; card de features e EmptyState saíram).
 */
export function GuestOverview(props: { tournament: TournamentOverview }) {
  const { tournament } = props;

  return (
    <View className="gap-4">
      {tournament.description ? <Text>{tournament.description}</Text> : null}
    </View>
  );
}
