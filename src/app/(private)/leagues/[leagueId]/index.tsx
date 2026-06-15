import type { ApiOutputs } from "@convex/shared/api";
import {
  BookOpenCheckIcon,
  Cancel01Icon,
  ChampionIcon,
  CourtHouseIcon,
  Edit02Icon,
  Location06Icon,
  MoreVerticalIcon,
  RankingIcon,
  Target02Icon,
  UserGroupIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  Dialog,
  Menu,
  Separator,
  useToast,
} from "heroui-native";
import { Badge } from "heroui-native-pro";
import { Fragment, useRef, useState } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { BackButton, Page } from "@/components/ui/page";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  formatLeagueAvailabilityBadge,
  formatLeagueMeta,
  formatLeaguePriceParts,
  hasLeagueAvailableSpots,
} from "@/lib/leagues/presentation";

type LeagueOverviewLeague = ApiOutputs["league"]["discovery"]["getById"];
type RuleConfig = LeagueOverviewLeague["ruleConfig"];
type ViewerMembershipStatus = LeagueOverviewLeague["viewerMembershipStatus"];

type PreviewFeature = {
  description: string;
  icon: typeof Target02Icon;
  title: string;
};

type JoinFooterProps = {
  availabilityLabel: null | string;
  canCancelRequest: boolean;
  isCancelDisabled: boolean;
  isJoinDisabled: boolean;
  joinActionLabel: string;
  onCancelPress: () => void;
  onJoinPress: () => void;
  priceParts: ReturnType<typeof formatLeaguePriceParts>;
};

type CancelRequestDialogProps = {
  isDisabled: boolean;
  isOpen: boolean;
  onConfirm: () => void;
  onOpenChange: (value: boolean) => void;
};

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

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
      return "sobe 1 posição";
    default:
      return "assume a posição do adversário";
  }
}

function formatLossBehavior(value: RuleConfig["lossBehavior"]) {
  switch (value) {
    case "drop_one_position":
      return "cai 1 posição";
    default:
      return "permanece onde está";
  }
}

function formatRankingEntry(value: RuleConfig["newPlayerPlacement"]) {
  switch (value) {
    case "end_of_ranking":
    default:
      return "Ao entrar, você já aparece na tabela da liga.";
  }
}

function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_ad":
      return "sem vantagem";
    default:
      return "com vantagem";
  }
}

function formatSetSummary(ruleConfig: RuleConfig) {
  const { matchConfig } = ruleConfig;

  if (matchConfig.bestOfSets === 1) {
    return "Set único";
  }

  return `Melhor de ${matchConfig.bestOfSets} sets`;
}

function formatGameSummary(ruleConfig: RuleConfig) {
  const { matchConfig } = ruleConfig;
  const scoring = formatScoringMode(matchConfig.scoringMode);

  return `${matchConfig.gamesPerSet} games ${scoring}`;
}

function buildPreviewFeatures(ruleConfig: RuleConfig): PreviewFeature[] {
  return [
    {
      description: `${formatRankingEntry(ruleConfig.newPlayerPlacement)} A partir daí, já pode disputar desafios e buscar posições acima.`,
      icon: RankingIcon,
      title: "Comece no ranking",
    },
    {
      description: `Você pode desafiar até ${formatCount(ruleConfig.maxChallengeDistance, "posição", "posições")} acima e o adversário tem ${formatResponseDeadlineHours(ruleConfig.responseDeadlineHours)} para responder.`,
      icon: Target02Icon,
      title: "Faça/Receba Desafios",
    },
    {
      description: `Quem vence ${formatWinBehavior(ruleConfig.winBehavior)}. Quem perde ${formatLossBehavior(ruleConfig.lossBehavior)}.`,
      icon: ChampionIcon,
      title: "Suba jogando",
    },
  ];
}

function formatListSummary(items: string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}

function formatActionBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function MenuActionBadge(props: { className?: string; count: number }) {
  if (props.count <= 0) {
    return null;
  }

  return (
    <Badge className={props.className} color="danger" size="sm">
      {formatActionBadgeCount(props.count)}
    </Badge>
  );
}

function PreviewIcon(props: { icon: PreviewFeature["icon"] }) {
  return (
    <View className="centered size-10 rounded-2xl bg-accent-soft">
      <HugeIcons className="size-5 text-accent" icon={props.icon} />
    </View>
  );
}

function JoinFooter(props: JoinFooterProps) {
  return (
    <Page.Footer className="flex-col px-8">
      {props.availabilityLabel ? (
        <Chip className="self-center" color="success" variant="soft">
          {props.availabilityLabel}
        </Chip>
      ) : null}
      <Card
        className="centered flex-1 flex-row justify-between"
        variant="tertiary"
      >
        <View className="flex-1">
          <Text>Preço</Text>
          <View className="flex-row items-baseline">
            <Text size="xl" weight="medium">
              {props.priceParts.amount}
            </Text>
            {props.priceParts.suffix ? (
              <Text
                className="flex-1"
                color="muted"
                numberOfLines={1}
                size="sm"
                weight="medium"
              >
                {props.priceParts.suffix}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Button isDisabled={props.isJoinDisabled} onPress={props.onJoinPress}>
            <Button.Label>{props.joinActionLabel}</Button.Label>
          </Button>
          {props.canCancelRequest ? (
            <Button
              isDisabled={props.isCancelDisabled}
              isIconOnly
              onPress={props.onCancelPress}
              variant="danger-soft"
            >
              <HugeIcons className="text-danger" icon={Cancel01Icon} />
            </Button>
          ) : null}
        </View>
      </Card>
    </Page.Footer>
  );
}

function getJoinFooterActionLabel(input: {
  hasAvailableSpots: boolean;
  isJoinRequestPending: boolean;
  joinActionLabel: string;
}) {
  if (input.hasAvailableSpots || input.isJoinRequestPending) {
    return input.joinActionLabel;
  }

  return "Sem vagas";
}

function CancelRequestDialog(props: CancelRequestDialogProps) {
  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (props.isDisabled) {
          return;
        }
        props.onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          {props.isDisabled ? null : (
            <Dialog.Close className="absolute top-4 right-4 z-100" />
          )}
          <Dialog.Title>Cancelar solicitação</Dialog.Title>
          <Description>
            Você poderá solicitar entrada nessa liga novamente depois.
          </Description>

          <View className="flex-row gap-2 self-end">
            <Button
              isDisabled={props.isDisabled}
              onPress={() => {
                props.onOpenChange(false);
              }}
              size="sm"
              variant="secondary"
            >
              <Button.Label>Voltar</Button.Label>
            </Button>
            <Button
              isDisabled={props.isDisabled}
              onPress={props.onConfirm}
              size="sm"
              variant="danger-soft"
            >
              <Button.Label>Cancelar solicitação</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export default function LeagueOverviewRoute() {
  const { leagueId: rawLeagueId } = useLocalSearchParams<{
    leagueId?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;

  if (!leagueId) {
    return (
      <Page>
        <Page.ScrollView
          className="flex-1"
          contentContainerClassName="grow px-4 py-6"
        >
          <ErrorState message="Liga inválida." />
        </Page.ScrollView>
      </Page>
    );
  }

  return <LeagueOverviewRouteContent leagueId={leagueId} />;
}

function LeagueOverviewRouteContent(props: { leagueId: string }) {
  const { leagueId } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManageLeague = useValue(bucket$.derived.canManageLeague);
  const canOpenLeagueMenu = useValue(bucket$.derived.canOpenLeagueMenu);
  const canRequestJoin = useValue(bucket$.derived.canRequestJoin);
  const league = useValue(bucket$.data.league);
  const membershipStatus = useValue(bucket$.viewer.membershipStatus);
  const menuActionCounts = useValue(bucket$.derived.menuActionCounts);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const joinActionLabel = useValue(bucket$.derived.joinActionLabel);
  const showJoinFooter = useValue(bucket$.derived.showJoinFooter);
  const joinMutationIntentRef = useRef<"cancel" | "request">("request");
  const previousMembershipStatusRef = useRef<{
    status: ViewerMembershipStatus;
  } | null>(null);
  const [isCancelRequestDialogOpen, setIsCancelRequestDialogOpen] =
    useState(false);
  const isJoinRequestPending = membershipStatus === "pending";
  async function invalidateLeagueContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listForLeague.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
      ),
    ]);
  }

  const requestJoin = useMutation(
    crpc.league.membership.requestJoin.mutationOptions({
      onSuccess: async (membership) => {
        const intent = joinMutationIntentRef.current;
        joinMutationIntentRef.current = "request";
        previousMembershipStatusRef.current = null;

        bucket$.actions.setViewerMembershipStatus(membership.status);

        if (intent === "cancel") {
          setIsCancelRequestDialogOpen(false);

          toast.show({
            description: "Sua solicitação foi cancelada.",
            id: "cancel-join-request-success",
            label: "Solicitação cancelada",
            variant: "success",
          });

          await invalidateLeagueContext();
          return;
        }

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

        await invalidateLeagueContext();
      },
      onError: (error) => {
        const intent = joinMutationIntentRef.current;
        joinMutationIntentRef.current = "request";
        const previousMembershipStatus = previousMembershipStatusRef.current;
        previousMembershipStatusRef.current = null;
        const isCancelAction = intent === "cancel";

        if (previousMembershipStatus) {
          bucket$.actions.setViewerMembershipStatus(
            previousMembershipStatus.status
          );
        }

        toast.show({
          description: getToastErrorMessage(
            error,
            isCancelAction
              ? "Não foi possível cancelar a solicitação."
              : "Não foi possível solicitar entrada."
          ),
          id: isCancelAction
            ? "cancel-join-request-error"
            : "request-join-error",
          label: isCancelAction
            ? "Erro ao cancelar"
            : "Erro ao solicitar entrada",
          variant: "danger",
        });
      },
    })
  );

  function mutateJoinRequest(intent: "cancel" | "request") {
    joinMutationIntentRef.current = intent;
    previousMembershipStatusRef.current = { status: membershipStatus };
    bucket$.actions.setViewerMembershipStatus(
      intent === "cancel" ? "left" : "pending"
    );
    requestJoin.mutate({ leagueId });
  }

  if (bootstrapStatus === "error") {
    return (
      <Page>
        <Page.ScrollView
          className="flex-1"
          contentContainerClassName="grow px-4 py-6"
        >
          <ErrorState message="Não foi possível carregar a liga." />
        </Page.ScrollView>
      </Page>
    );
  }

  if (!league) {
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

  const features = buildPreviewFeatures(league.ruleConfig);
  const categorySummary = formatListSummary(league.categories, "Livre");
  const categoryCountLabel = league.categories.length
    ? formatCount(league.categories.length, "categoria", "categorias")
    : "Livre";
  const courtSummary = formatListSummary(
    league.courts.map((court) => court.name),
    "A definir"
  );
  const courtCountLabel = league.courts.length
    ? formatCount(league.courts.length, "quadra", "quadras")
    : "A definir";
  const gameSummary = formatGameSummary(league.ruleConfig);
  const hasAvailableSpots = hasLeagueAvailableSpots({
    activePlayerCount: league.activePlayerCount,
    maxPlayers: league.maxPlayers,
  });
  const availabilityLabel = formatLeagueAvailabilityBadge({
    activePlayerCount: league.activePlayerCount,
    maxPlayers: league.maxPlayers,
  });
  const joinFooterActionLabel = getJoinFooterActionLabel({
    hasAvailableSpots,
    isJoinRequestPending,
    joinActionLabel,
  });
  const rankingCount = rankingItems.length;
  const setSummary = formatSetSummary(league.ruleConfig);

  return (
    <Page>
      <Page.ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-safe-offset-4"
      >
        <View className="gap-4">
          <View>
            <BackButton
              className="absolute top-2 left-2 z-10"
              variant="secondary"
            />
            <View className="absolute top-2 right-2 z-10 flex-row gap-2">
              {canOpenLeagueMenu ? (
                <Menu>
                  <Menu.Trigger asChild>
                    <Button isIconOnly size="sm" variant="secondary">
                      <HugeIcons icon={MoreVerticalIcon} />
                    </Button>
                  </Menu.Trigger>
                  <MenuActionBadge count={menuActionCounts.total} />
                  <Menu.Portal>
                    <Menu.Overlay />
                    <Menu.Content presentation="popover">
                      {access.canOpenRanking ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { leagueId },
                              pathname: "/leagues/[leagueId]/ranking",
                            });
                          }}
                        >
                          <Menu.ItemTitle className="flex-none">
                            Ranking
                          </Menu.ItemTitle>
                          <HugeIcons icon={RankingIcon} />
                        </Menu.Item>
                      ) : null}
                      {access.canOpenChallenges ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { leagueId },
                              pathname: "/leagues/[leagueId]/challenges",
                            });
                          }}
                        >
                          <Menu.ItemTitle className="flex-none">
                            Desafios
                          </Menu.ItemTitle>
                          <MenuActionBadge
                            count={menuActionCounts.challenges}
                          />
                          <HugeIcons icon={Target02Icon} />
                        </Menu.Item>
                      ) : null}
                      {access.canOpenRules ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { leagueId },
                              pathname: "/leagues/[leagueId]/rules",
                            });
                          }}
                        >
                          <Menu.ItemTitle className="flex-none">
                            Regras
                          </Menu.ItemTitle>
                          <HugeIcons icon={BookOpenCheckIcon} />
                        </Menu.Item>
                      ) : null}
                      {access.canOpenRequests ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { leagueId },
                              pathname: "/leagues/[leagueId]/requests",
                            });
                          }}
                        >
                          <Menu.ItemTitle className="flex-none">
                            Solicitações
                          </Menu.ItemTitle>
                          <MenuActionBadge count={menuActionCounts.requests} />
                          <HugeIcons icon={UserMultipleIcon} />
                        </Menu.Item>
                      ) : null}
                      {canManageLeague ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { leagueId },
                              pathname: "/settings/leagues/[leagueId]/edit",
                            });
                          }}
                        >
                          <Menu.ItemTitle className="flex-none">
                            Editar
                          </Menu.ItemTitle>
                          <HugeIcons icon={Edit02Icon} />
                        </Menu.Item>
                      ) : null}
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              ) : null}
            </View>
            <Image
              className="aspect-video rounded-t-3xl"
              fallback="blue"
              source={league.coverUrl ?? undefined}
            />
            <View className="absolute inset-0 bg-linear-to-b from-background/30 to-background" />
            <View className="absolute bottom-0 flex-row items-center gap-2 px-4">
              <Image
                className="size-20 rounded-3xl border-2 border-white/80 bg-surface"
                fallback="green"
                source={league.avatarUrl ?? undefined}
              />
              <View className="flex-1 gap-1">
                <Chip color="accent" size="sm" variant="soft">
                  Liga
                </Chip>
                <Text numberOfLines={2} variant="title">
                  {league.name}
                </Text>
                <Chip color="accent" size="sm" variant="soft">
                  <HugeIcons
                    className="size-3 text-accent"
                    icon={Location06Icon}
                  />
                  <Chip.Label>
                    {formatLeagueMeta(league.city, league.state)}
                  </Chip.Label>
                </Chip>
              </View>
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row gap-2">
              <Card className="flex-1 gap-0 p-2">
                <Card.Header className="flex-row items-center gap-2 p-2">
                  <PreviewIcon icon={BookOpenCheckIcon} />
                  <View className="flex-1">
                    <Text weight="medium">Ranking</Text>
                    <Text color="muted" variant="description">
                      {rankingCount > 0
                        ? formatCount(rankingCount, "Jogador", "Jogadores")
                        : "Sem jogadores ainda"}
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body className="flex-1 flex-row items-center px-2 py-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Image
                      className={cn(
                        "-ml-3 size-8 rounded-full border border-foreground",
                        index === 0 ? "ml-0" : null
                      )}
                      fallback="green"
                      key={index}
                    />
                  ))}
                </Card.Body>
              </Card>
            </View>

            <View className="flex-row gap-2">
              <Card className="flex-1 gap-1 p-2">
                <Card.Header className="flex-row items-center gap-2 p-2">
                  <PreviewIcon icon={BookOpenCheckIcon} />
                  <View className="flex-1">
                    <Text weight="medium">Formato</Text>
                    <Text color="muted" variant="description">
                      Como funciona as partidas
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body className="flex-1 gap-3 rounded-2xl bg-surface-secondary px-3 py-2">
                  <Text color="muted" variant="description">
                    {setSummary}, {gameSummary}
                  </Text>
                </Card.Body>
              </Card>
            </View>

            <View className="flex-row gap-2">
              <Card className="flex-1 gap-1 p-2">
                <Card.Header className="flex-row items-center gap-2 p-2">
                  <PreviewIcon icon={UserGroupIcon} />
                  <View className="flex-1">
                    <Text weight="medium">Categorias</Text>
                    <Text color="muted" numberOfLines={1} variant="description">
                      {categoryCountLabel}
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body className="flex-1 gap-3 rounded-2xl bg-surface-secondary px-3 py-2">
                  <Text color="muted" variant="description">
                    {categorySummary}
                  </Text>
                </Card.Body>
              </Card>

              <Card className="flex-1 gap-1 p-2">
                <Card.Header className="flex-row items-center gap-2 p-2">
                  <PreviewIcon icon={CourtHouseIcon} />
                  <View className="flex-1">
                    <Text weight="medium">Quadras</Text>
                    <Text color="muted" numberOfLines={1} variant="description">
                      {courtCountLabel}
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body className="flex-1 gap-3 rounded-2xl bg-surface-secondary px-3 py-2">
                  <Text color="muted" variant="description">
                    {courtSummary}
                  </Text>
                </Card.Body>
              </Card>
            </View>
          </View>

          <Card className="flex-1 gap-2 p-2">
            {features.map((feature, index) => (
              <Fragment key={feature.title}>
                {index > 0 ? <Separator className="mx-3" /> : null}
                <View>
                  <Card.Header className="flex-row gap-2 p-2">
                    <PreviewIcon icon={feature.icon} />
                    <View className="flex-1">
                      <Text weight="medium">{feature.title}</Text>
                      <Text color="muted" variant="description">
                        {feature.description}
                      </Text>
                    </View>
                  </Card.Header>
                </View>
              </Fragment>
            ))}
          </Card>
        </View>
      </Page.ScrollView>

      {showJoinFooter ? (
        <JoinFooter
          availabilityLabel={availabilityLabel}
          canCancelRequest={isJoinRequestPending}
          isCancelDisabled={requestJoin.isPending}
          isJoinDisabled={
            requestJoin.isPending || !canRequestJoin || !hasAvailableSpots
          }
          joinActionLabel={joinFooterActionLabel}
          onCancelPress={() => {
            setIsCancelRequestDialogOpen(true);
          }}
          onJoinPress={() => {
            mutateJoinRequest("request");
          }}
          priceParts={formatLeaguePriceParts({
            amountCents: league.monthlyPriceCents,
            billingInterval: league.priceBillingInterval,
          })}
        />
      ) : null}

      <CancelRequestDialog
        isDisabled={requestJoin.isPending}
        isOpen={isCancelRequestDialogOpen}
        onConfirm={() => {
          mutateJoinRequest("cancel");
        }}
        onOpenChange={setIsCancelRequestDialogOpen}
      />
    </Page>
  );
}
