import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";

import { buildCreateLeagueDefaultValues } from "@/components/pages/leagues/form-defaults";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { LeagueScreen } from "@/components/pages/leagues/screen";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
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
    maxPlayers: values.maxPlayers,
    monthlyPriceCents: values.monthlyPriceCents,
    priceBillingInterval: values.priceBillingInterval,
    coverStorageId: values.coverStorageId,
    avatarStorageId: values.avatarStorageId,
    ruleConfig: values.ruleConfig,
  };
}

export default function CreateLeagueScreen() {
  const crpc = useCRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const viewerContext = useQuery(crpc.viewer.context.get.queryOptions());
  const canManageLeagues =
    viewerContext.data?.capabilities?.canCreateLeague ?? false;

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

  if (viewerContext.isPending) {
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Criar Liga</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <LoadingState />
        </Page.ScrollView>
      </Page>
    );
  }

  if (viewerContext.isError) {
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Criar Liga</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <ErrorState
            error={viewerContext.error}
            message="Não foi possível carregar seu modo de acesso."
          />
        </Page.ScrollView>
      </Page>
    );
  }

  if (!canManageLeagues) {
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Criar Liga</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <EmptyState
            buttonLabel="Voltar"
            buttonOnPress={() => router.back()}
            description="Você está usando o app como jogador. Entre como organizador para criar ligas."
            title="Modo jogador"
          />
        </Page.ScrollView>
      </Page>
    );
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
