import { useFormContext } from "react-hook-form";

import { Page } from "@/components/core/page";
import type { TournamentScreenValues } from "@/components/pages/tournaments/form-schema";
import { AddressFields } from "@/components/ui/address-fields";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentLocationRoute() {
  const { isSubmitPending } = useTournamentFormRoute();
  const form = useFormContext<TournamentScreenValues>();

  return (
    <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
      <AddressFields form={form} isSubmitPending={isSubmitPending} />
    </Page.ScrollView>
  );
}
