import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Tabs, useToast } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { ChallengeCard } from "@/components/pages/leagues/challenge-card";
import { ChallengeOrganizerActionDialog } from "@/components/pages/leagues/challenge-organizer-action-dialog";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { ChallengeResultDialog } from "@/components/pages/leagues/challenge-result-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import {
  formatProposalSummary,
  formatScoreSummary,
  formatStatus,
  getAdminActionCopy,
  getScoreValueClassName,
  resolveChallengesError,
} from "@/lib/leagues/challenge-formatters";
import {
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "@/lib/leagues/challenge-route-view";
import { buildChallengeTabCounts } from "@/lib/leagues/challenge-tab-counts";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildChallengeMenuActions,
  type ChallengeItem,
  type ChallengeMenuCallbacks,
} from "@/lib/leagues/challenge-menu-actions";
import { useChallengeMutations } from "@/lib/leagues/use-challenge-mutations";

type OrganizerActionTarget = {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  challenge: ChallengeItem;
};

export default function LeagueChallengesRoute() {
  const { leagueId } = useLocalSearchParams<{
    leagueId: string;
  }>();
  const router = useRouter();
  const { toast } = useToast();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const access = useValue(bucket$.derived.access);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const canManage = useValue(bucket$.derived.canManageLeague);
  const createTarget = useValue(bucket$.ui.challengeCreateTarget);
  const league = useValue(bucket$.data.league);
  const viewerPlayerProfileId = useValue(bucket$.viewer.viewerPlayerProfileId);

  const challengesQuery = useQuery({
    ...crpc.league.challenges.listForLeague.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
  });
  const occupiedSlotsQuery = useQuery({
    ...crpc.league.challenges.listOccupiedSlots.queryOptions({ leagueId }),
    enabled: access.canOpenChallenges,
  });
  const challengesError = resolveChallengesError({
    challengesError: challengesQuery.error,
    isChallengesError: challengesQuery.isError,
    isOccupiedSlotsError: occupiedSlotsQuery.isError,
    occupiedSlotsError: occupiedSlotsQuery.error,
  });

  const {
    createChallenge,
    acceptChallengeProposal,
    declineChallengeProposal,
    counterProposeChallenge,
    cancelChallenge,
    requestChallengeCancellation,
    respondChallengeCancellation,
    submitChallengeResult,
    confirmChallengeResult,
    reviewChallenge,
    reviewChallengeResult,
    organizerManageChallenge,
    organizerSubmitChallengeResult,
    organizerRequestResultReminder,
    isPending,
  } = useChallengeMutations({ leagueId, bucket$, toast });

  const challenges = challengesQuery.data ?? [];
  const courts = league?.courts ?? [];
  const defaultDurationMinutes =
    league?.ruleConfig.matchConfig.defaultDurationMinutes ?? 0;
  const error = challengesError;
  const isLoading = challengesQuery.isPending || occupiedSlotsQuery.isPending;
  const occupiedSlots = occupiedSlotsQuery.data ?? [];

  const onAccept = (challengeId: string) => {
    acceptChallengeProposal.mutate({ challengeId });
  };
  const onAdminManage = async (input: {
    action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
    challengeId: string;
  }) => {
    await organizerManageChallenge.mutateAsync(input);
  };
  const onCancel = (challengeId: string) => {
    cancelChallenge.mutate({ challengeId });
  };
  const onCloseCreateTarget = () => {
    bucket$.actions.setChallengeCreateTarget(null);
  };
  const onConfirmResult = (challengeId: string) => {
    confirmChallengeResult.mutate({ challengeId });
  };
  const onCounterPropose = async (input: {
    challengeId: string;
    courtId: string;
    endMinute: number;
    matchDate: string;
    startMinute: number;
  }) => {
    await counterProposeChallenge.mutateAsync(input);
  };
  const onCreate = async (input: {
    challengedMembershipId: string;
    courtId: string;
    endMinute: number;
    matchDate: string;
    startMinute: number;
  }) => {
    await createChallenge.mutateAsync({
      leagueId,
      ...input,
    });
  };
  const onDecline = (challengeId: string) => {
    declineChallengeProposal.mutate({ challengeId });
  };
  const onRequestCancellation = (challengeId: string) => {
    requestChallengeCancellation.mutate({ challengeId });
  };
  const onReviewChallenge = (input: {
    action: "approve" | "reject";
    challengeId: string;
  }) => {
    reviewChallenge.mutate(input);
  };
  const onReviewResult = (input: {
    action: "approve" | "invalidate" | "request_correction";
    challengeId: string;
    resultSubmissionId: string;
  }) => {
    reviewChallengeResult.mutate(input);
  };
  const onRequestResultReminder = (challengeId: string) => {
    organizerRequestResultReminder.mutate({ challengeId });
  };
  const onRespondCancellation = (input: {
    action: "accept" | "reject";
    challengeId: string;
  }) => {
    respondChallengeCancellation.mutate(input);
  };
  const onSubmitResult = async (input: {
    challengeId: string;
    score: {
      sets: Array<{
        challengedGames: number;
        challengerGames: number;
        kind: "set" | "super_tiebreak";
      }>;
      winnerMembershipId: string;
    };
  }) => {
    await submitChallengeResult.mutateAsync(input);
  };
  const onAdminSubmitResult = async (input: {
    challengeId: string;
    score: {
      sets: Array<{
        challengedGames: number;
        challengerGames: number;
        kind: "set" | "super_tiebreak";
      }>;
      winnerMembershipId: string;
    };
  }) => {
    await organizerSubmitChallengeResult.mutateAsync(input);
  };

  useEffect(() => {
    bucket$.actions.setActiveRoute("challenges");
  }, [bucket$]);

  useEffect(() => {
    if (challengesQuery.data) {
      bucket$.actions.hydrateChallenges(challengesQuery.data);
    }
  }, [bucket$, challengesQuery.data]);

  useEffect(() => {
    if (occupiedSlotsQuery.data) {
      bucket$.actions.hydrateOccupiedSlots(occupiedSlotsQuery.data);
    }
  }, [bucket$, occupiedSlotsQuery.data]);

  const tabCounts = useMemo(
    () =>
      buildChallengeTabCounts({
        canManage,
        challenges,
        viewerPlayerProfileId,
      }),
    [canManage, challenges, viewerPlayerProfileId]
  );
  const [activeTab, setActiveTab] = useState(() =>
    buildChallengeRouteInitialTab({
      canManage: Boolean(canManage),
      pendingCount: tabCounts.attention,
    })
  );
  const [counterProposalTarget, setCounterProposalTarget] =
    useState<ChallengeItem | null>(null);
  const [resultTarget, setResultTarget] = useState<ChallengeItem | null>(null);
  const [adminActionTarget, setOrganizerActionTarget] =
    useState<OrganizerActionTarget | null>(null);

  // Se a aba "Atenção" (antiga "Pendentes") ficar vazia após uma ação (ex.:
  // admin resolveu todos os pendentes), caímos para "Em andamento" para não
  // exibir uma aba vazia.
  useEffect(() => {
    if (
      !(canManage && tabCounts.attention === 0 && activeTab === "attention")
    ) {
      return;
    }

    setActiveTab("ongoing");
  }, [activeTab, canManage, tabCounts.attention]);

  const visibleChallenges = useMemo(
    () =>
      buildChallengeRouteVisibleChallenges({
        activeTab,
        canManage: Boolean(canManage),
        challenges,
        viewerPlayerProfileId: viewerPlayerProfileId ?? null,
      }),
    [activeTab, canManage, challenges, viewerPlayerProfileId]
  );
  const hasAnyChallenges = challenges.length > 0;
  const emptyState = buildChallengeRouteEmptyState({
    canManage: Boolean(canManage),
    hasAnyChallenges,
  });

  // Callbacks object consumed by buildChallengeMenuActions. The handlers above
  // are recreated each render, so this object is too; the ChallengeCard is
  // memoized, but its props (menuActions array) still change per render. The
  // main win of this refactor is pulling the menu logic out of the render
  // block and into a pure builder; per-item memoization would require wrapping
  // every handler in useCallback, which is out of scope here.
  const menuCallbacks: ChallengeMenuCallbacks = {
    onAccept,
    onAdminManage: (target) => {
      setOrganizerActionTarget(target);
    },
    onCancel,
    onConfirmResult,
    onDecline,
    onRequestCancellation,
    onRequestResultReminder,
    onRespondCancellation,
    onReviewChallenge,
    onReviewResult,
    setCounterProposalTarget,
    setResultTarget,
  };

  const buildItemMenuActions = (challenge: ChallengeItem) =>
    buildChallengeMenuActions({
      callbacks: menuCallbacks,
      canManage: Boolean(canManage),
      challenge,
      viewerPlayerProfileId: viewerPlayerProfileId ?? null,
    });

  useEffect(() => {
    if (bootstrapStatus !== "ready") {
      return;
    }

    if (!access.canOpenChallenges) {
      router.replace({
        params: { leagueId },
        pathname: "/leagues/[leagueId]",
      });
    }
  }, [access.canOpenChallenges, bootstrapStatus, leagueId, router]);

  function renderChallengeItem(challenge: ChallengeItem) {
    const scoreSummary = formatScoreSummary(challenge);
    const statusChip = formatStatus(challenge.status);
    const winnerMembershipId =
      challenge.latestResultSubmission?.winnerMembershipId ?? null;

    return (
      <ChallengeCard
        challengedAvatarUrl={challenge.challenged.player.avatarUrl}
        challengedFullName={challenge.challenged.player.fullName}
        challengedScoreClass={getScoreValueClassName({
          hasScoreSummary: Boolean(scoreSummary),
          isWinner: winnerMembershipId === challenge.challenged.membershipId,
        })}
        challengerAvatarUrl={challenge.challenger.player.avatarUrl}
        challengerFullName={challenge.challenger.player.fullName}
        challengerScoreClass={getScoreValueClassName({
          hasScoreSummary: Boolean(scoreSummary),
          isWinner: winnerMembershipId === challenge.challenger.membershipId,
        })}
        isMenuDisabled={isPending}
        key={challenge.id}
        menuActions={buildItemMenuActions(challenge)}
        proposalSummary={formatProposalSummary(challenge)}
        scoreSummary={scoreSummary}
        statusChip={statusChip}
        winnerChallenged={
          winnerMembershipId === challenge.challenged.membershipId
        }
        winnerChallenger={
          winnerMembershipId === challenge.challenger.membershipId
        }
      />
    );
  }

  const isBootstrapError = bootstrapStatus === "error";
  const isLeagueLoading = !league;
  const isChallengesLoading = isLoading;
  const isChallengesError = Boolean(error);
  const showStatusState =
    isBootstrapError ||
    isLeagueLoading ||
    isChallengesLoading ||
    isChallengesError;

  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row">
            <Page.Header.Left />
            <Page.Header.Center>
              <Page.Header.Title>Desafios</Page.Header.Title>
            </Page.Header.Center>
            <Page.Header.Right />
          </View>
          <Tabs
            onValueChange={(value) => {
              setActiveTab(value as typeof activeTab);
            }}
            value={activeTab}
          >
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                {canManage ? (
                  <>
                    <Tabs.Trigger value="attention">
                      <Tabs.Label>Atenção</Tabs.Label>
                      {tabCounts.attention > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="danger"
                          size="sm"
                        >
                          {tabCounts.attention}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="ongoing">
                      <Tabs.Label>Em andamento</Tabs.Label>
                      {tabCounts.ongoing > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="accent"
                          size="sm"
                        >
                          {tabCounts.ongoing}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="history">
                      <Tabs.Label>Histórico</Tabs.Label>
                    </Tabs.Trigger>
                  </>
                ) : (
                  <>
                    <Tabs.Trigger value="attention">
                      <Tabs.Label>Atenção</Tabs.Label>
                      {tabCounts.attention > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="danger"
                          size="sm"
                        >
                          {tabCounts.attention}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="ongoing">
                      <Tabs.Label>Aguardando</Tabs.Label>
                      {tabCounts.ongoing > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="accent"
                          size="sm"
                        >
                          {tabCounts.ongoing}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="history">
                      <Tabs.Label>Histórico</Tabs.Label>
                    </Tabs.Trigger>
                  </>
                )}
              </Tabs.ScrollView>
            </Tabs.List>
          </Tabs>
        </View>
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName="grow gap-2 px-4 pb-floating-tab-bar-offset-4"
        showsVerticalScrollIndicator={false}
      >
        {isBootstrapError && (
          <ErrorState message="Não foi possível carregar a liga." />
        )}
        {(isLeagueLoading || isChallengesLoading) && <LoadingState />}
        {isChallengesError && (
          <ErrorState
            error={error}
            message="Não foi possível carregar os desafios."
          />
        )}
        {!showStatusState && (
          <>
            {visibleChallenges.length === 0 ? (
              <EmptyState
                description={emptyState.description}
                title={emptyState.title}
              />
            ) : (
              <View className="gap-2">
                {visibleChallenges.map(renderChallengeItem)}
              </View>
            )}

            {createTarget ? (
              <ChallengeProposalDialog
                actionLabel="Enviar desafio"
                courts={courts}
                defaultDurationMinutes={defaultDurationMinutes}
                isOpen
                isPending={isPending}
                occupiedSlots={occupiedSlots}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    onCloseCreateTarget();
                  }
                }}
                onSubmit={async (value) => {
                  await onCreate({
                    challengedMembershipId: createTarget.membershipId,
                    ...value,
                  });
                  onCloseCreateTarget();
                }}
                opponentName={createTarget.name}
                title="Novo desafio"
              />
            ) : null}

            {counterProposalTarget ? (
              <ChallengeProposalDialog
                actionLabel="Reenviar proposta"
                challengeIdToIgnore={counterProposalTarget.id}
                courts={courts}
                defaultDurationMinutes={
                  counterProposalTarget.matchConfigSnapshot
                    .defaultDurationMinutes
                }
                initialValue={{
                  courtId: counterProposalTarget.currentProposal.courtId,
                  endMinute: counterProposalTarget.currentProposal.endMinute,
                  matchDate: counterProposalTarget.currentProposal.matchDate,
                  startMinute:
                    counterProposalTarget.currentProposal.startMinute,
                }}
                isOpen
                isPending={isPending}
                occupiedSlots={occupiedSlots}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setCounterProposalTarget(null);
                  }
                }}
                onSubmit={async (value) => {
                  await onCounterPropose({
                    challengeId: counterProposalTarget.id,
                    ...value,
                  });
                  setCounterProposalTarget(null);
                }}
                opponentName={
                  (counterProposalTarget.challenger.playerProfileId ===
                  viewerPlayerProfileId
                    ? counterProposalTarget.challenged
                    : counterProposalTarget.challenger
                  ).player.fullName
                }
                title="Contraproposta"
              />
            ) : null}

            {resultTarget ? (
              <ChallengeResultDialog
                challengedMembershipId={resultTarget.challenged.membershipId}
                challengedName={resultTarget.challenged.player.fullName}
                challengerMembershipId={resultTarget.challenger.membershipId}
                challengerName={resultTarget.challenger.player.fullName}
                initialScore={resultTarget.latestResultSubmission?.score.sets}
                isOpen
                isPending={isPending}
                matchConfig={resultTarget.matchConfigSnapshot}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setResultTarget(null);
                  }
                }}
                onSubmit={async (value) => {
                  if (canManage) {
                    await onAdminSubmitResult({
                      challengeId: resultTarget.id,
                      score: value,
                    });
                  } else {
                    await onSubmitResult({
                      challengeId: resultTarget.id,
                      score: value,
                    });
                  }
                  setResultTarget(null);
                }}
                title={(() => {
                  if (canManage) {
                    return resultTarget.latestResultSubmission
                      ? "Editar placar"
                      : "Lançar placar";
                  }

                  return resultTarget.status === "pending_result_confirmation"
                    ? "Reeditar placar"
                    : "Enviar placar";
                })()}
              />
            ) : null}

            {adminActionTarget ? (
              <ChallengeOrganizerActionDialog
                description={`${getAdminActionCopy(adminActionTarget.action).description} ${adminActionTarget.challenge.challenger.player.fullName} x ${adminActionTarget.challenge.challenged.player.fullName}.`}
                isDanger={getAdminActionCopy(adminActionTarget.action).isDanger}
                isOpen
                isPending={isPending}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setOrganizerActionTarget(null);
                  }
                }}
                onSubmit={async () => {
                  await onAdminManage({
                    action: adminActionTarget.action,
                    challengeId: adminActionTarget.challenge.id,
                  });
                  setOrganizerActionTarget(null);
                }}
                submitLabel={
                  getAdminActionCopy(adminActionTarget.action).submitLabel
                }
                title={getAdminActionCopy(adminActionTarget.action).title}
              />
            ) : null}
          </>
        )}
      </Page.ScrollView>
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
