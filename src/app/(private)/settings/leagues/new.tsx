import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";

import { buildCreateLeagueDefaultValues } from "@/components/pages/leagues/form-defaults";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { LeagueScreen } from "@/components/pages/leagues/screen";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import type { CreateLeagueInput } from "@convex/domains/league/contract";

function toCreateLeagueInput(values: LeagueScreenValues): CreateLeagueInput {
  return {
    name: values.name,
    description: values.description,
    city: values.city,
    state: values.state,
    locationNotes: values.locationNotes,
    visibility: values.visibility,
    categories: values.categories,
    courts: values.courts,
    ruleConfig: values.ruleConfig,
  };
}

export default function CreateLeagueScreen() {
  const crpc = useCRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createLeague = useMutation(
    crpc.league.management.create.mutationOptions({
      onSuccess: async (createdLeague) => {
        await queryClient.invalidateQueries(
          crpc.league.management.listMine.queryFilter()
        );
        toast.show({
          description: "Liga criada com sucesso.",
          id: "create-league-success",
          label: "Liga criada",
          variant: "success",
        });
        router.replace({
          pathname: "/leagues/[leagueId]",
          params: { leagueId: createdLeague.id },
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível criar a liga."
          ),
          id: "create-league-error",
          label: "Erro ao criar liga",
          variant: "danger",
        });
      },
    })
  );

  async function handleCreate(input: LeagueScreenValues) {
    createLeague.reset();
    await createLeague.mutateAsync(toCreateLeagueInput(input));
  }

  return (
    <LeagueScreen
      defaultValues={buildCreateLeagueDefaultValues()}
      isPending={createLeague.isPending}
      isRulesLocked={false}
      mode="create"
      onSubmit={handleCreate}
      showDelete={false}
      title="Criar Liga"
    />
  );
}
