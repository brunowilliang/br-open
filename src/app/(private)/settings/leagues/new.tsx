import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";

import {
  LeagueScreen,
  type LeagueScreenValues,
} from "@/components/pages/leagues/screen";
import { useCRPC } from "@/lib/convex/crpc";
import {
  DEFAULT_LEAGUE_MATCH_CONFIG,
  type CreateLeagueInput,
} from "@convex/domains/league/contract";

const defaultValues: LeagueScreenValues = {
  name: "",
  description: "",
  city: "",
  state: "",
  locationNotes: "",
  visibility: "private",
  categories: [],
  courts: [],
  ruleConfig: {
    maxChallengeDistance: 4,
    maxActiveChallengesPerPlayer: 1,
    maxChallengesPerMonth: 4,
    responseDeadlineHours: 48,
    winBehavior: "take_opponent_position",
    lossBehavior: "stay_put",
    walkoverBehavior: "automatic_loss",
    newPlayerPlacement: "end_of_ranking",
    hasInactivityPenalty: false,
    matchConfig: {
      ...DEFAULT_LEAGUE_MATCH_CONFIG,
    },
  },
};

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
          description: error.message || "Não foi possível criar a liga.",
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
      defaultValues={defaultValues}
      isPending={createLeague.isPending}
      isRulesLocked={false}
      mode="create"
      onSubmit={handleCreate}
      showDelete={false}
      title="Criar Liga"
    />
  );
}
