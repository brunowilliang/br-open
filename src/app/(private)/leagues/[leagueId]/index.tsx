import type { ApiOutputs } from "@convex/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  Button,
  Description,
  ListGroup,
  Separator,
  Tabs,
  useToast,
} from "heroui-native";
import { Badge } from "heroui-native-pro";
import { Fragment, useState } from "react";
import { ScrollView, View } from "react-native";

import { Image } from "@/components/core/image";
import { Ranking } from "@/components/pages/leagues/ranking";
import { MembershipRequests } from "@/components/pages/leagues/membership-requests";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { getMembershipActionLabel } from "@/lib/leagues/presentation";

type RuleConfig = ApiOutputs["league"]["management"]["getById"]["ruleConfig"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];

type RuleItem = {
  label: string;
  value: string;
};

type RuleSection = {
  items: RuleItem[];
  title: string;
};

function formatResponseDeadlineHours(hours: number) {
  switch (hours) {
    case 12:
      return "12 horas";
    case 24:
      return "24 horas";
    case 48:
      return "48 horas";
    case 72:
      return "3 dias";
    case 120:
      return "5 dias";
    case 168:
      return "7 dias";
    default:
      return `${hours} horas`;
  }
}

function formatWinBehavior(value: RuleConfig["winBehavior"]) {
  switch (value) {
    case "climb_one_position":
      return "Sobe 1 posição";
    default:
      return "Assume a posição do adversário";
  }
}

function formatLossBehavior(value: RuleConfig["lossBehavior"]) {
  switch (value) {
    case "drop_one_position":
      return "Cai 1 posição";
    default:
      return "Continua na mesma posição";
  }
}

function formatWalkoverBehavior(value: RuleConfig["walkoverBehavior"]) {
  switch (value) {
    case "automatic_loss_and_move_to_end":
      return "Derrota automática e vai para o final do ranking";
    case "cancel_challenge":
      return "Desafio cancelado";
    default:
      return "Derrota automática";
  }
}

function formatNewPlayerPlacement(value: RuleConfig["newPlayerPlacement"]) {
  switch (value) {
    case "end_of_ranking":
    default:
      return "Final da fila";
  }
}

function formatInactivityPenaltyType(
  value: RuleConfig["inactivityPenaltyType"]
) {
  switch (value) {
    case "move_to_ranking_end":
      return "Vai para o final do ranking";
    case "drop_one_position":
    default:
      return "Cai 1 posição";
  }
}

function formatBoolean(value: boolean) {
  return value ? "Sim" : "Não";
}

function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_ad":
      return "No-ad";
    default:
      return "Com vantagem";
  }
}

function formatTieBreakSummary(input: {
  gamesAll: number;
  hasTieBreak: boolean;
  mustWinByTwo: boolean;
  points: number;
}) {
  if (!input.hasTieBreak) {
    return "Não";
  }

  return `${input.gamesAll}x${input.gamesAll}, ${input.points} pontos${input.mustWinByTwo ? ", com 2 de diferença" : ""}`;
}

function formatFinalSetSummary(matchConfig: RuleConfig["matchConfig"]) {
  switch (matchConfig.finalSetMode) {
    case "custom_set":
      return `${matchConfig.finalSetGamesPerSet} games, ${formatScoringMode(matchConfig.finalSetScoringMode)}, ${matchConfig.finalSetHasTieBreak ? `tie-break em ${matchConfig.finalSetTieBreakAtGamesAll}x${matchConfig.finalSetTieBreakAtGamesAll} com ${matchConfig.finalSetTieBreakPoints} pontos` : "sem tie-break"}`;
    case "super_tiebreak":
      return `Super tie-break de ${matchConfig.finalSetSuperTieBreakPoints} pontos${matchConfig.finalSetSuperTieBreakMustWinByTwo ? ", com 2 de diferença" : ""}`;
    default:
      return "Igual aos sets anteriores";
  }
}

