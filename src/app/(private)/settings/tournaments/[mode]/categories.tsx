import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { CategoryEditor } from "@/components/ui/category-editor";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentCategoriesRoute() {
  const { isSubmitPending } = useTournamentFormRoute();
  const isDisabled = isSubmitPending;

  return (
    <Page.ScrollView>
      <View className="grow gap-4 px-4 pb-safe-offset-4">
        <Text color="muted" variant="description">
          Cada categoria tem chave e inscrições próprias. O nome é livre e a
          taxa e o limite de vagas são opcionais.
        </Text>

        <CategoryEditor isDisabled={isDisabled} />
      </View>
    </Page.ScrollView>
  );
}
