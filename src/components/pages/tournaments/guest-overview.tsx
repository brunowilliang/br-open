import type { ApiOutputs } from "@convex/shared/api";
import { Text } from "@/components/core/text";
import { View } from "react-native";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

export function GuestOverview(props: { tournament: TournamentOverview }) {
  const { tournament } = props;

  return (
    <View className="gap-4">
      {tournament.description ? <Text>{tournament.description}</Text> : null}
    </View>
  );
}
