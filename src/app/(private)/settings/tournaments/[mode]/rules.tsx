import { View } from "react-native";

import { Page } from "@/components/core/page";
import { MatchRulesSection } from "@/components/match-rules/match-rules-section";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentRulesRoute() {
  const { isSubmitPending } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;

  return (
    <Page.ScrollView>
      <View className="gap-4 px-4 pb-safe-offset-4">
        <MatchRulesSection isDisabled={isDisabled} prefix="matchConfig" />
      </View>
    </Page.ScrollView>
  );
}
