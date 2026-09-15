import type { ApiOutputs } from "@convex/shared/api";
import { EmptyState } from "@/components/ui/empty-state";
import { View } from "react-native";

import { Text } from "@/components/core/text";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

/** Visão do visitante na overview do torneio (molde league GuestOverview). */
export function GuestOverview(props: { tournament: TournamentOverview }) {
  const { tournament } = props;

  return (
    <View className="gap-4">
      {tournament.description ? <Text>{tournament.description}</Text> : null}

      {tournament.status === "published" ? (
        <EmptyState
          description="Escolha uma categoria no rodapé e garanta sua vaga."
          title="Inscrições abertas"
        />
      ) : null}
    </View>
  );
}
