import { View } from "react-native";

import { Page } from "@/components/core/page";
import { CourtEditor } from "@/components/ui/court-editor";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentCourtsRoute() {
  const { isSubmitPending } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;

  return (
    <Page.ScrollView>
      <View className="grow gap-4 px-4 pb-safe-offset-4">
        <CourtEditor isDisabled={isDisabled} />
      </View>
    </Page.ScrollView>
  );
}
