import { cn } from "better-styled";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import type { TournamentPhaseLine } from "@/lib/tournaments/tournament-details-derived";

type TournamentPhaseBandProps = {
  phaseLine: null | TournamentPhaseLine;
};

/** A faixa de fase no topo da casa: o mesmo recado nos três papéis (o rótulo e
 * a cor saem da derivada); sem marco, não desenha nada. */
export const TournamentPhaseBand = (props: TournamentPhaseBandProps) => {
  const { phaseLine } = props;

  if (!phaseLine) {
    return null;
  }

  return (
    <View
      className={cn(
        "items-center rounded-full px-4 py-2",
        phaseLine.color === "danger" ? "bg-danger-soft" : "bg-surface-secondary"
      )}
    >
      <Text
        align="center"
        color={phaseLine.color === "danger" ? "danger" : "muted"}
        variant="description"
      >
        {phaseLine.label}
      </Text>
    </View>
  );
};
