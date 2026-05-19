import type {
  League,
  UpdateLeagueInput,
} from "@convex/domains/league/contract";
import type { ApiOutputs } from "@convex/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "heroui-native";

import {
  Classification,
  type ClassificationItem,
} from "@/components/pages/leagues/classification";
import {
  LeagueScreen,
  type LeagueScreenValues,
} from "@/components/pages/leagues/screen";
import {
  MembershipRequests,
  type MembershipRequestItem,
} from "@/components/pages/leagues/membership-requests";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { useCRPC } from "@/lib/convex/crpc";

type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];
type FallbackColor = "danger" | "muted";

function toLeagueScreenValues(league: League): LeagueScreenValues {
  return {
    name: league.name,
    description: league.description ?? "",
    regulation: league.regulation ?? "",
    city: league.city,
    state: league.state,
    locationNotes: league.locationNotes ?? "",
    visibility: league.visibility,
    categories: league.categories,
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
    regulation: values.regulation,
    city: values.city,
    state: values.state,
    locationNotes: values.locationNotes,
    visibility: values.visibility,
    categories: values.categories,
    ruleConfig: values.ruleConfig,
    coverStorageId: currentLeague.coverStorageId,
    avatarStorageId: currentLeague.avatarStorageId,
  };
}

function buildMembershipRequestItems(data?: MembershipOverview) {
  return (
    data?.pendingRequests.map((item) => ({
      avatarUrl: item.player.avatarUrl,
      id: item.id,
      name: item.player.fullName,
      nickname: item.player.nickname,
    })) ?? []
  );
}

function buildClassificationItems(data?: MembershipOverview) {
  return (
    data?.ranking.map((item, index) => ({
      avatarUrl: item.player.avatarUrl,
      id: item.id,
      name: item.player.fullName,
      nickname: item.player.nickname,
      position: item.rankingPosition ?? index + 1,
    })) ?? []
  );
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

function MembershipRequestsContent(props: {
  errorMessage?: string;
  isPending?: boolean;
  isQueryError: boolean;
  isQueryPending: boolean;
  items: MembershipRequestItem[];
  onApprove: (membershipId: string) => void;
  onReject: (membershipId: string) => void;
}) {
  if (props.isQueryPending) {
    return <LoadingState />;
  }

  if (props.isQueryError) {
    return <ErrorState message={props.errorMessage} />;
  }

  return (
    <MembershipRequests
      isPending={props.isPending}
      items={props.items}
      onApprove={props.onApprove}
      onReject={props.onReject}
    />
  );
}

function RankingContent(props: {
  errorMessage?: string;
  isDisabled?: boolean;
  isQueryError: boolean;
  isQueryPending: boolean;
  items: ClassificationItem[];
  onChange: (items: ClassificationItem[]) => void;
}) {
  if (props.isQueryPending) {
    return <LoadingState />;
  }

  if (props.isQueryError) {
    return <ErrorState message={props.errorMessage} />;
  }

  return (
    <Classification
      isDisabled={props.isDisabled}
      items={props.items}
      onChange={props.onChange}
    />
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
  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({
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
          description: error.message || "Não foi possível atualizar a liga.",
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
          description: error.message || "Não foi possível deletar a liga.",
          id: "delete-league-error",
          label: "Erro ao deletar liga",
          variant: "danger",
        });
      },
    })
  );
  const approveMembership = useMutation(
    crpc.league.membership.approve.mutationOptions({
      onSuccess: async () => {
        if (!leagueId) {
          return;
        }

        await Promise.all([
          queryClient.invalidateQueries(
            crpc.league.membership.getOverview.queryFilter({ leagueId })
          ),
          queryClient.invalidateQueries(
            crpc.league.discovery.getById.queryFilter({ leagueId })
          ),
        ]);
        toast.show({
          description: "Participante aprovado com sucesso.",
          id: "approve-membership-success",
          label: "Solicitação aprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description:
            error.message || "Não foi possível aprovar a solicitação.",
          id: "approve-membership-error",
          label: "Erro ao aprovar solicitação",
          variant: "danger",
        });
      },
    })
  );
  const rejectMembership = useMutation(
    crpc.league.membership.reject.mutationOptions({
      onSuccess: async () => {
        if (!leagueId) {
          return;
        }

        await Promise.all([
          queryClient.invalidateQueries(
            crpc.league.membership.getOverview.queryFilter({ leagueId })
          ),
          queryClient.invalidateQueries(
            crpc.league.discovery.getById.queryFilter({ leagueId })
          ),
        ]);
        toast.show({
          description: "Solicitação reprovada com sucesso.",
          id: "reject-membership-success",
          label: "Solicitação reprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description:
            error.message || "Não foi possível reprovar a solicitação.",
          id: "reject-membership-error",
          label: "Erro ao reprovar solicitação",
          variant: "danger",
        });
      },
    })
  );
  const reorderRanking = useMutation(
    crpc.league.membership.reorderRanking.mutationOptions({
      onSuccess: async () => {
        if (!leagueId) {
          return;
        }

        await queryClient.invalidateQueries(
          crpc.league.membership.getOverview.queryFilter({ leagueId })
        );
        toast.show({
          description: "Ranking atualizado com sucesso.",
          id: "reorder-ranking-success",
          label: "Ranking atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: error.message || "Não foi possível atualizar o ranking.",
          id: "reorder-ranking-error",
          label: "Erro ao atualizar ranking",
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

  const requestItems = buildMembershipRequestItems(
    membershipOverviewQuery.data
  );
  const rankingItems = buildClassificationItems(membershipOverviewQuery.data);

  return (
    <LeagueScreen
      defaultValues={toLeagueScreenValues(leagueQuery.data)}
      isPending={updateLeague.isPending || deleteLeague.isPending}
      key={`${leagueQuery.data.id}:${leagueQuery.data.updatedAt}`}
      mode="edit"
      onDelete={handleDelete}
      onSubmit={handleUpdate}
      rankingContent={
        <RankingContent
          errorMessage={membershipOverviewQuery.error?.message}
          isDisabled={reorderRanking.isPending}
          isQueryError={membershipOverviewQuery.isError}
          isQueryPending={membershipOverviewQuery.isPending}
          items={rankingItems}
          onChange={(items) => {
            if (!leagueId) {
              return;
            }

            reorderRanking.mutate({
              leagueId,
              membershipIds: items.map((item) => item.id),
            });
          }}
        />
      }
      requestsContent={
        <MembershipRequestsContent
          errorMessage={membershipOverviewQuery.error?.message}
          isPending={approveMembership.isPending || rejectMembership.isPending}
          isQueryError={membershipOverviewQuery.isError}
          isQueryPending={membershipOverviewQuery.isPending}
          items={requestItems}
          onApprove={(membershipId) => {
            if (!leagueId) {
              return;
            }

            approveMembership.mutate({ leagueId, membershipId });
          }}
          onReject={(membershipId) => {
            if (!leagueId) {
              return;
            }

            rejectMembership.mutate({ leagueId, membershipId });
          }}
        />
      }
      title="Editar Liga"
    />
  );
}
