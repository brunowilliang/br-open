import type {
  League,
  UpdateLeagueInput,
} from "@convex/domains/league/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "heroui-native";

import { Text } from "@/components/core/text";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { LeagueScreen } from "@/components/pages/leagues/screen";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
type FallbackColor = "danger" | "muted";

function toLeagueScreenValues(league: League): LeagueScreenValues {
  return {
    name: league.name,
    description: league.description ?? "",
    city: league.city,
    state: league.state,
    locationNotes: league.locationNotes ?? "",
    visibility: league.visibility,
    categories: league.categories,
    courts: league.courts,
    ruleConfig: league.ruleConfig,
  };
}

function toUpdateLeagueInput(
  leagueId: string,
  currentLeague: League,
  values: LeagueScreenValues
): UpdateLeagueInput {
  return {
    leagueId,
    name: values.name,
    description: values.description,
    city: values.city,
    state: values.state,
    locationNotes: values.locationNotes,
    visibility: values.visibility,
    categories: values.categories,
    courts: values.courts,
    ruleConfig: values.ruleConfig,
    coverStorageId: currentLeague.coverStorageId,
    avatarStorageId: currentLeague.avatarStorageId,
  };
}

function EditLeagueFallback(props: { color: FallbackColor; message: string }) {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Editar Liga</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        <Text color={props.color}>{props.message}</Text>
      </Page.ScrollView>
    </Page>
  );
}

export default function EditLeagueScreen() {
  const crpc = useCRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  const leagueQuery = useQuery({
    ...crpc.league.management.getById.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(leagueId),
  });

  const updateLeague = useMutation(
    crpc.league.management.update.mutationOptions({
      onSuccess: async (updatedLeague) => {
        await Promise.all([
          queryClient.invalidateQueries(
            crpc.league.management.listMine.queryFilter()
          ),
          queryClient.invalidateQueries(
            crpc.league.management.getById.queryFilter({
              leagueId: updatedLeague.id,
            })
          ),
        ]);
        toast.show({
          description: "Liga atualizada com sucesso.",
          id: "update-league-success",
          label: "Liga atualizada",
          variant: "success",
        });
        router.back();
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar a liga."
          ),
          id: "update-league-error",
          label: "Erro ao atualizar liga",
          variant: "danger",
        });
      },
    })
  );
  const deleteLeague = useMutation(
    crpc.league.management.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          crpc.league.management.listMine.queryFilter()
        );
        toast.show({
          description: "Liga deletada com sucesso.",
          id: "delete-league-success",
          label: "Liga deletada",
          variant: "success",
        });
        router.replace("/settings/leagues");
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível deletar a liga."
          ),
          id: "delete-league-error",
          label: "Erro ao deletar liga",
          variant: "danger",
        });
      },
    })
  );

  async function handleUpdate(values: LeagueScreenValues) {
    if (!(leagueId && leagueQuery.data)) {
      return;
    }

    updateLeague.reset();
    await updateLeague.mutateAsync(
      toUpdateLeagueInput(leagueId, leagueQuery.data, values)
    );
  }

  async function handleDelete() {
    if (!leagueId) {
      return;
    }

    deleteLeague.reset();
    await deleteLeague.mutateAsync({ leagueId });
  }

  if (!(leagueId && !leagueQuery.isPending && !leagueQuery.isError)) {
    let fallbackMessage = "Liga inválida.";

    if (leagueId) {
      fallbackMessage = leagueQuery.isPending
        ? "Carregando liga..."
        : leagueQuery.error?.message || "Não foi possível carregar a liga.";
    }

    const fallbackColor = !leagueId || leagueQuery.isError ? "danger" : "muted";

    return (
      <EditLeagueFallback color={fallbackColor} message={fallbackMessage} />
    );
  }

  return (
    <LeagueScreen
      defaultValues={toLeagueScreenValues(leagueQuery.data)}
      isPending={updateLeague.isPending || deleteLeague.isPending}
      key={`${leagueQuery.data.id}:${leagueQuery.data.updatedAt}`}
      mode="edit"
      onDelete={handleDelete}
      onSubmit={handleUpdate}
      title="Editar Liga"
    />
  );
}