function buildRuleSections(ruleConfig: RuleConfig): RuleSection[] {
  const rankingItems: RuleItem[] = [
    {
      label: "Entrada de novo jogador",
      value: formatNewPlayerPlacement(ruleConfig.newPlayerPlacement),
    },
    {
      label: "Penalidade por inatividade",
      value: ruleConfig.hasInactivityPenalty ? "Ativada" : "Desativada",
    },
  ];

  if (ruleConfig.hasInactivityPenalty) {
    rankingItems.push(
      {
        label: "Qual penalidade aplicar?",
        value: formatInactivityPenaltyType(ruleConfig.inactivityPenaltyType),
      },
      {
        label: "Após quanto tempo sem jogar?",
        value: `${ruleConfig.inactivityPenaltyDays} dias`,
      }
    );
  }

  return [
    {
      items: [
        {
          label: "Pode desafiar quantas posições acima?",
          value: `${ruleConfig.maxChallengeDistance} posições`,
        },
        {
          label: "Máx. desafios ativos por jogador?",
          value: `${ruleConfig.maxActiveChallengesPerPlayer} ativos`,
        },
        {
          label: "Máx. desafios por mês?",
          value: `${ruleConfig.maxChallengesPerMonth} desafios`,
        },
        {
          label: "Prazo para responder desafio",
          value: formatResponseDeadlineHours(ruleConfig.responseDeadlineHours),
        },
      ],
      title: "Desafios",
    },
    {
      items: [
        {
          label: "Vitória no desafio",
          value: formatWinBehavior(ruleConfig.winBehavior),
        },
        {
          label: "Derrota no desafio",
          value: formatLossBehavior(ruleConfig.lossBehavior),
        },
        {
          label: "W.O.",
          value: formatWalkoverBehavior(ruleConfig.walkoverBehavior),
        },
      ],
      title: "Resultado",
    },
    {
      items: rankingItems,
      title: "Ranking",
    },
    {
      items: [
        {
          label: "Quantos sets?",
          value: `${ruleConfig.matchConfig.bestOfSets} sets`,
        },
        {
          label: "Quantos games por set?",
          value: `${ruleConfig.matchConfig.gamesPerSet} games`,
        },
        {
          label: "Duração padrão da partida",
          value: `${ruleConfig.matchConfig.defaultDurationMinutes} min`,
        },
        {
          label: "Pontuação dos games",
          value: formatScoringMode(ruleConfig.matchConfig.scoringMode),
        },
        {
          label: "Vencer o set por 2 games",
          value: formatBoolean(ruleConfig.matchConfig.setMustWinByTwoGames),
        },
        {
          label: "Tie-break",
          value: formatTieBreakSummary({
            gamesAll: ruleConfig.matchConfig.tieBreakAtGamesAll,
            hasTieBreak: ruleConfig.matchConfig.hasTieBreak,
            mustWinByTwo: ruleConfig.matchConfig.tieBreakMustWinByTwo,
            points: ruleConfig.matchConfig.tieBreakPoints,
          }),
        },
        {
          label: "Último set",
          value: formatFinalSetSummary(ruleConfig.matchConfig),
        },
      ],
      title: "Partidas",
    },
  ];
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

function buildRankingItems(data?: MembershipOverview) {
  return (
    data?.ranking.map((item, index) => ({
      avatarUrl: item.player.avatarUrl,
      id: item.id,
      name: item.player.fullName,
      nickname: item.player.nickname,
      position: item.rankingPosition ?? index + 1,
      userId: item.userId,
    })) ?? []
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this screen coordinates public, member, and manager league states in one route
export default function LeagueDetailsScreen() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const [activeTab, setActiveTab] = useState("details");

  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(leagueId),
  });
  const membershipOverviewQuery = useQuery({
    ...crpc.league.membership.getOverview.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(
      leagueId &&
        (leagueQuery.data?.isManagerOwner ||
          leagueQuery.data?.viewerMembershipStatus === "active")
    ),
  });
  const requestJoin = useMutation(
    crpc.league.membership.requestJoin.mutationOptions({
      onSuccess: async (membership) => {
        if (!leagueId) {
          return;
        }

        await Promise.all([
          queryClient.invalidateQueries(
            crpc.league.discovery.getById.queryFilter({ leagueId })
          ),
          queryClient.invalidateQueries(
            crpc.league.membership.getOverview.queryFilter({ leagueId })
          ),
        ]);

        toast.show({
          description:
            membership.status === "active"
              ? "Você entrou como jogador na liga."
              : "Solicitação enviada para aprovação.",
          id: "request-join-success",
          label:
            membership.status === "active"
              ? "Entrada confirmada"
              : "Solicitação enviada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: error.message || "Não foi possível solicitar entrada.",
          id: "request-join-error",
          label: "Erro ao solicitar entrada",
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
  const removeMembership = useMutation(
    crpc.league.membership.remove.mutationOptions({
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
          description: "Jogador removido com sucesso.",
          id: "remove-membership-success",
          label: "Jogador removido",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: error.message || "Não foi possível remover o jogador.",
          id: "remove-membership-error",
          label: "Erro ao remover jogador",
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

  if (!leagueId) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="grow px-4 py-6">
        <ErrorState message="Liga inválida." />
      </ScrollView>
    );
  }

  if (leagueQuery.isPending) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="grow px-4 py-6">
        <LoadingState />
      </ScrollView>
    );
  }

  if (leagueQuery.isError) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="grow px-4 py-6">
        <ErrorState message={leagueQuery.error.message} />
      </ScrollView>
    );
  }

  const league = leagueQuery.data;
  const ruleSections = buildRuleSections(league.ruleConfig);
  const isManagerOwner = league.isManagerOwner;
  const isAcceptedViewer = league.viewerMembershipStatus === "active";
  const showRankingTab = isManagerOwner || isAcceptedViewer;
  const showRequestsTab = isManagerOwner;
  const showRulesTab = !isManagerOwner;
  const showJoinFooter = !(isManagerOwner || isAcceptedViewer);
  const isRankingTabActive = showRankingTab && activeTab === "ranking";
  const membershipLabel = getMembershipActionLabel(
    league.viewerMembershipStatus,
    {
      isManagerOwner,
    }
  );
  const rankingItems = buildRankingItems(membershipOverviewQuery.data);
  const requestItems = buildMembershipRequestItems(
    membershipOverviewQuery.data
  );
  const viewerPosition =
    rankingItems.find((item) => item.userId === session?.user?.id)?.position ??
    null;
  const isJoinDisabled =
    requestJoin.isPending || league.viewerMembershipStatus === "pending";

  return (
    <Tabs
      className="flex-1"
      onValueChange={setActiveTab}
      value={activeTab}
      variant="primary"
    >
      <Page>
        <Page.Header>
          <View className="flex-1 flex-col gap-2">
            <View className="flex-1 flex-row">
              <Page.Header.Left>
                <Page.Header.BackButton />
              </Page.Header.Left>
              <Page.Header.Center>
                <Page.Header.Title>{league.name}</Page.Header.Title>
              </Page.Header.Center>
              <Page.Header.Right />
            </View>
            <Tabs.List className="self-center">
              <Tabs.Indicator />
              <Tabs.Trigger value="details">
                <Tabs.Label>Detalhes</Tabs.Label>
              </Tabs.Trigger>
              {showRankingTab ? (
                <Tabs.Trigger value="ranking">
                  <Tabs.Label>Ranking</Tabs.Label>
                </Tabs.Trigger>
              ) : null}
              {showRequestsTab ? (
                <Tabs.Trigger value="requests">
                  <Tabs.Label>Solicitações</Tabs.Label>
                  {requestItems.length ? (
                    <Badge
                      className="absolute top-1 right-1"
                      color="danger"
                      size="sm"
                    >
                      {requestItems.length}
                    </Badge>
                  ) : null}
                </Tabs.Trigger>
              ) : null}
              {showRulesTab ? (
                <Tabs.Trigger value="rules">
                  <Tabs.Label>Regras</Tabs.Label>
                </Tabs.Trigger>
              ) : null}
            </Tabs.List>
          </View>
        </Page.Header>

        {isRankingTabActive ? null : (
          <Page.KeyboardAwareScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
            <Tabs.Content className="gap-3" value="details">
              <Image
                className="aspect-video w-full rounded-3xl"
                fallback="green"
              />
              <Image
                className="-mt-15 mb-4 aspect-square size-30 self-center rounded-full"
                fallback="blue"
              />
              <View className="gap-2">
                <Text className="text-center" variant="title">
                  {league.name}
                </Text>
                <Text
                  className="text-center"
                  color="muted"
                  variant="description"
                >
                  {league.description?.trim() ||
                    "Essa liga ainda não adicionou uma apresentação."}
                </Text>
              </View>
            </Tabs.Content>

            {showRulesTab ? (
              <Tabs.Content className="gap-3" value="rules">
                {ruleSections.map((section) => (
                  <Fragment key={section.title}>
                    <Description>{section.title}</Description>
                    <ListGroup>
                      {section.items.map((rule, index) => (
                        <Fragment key={`${section.title}-${rule.label}`}>
                          {index > 0 ? <Separator className="mx-4" /> : null}
                          <ListGroup.Item disabled>
                            <ListGroup.ItemContent>
                              <ListGroup.ItemTitle>
                                {rule.label}
                              </ListGroup.ItemTitle>
                              <ListGroup.ItemDescription>
                                {rule.value}
                              </ListGroup.ItemDescription>
                            </ListGroup.ItemContent>
                          </ListGroup.Item>
                        </Fragment>
                      ))}
                    </ListGroup>
                  </Fragment>
                ))}
              </Tabs.Content>
            ) : null}
            {showRequestsTab ? (
              <Tabs.Content className="gap-4" value="requests">
                <MembershipRequests
                  errorMessage={
                    membershipOverviewQuery.isError
                      ? membershipOverviewQuery.error.message
                      : undefined
                  }
                  isLoading={membershipOverviewQuery.isPending}
                  isPending={
                    approveMembership.isPending || rejectMembership.isPending
                  }
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
              </Tabs.Content>
            ) : null}
          </Page.KeyboardAwareScrollView>
        )}

        {showRankingTab ? (
          <Page.View className="flex-1">
            <Tabs.Content
              className="flex-1 px-4 pb-safe-offset-4"
              value="ranking"
            >
              <Ranking
                canManage={isManagerOwner}
                errorMessage={
                  membershipOverviewQuery.isError
                    ? membershipOverviewQuery.error.message
                    : undefined
                }
                isDisabled={!isManagerOwner || reorderRanking.isPending}
                isLoading={membershipOverviewQuery.isPending}
                items={rankingItems}
                maxChallengeDistance={league.ruleConfig.maxChallengeDistance}
                onChange={(items) => {
                  if (!(leagueId && isManagerOwner)) {
                    return;
                  }

                  reorderRanking.mutate({
                    leagueId,
                    membershipIds: items.map((item) => item.id),
                  });
                }}
                onRemove={
                  leagueId
                    ? async (membershipId) => {
                        await removeMembership.mutateAsync({
                          leagueId,
                          membershipId,
                        });
                      }
                    : undefined
                }
                viewerPosition={viewerPosition}
                viewerUserId={session?.user?.id}
              />
            </Tabs.Content>
          </Page.View>
        ) : null}

        {showJoinFooter ? (
          <Page.Footer className="centered">
            <Button
              isDisabled={isJoinDisabled}
              onPress={() => {
                if (!leagueId) {
                  return;
                }

                requestJoin.mutate({ leagueId });
              }}
            >
              <Button.Label>{membershipLabel}</Button.Label>
            </Button>
          </Page.Footer>
        ) : null}
      </Page>
    </Tabs>
  );
}
