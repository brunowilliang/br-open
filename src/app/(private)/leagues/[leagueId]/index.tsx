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
import { Fragment, useState } from "react";
import { ScrollView, View } from "react-native";

import { Image } from "@/components/core/image";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { useCRPC } from "@/lib/convex/crpc";
import { getMembershipActionLabel } from "@/lib/leagues/presentation";

type RuleConfig = ApiOutputs["league"]["management"]["getById"]["ruleConfig"];

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
  ];
}

export default function LeagueDetailsScreen() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
  const requestJoin = useMutation(
    crpc.league.membership.requestJoin.mutationOptions({
      onSuccess: async (membership) => {
        if (!leagueId) {
          return;
        }

        await queryClient.invalidateQueries(
          crpc.league.discovery.getById.queryFilter({ leagueId })
        );

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
  const membershipLabel = getMembershipActionLabel(
    league.viewerMembershipStatus,
    {
      isManagerOwner: league.isManagerOwner,
    }
  );
  const isJoinDisabled =
    requestJoin.isPending ||
    league.viewerMembershipStatus === "active" ||
    league.viewerMembershipStatus === "pending";

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
              <Tabs.Trigger value="table">
                <Tabs.Label>Classificação</Tabs.Label>
              </Tabs.Trigger>
              <Tabs.Trigger value="rules">
                <Tabs.Label>Regras</Tabs.Label>
              </Tabs.Trigger>
            </Tabs.List>
          </View>
        </Page.Header>

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
              <Text className="text-center" color="muted" variant="description">
                {league.description?.trim() ||
                  "Essa liga ainda não adicionou uma apresentação."}
              </Text>
            </View>
          </Tabs.Content>

          <Tabs.Content className="gap-4" value="table">
            <Text>table</Text>
          </Tabs.Content>

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
        </Page.KeyboardAwareScrollView>

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
      </Page>
    </Tabs>
  );
}
