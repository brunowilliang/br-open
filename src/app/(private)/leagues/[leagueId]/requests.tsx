import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, ListGroup, Separator, useToast } from "heroui-native";
import { Fragment, type ReactNode, useEffect } from "react";

import { Image } from "@/components/core/image";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  resolveLeagueDetailsRequestContentState,
  resolveLeagueDetailsVisibleRequestItems,
} from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

export default function LeagueRequestsRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return <ErrorState message="Liga inválida." />;
  }

  return <LeagueRequestsRouteContent leagueId={leagueId} />;
}

function LeagueRequestsRouteContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const requestItems = useValue(bucket$.derived.requestItems);

  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({ leagueId }),
    enabled: access.canOpenRequests,
  });

  async function invalidateMembershipContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
    ]);
  }

  const approveMembership = useMutation(
    crpc.league.membership.approve.mutationOptions({
      onSuccess: async () => {
        await invalidateMembershipContext();
        toast.show({
          description: "Participante aprovado com sucesso.",
          id: "approve-membership-success",
          label: "Solicitação aprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível aprovar a solicitação."
          ),
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
        await invalidateMembershipContext();
        toast.show({
          description: "Solicitação reprovada com sucesso.",
          id: "reject-membership-success",
          label: "Solicitação reprovada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível reprovar a solicitação."
          ),
          id: "reject-membership-error",
          label: "Erro ao reprovar solicitação",
          variant: "danger",
        });
      },
    })
  );

  useEffect(() => {
    bucket$.actions.setActiveRoute("requests");
  }, [bucket$]);

  useEffect(() => {
    if (membershipOverviewQuery.data) {
      bucket$.actions.hydrateMembershipOverview(membershipOverviewQuery.data);
    }
  }, [bucket$, membershipOverviewQuery.data]);

  useEffect(() => {
    if (bootstrapStatus !== "ready") {
      return;
    }

    if (!access.canOpenRequests) {
      router.replace({
        params: { leagueId },
        pathname: "/leagues/[leagueId]",
      });
    }
  }, [access.canOpenRequests, bootstrapStatus, leagueId, router]);

  if (bootstrapStatus === "error") {
    return <ErrorState message="Não foi possível carregar a liga." />;
  }

  if (bootstrapStatus !== "ready") {
    return (
      <Page>
        <Page.ScrollView
          className="flex-1"
          contentContainerClassName="grow px-4 py-6"
        >
          <LoadingState />
        </Page.ScrollView>
      </Page>
    );
  }

  const isMembershipActionPending =
    approveMembership.isPending || rejectMembership.isPending;
  const visibleRequestItems = resolveLeagueDetailsVisibleRequestItems({
    membershipOverview: membershipOverviewQuery.data,
    requestItems,
  });
  const requestContentState = resolveLeagueDetailsRequestContentState({
    isError: membershipOverviewQuery.isError,
    isFetching: membershipOverviewQuery.isFetching,
    isPending: membershipOverviewQuery.isPending,
    requestCount: visibleRequestItems.length,
  });
  let requestsContent: ReactNode;

  if (requestContentState === "loading") {
    requestsContent = <LoadingState />;
  } else if (requestContentState === "error") {
    requestsContent = (
      <ErrorState
        error={membershipOverviewQuery.error}
        message="Não foi possível carregar as solicitações."
      />
    );
  } else if (requestContentState === "empty") {
    requestsContent = (
      <EmptyState
        description="Quando alguém solicitar entrada, ela aparecerá aqui."
        title="Nenhuma solicitação pendente"
      />
    );
  } else {
    requestsContent = (
      <ListGroup>
        {visibleRequestItems.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Image
                  className="size-10 rounded-full"
                  fallback="blue"
                  source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
                />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle numberOfLines={1}>
                  {item.name}
                </ListGroup.ItemTitle>
                <ListGroup.ItemDescription numberOfLines={1}>
                  {item.nickname}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix className="flex-row gap-1">
                <Button
                  isDisabled={isMembershipActionPending}
                  isIconOnly
                  onPress={() => {
                    rejectMembership.mutate({
                      leagueId,
                      membershipId: item.id,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  <HugeIcons icon={Cancel01Icon} />
                </Button>
                <Button
                  isDisabled={isMembershipActionPending}
                  isIconOnly
                  onPress={() => {
                    approveMembership.mutate({
                      leagueId,
                      membershipId: item.id,
                    });
                  }}
                  size="sm"
                >
                  <HugeIcons
                    className="text-accent-foreground"
                    icon={Tick02Icon}
                  />
                </Button>
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </Fragment>
        ))}
      </ListGroup>
    );
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Solicitações</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
      >
        {requestsContent}
      </Page.ScrollView>
    </Page>
  );
}
