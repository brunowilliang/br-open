import type { ApiOutputs } from "@convex/shared/api";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  BottomSheet,
  Button,
  Chip,
  CloseButton,
  Description,
  ListGroup,
  Menu,
  ScrollShadow,
  Separator,
  useThemeColor,
} from "heroui-native";
import { Fragment, useState } from "react";
import { ScrollView, View } from "react-native";

import { Image } from "@/components/core/image";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Text } from "@/components/ui/text";
import { useCRPC } from "@/lib/convex/crpc";
import { getMembershipActionLabel } from "@/lib/leagues/presentation";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  Add01Icon,
  ArrowLeft01Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { LinearGradient } from "expo-linear-gradient";

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
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const surface = useThemeColor("surface");

  const leagueQuery = useQuery({
    ...crpc.league.discovery.getById.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(leagueId),
  });

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

  return (
    <>
      <View className="absolute top-0 z-100 w-full flex-row justify-between p-safe-offset-4">
        <CloseButton onPress={router.back}>
          <HugeIcons icon={ArrowLeft01Icon} />
        </CloseButton>
        <Menu>
          <Menu.Trigger asChild>
            <CloseButton>
              <HugeIcons icon={MoreVerticalIcon} />
            </CloseButton>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover">
              <Menu.Item onPress={() => setIsRulesOpen(true)}>
                <Menu.ItemTitle className="flex-none">Regras</Menu.ItemTitle>
                <HugeIcons icon={Add01Icon} />
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
      </View>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="grow"
      >
        <Image className="h-1/3 w-full rounded-b-4xl" fallback="green" />
        <Image
          className="-mt-15 size-30 self-center rounded-full border-4 border-background"
          fallback="blue"
        />

        <View className="gap-3 pt-4">
          {league.categories.length ? (
            <View className="flex-row flex-wrap justify-center gap-2">
              {league.categories.map((category, index) => (
                <Chip
                  key={`${category}-${index}`}
                  size="sm"
                  variant="secondary"
                >
                  {category}
                </Chip>
              ))}
            </View>
          ) : null}

          <Text className="text-center" variant="title">
            {league.name}
          </Text>
          <Text className="text-center" color="muted" variant="description">
            {league.description}
          </Text>
        </View>
      </ScrollView>
      <BottomSheet isOpen={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            contentContainerClassName="h-full p-0.5"
            enableDynamicSizing={false}
            enableOverDrag={false}
            snapPoints={["90%"]}
          >
            <View className="absolute z-100 w-full flex-row items-center gap-3 px-4">
              <BottomSheet.Close />
              <Text variant="title">Regras</Text>
            </View>
            <ScrollShadow
              color={surface}
              LinearGradientComponent={LinearGradient}
              size={100}
            >
              <BottomSheetScrollView contentContainerClassName="px-3.5 pt-14">
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
              </BottomSheetScrollView>
            </ScrollShadow>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
      <View className="absolute bottom-0 z-100 w-full p-4 pb-safe-offset-4">
        <Button>
          <Button.Label>{getMembershipActionLabel()}</Button.Label>
        </Button>
      </View>
    </>
  );
}
