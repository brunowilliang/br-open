import type { ApiOutputs } from "@convex/shared/api";
import {
  Cancel01Icon,
  Edit02Icon,
  MoreVerticalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Chip, Menu, Tabs, useToast } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ChallengeAdminActionDialog } from "@/components/pages/leagues/challenge-admin-action-dialog";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { ChallengeResultDialog } from "@/components/pages/leagues/challenge-result-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { buildChallengeCardScoreSummary } from "@/lib/leagues/challenge-card-score-summary";
import {
  getAdminManageChallengeErrorToast,
  getAdminManageChallengeSuccessToast,
  getCreateChallengeErrorToast,
} from "@/lib/leagues/challenge-feedback";
import {
  buildChallengeAdminMenuActionIds,
  buildChallengeRouteEmptyState,
  buildChallengeRouteInitialTab,
  buildChallengeRouteVisibleChallenges,
} from "@/lib/leagues/challenge-route-view";
import { buildChallengeTabCounts } from "@/lib/leagues/challenge-tab-counts";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

type AdminActionTarget = {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  challenge: ChallengeItem;
};

const CLOSED_STATUSES = new Set([
  "finished",
  "declined",
  "cancelled",
  "invalidated",
]);

const CHALLENGE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

type ChallengeStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
  variant: "primary" | "secondary" | "soft" | "tertiary";
};

function formatMatchDate(matchDate: string) {
  const [year, month, day] = matchDate.split("-").map(Number);

  if (!(year && month && day)) {
    return matchDate;
  }

  return CHALLENGE_DATE_FORMATTER.format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

function formatMinute(minute: number) {
  const hour = Math.floor(minute / 60);
  const currentMinute = minute % 60;

  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}

function formatProposalSummary(challenge: ChallengeItem) {
  return `${formatMatchDate(challenge.currentProposal.matchDate)} às ${formatMinute(
    challenge.currentProposal.startMinute
  )} · ${challenge.currentProposal.courtName}`;
}

function formatStatus(status: ChallengeItem["status"]) {
  switch (status) {
    case "pending_opponent_response":
      return {
        color: "warning",
        label: "Aguardando resposta",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_creator_reapproval":
      return {
        color: "warning",
        label: "Aguardando reaprovação",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_challenge_validation":
      return {
        color: "accent",
        label: "Validação do admin",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "confirmed":
      return {
        color: "success",
        label: "Confirmado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_cancellation_acceptance":
      return {
        color: "warning",
        label: "Cancelamento pendente",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_submission":
      return {
        color: "warning",
        label: "Pendente de placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_confirmation":
      return {
        color: "accent",
        label: "Confirmar placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_result_validation":
      return {
        color: "accent",
        label: "Validar resultado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_correction":
      return {
        color: "warning",
        label: "Corrigir placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_decision":
      return {
        color: "warning",
        label: "Decisão do admin",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "finished":
      return {
        color: "default",
        label: "Finalizado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "declined":
      return {
        color: "danger",
        label: "Recusado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "cancelled":
      return {
        color: "danger",
        label: "Cancelado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "invalidated":
      return {
        color: "danger",
        label: "Invalidado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    default:
      return {
        color: "default",
        label: status,
        variant: "soft",
      } satisfies ChallengeStatusChip;
  }
}

function formatScoreSummary(challenge: ChallengeItem) {
  const scoreSets = challenge.latestResultSubmission?.score.sets;

  if (!(scoreSets && scoreSets.length > 0)) {
    return null;
  }

  return buildChallengeCardScoreSummary({
    matchConfig: challenge.matchConfigSnapshot,
    sets: scoreSets,
  });
}

function getScoreValueClassName(input: {
  hasScoreSummary: boolean;
  isWinner: boolean;
}) {
  if (input.isWinner) {
    return "font-semibold text-accent";
  }

  return input.hasScoreSummary ? "text-foreground" : "text-muted";
}

function getAdminActionCopy(action: AdminActionTarget["action"]) {
  switch (action) {
    case "cancel":
      return {
        description: "Tem certeza que deseja cancelar este desafio?",
        isDanger: true,
        submitLabel: "Sim",
        title: "Cancelar desafio",
      };
    case "invalidate":
      return {
        description: "Tem certeza que deseja invalidar este desafio?",
        isDanger: true,
        submitLabel: "Sim",
        title: "Invalidar desafio",
      };
    case "reopen_challenge":
      return {
        description: "Tem certeza que deseja reabrir este desafio?",
        isDanger: false,
        submitLabel: "Sim",
        title: "Reabrir desafio",
      };
    case "reopen_result":
      return {
        description: "Tem certeza que deseja reabrir o resultado?",
        isDanger: false,
        submitLabel: "Sim",
        title: "Reabrir resultado",
      };
    default:
      return {
        description: "",
        isDanger: false,
        submitLabel: "Salvar",
        title: "Ação administrativa",
      };
  }
}

function resolveChallengesError(input: {
  challengesError: unknown;
  isChallengesError: boolean;
  isOccupiedSlotsError: boolean;
  occupiedSlotsError: unknown;
}) {
  if (input.isChallengesError) {
    return input.challengesError;
  }

  if (input.isOccupiedSlotsError) {
    return input.occupiedSlotsError;
  }

  return null;
}

export default function LeagueChallengesRoute() {
  const { leagueId } = useLocalSearchParams<{
    leagueId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const createChallenge = useMutation(
    crpc.league.challenges.create.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        bucket$.actions.setChallengeCreateTarget(null);
        toast.show({
          description: "Desafio enviado com sucesso.",
          id: "create-challenge-success",
          label: "Desafio criado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show(
          getCreateChallengeErrorToast(
            getToastErrorMessage(error, "Não foi possível criar o desafio.")
          )
        );
      },
    })
  );
  const acceptChallengeProposal = useMutation(
    crpc.league.challenges.acceptProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Proposta aceita com sucesso.",
          id: "accept-challenge-proposal-success",
          label: "Desafio aceito",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível aceitar a proposta."
          ),
          id: "accept-challenge-proposal-error",
          label: "Erro ao aceitar desafio",
          variant: "danger",
        });
      },
    })
  );
  const declineChallengeProposal = useMutation(
    crpc.league.challenges.declineProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Proposta recusada com sucesso.",
          id: "decline-challenge-proposal-success",
          label: "Desafio recusado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível recusar a proposta."
          ),
          id: "decline-challenge-proposal-error",
          label: "Erro ao recusar desafio",
          variant: "danger",
        });
      },
    })
  );
  const counterProposeChallenge = useMutation(
    crpc.league.challenges.counterPropose.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Contraproposta enviada com sucesso.",
          id: "counter-propose-challenge-success",
          label: "Contraproposta enviada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível reenviar a proposta."
          ),
          id: "counter-propose-challenge-error",
          label: "Erro ao reenviar proposta",
          variant: "danger",
        });
      },
    })
  );
  const cancelChallenge = useMutation(
    crpc.league.challenges.cancel.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Desafio cancelado com sucesso.",
          id: "cancel-challenge-success",
          label: "Desafio cancelado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível cancelar o desafio."
          ),
          id: "cancel-challenge-error",
          label: "Erro ao cancelar desafio",
          variant: "danger",
        });
      },
    })
  );
  const requestChallengeCancellation = useMutation(
    crpc.league.challenges.requestCancellation.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Solicitação de cancelamento enviada com sucesso.",
          id: "request-challenge-cancellation-success",
          label: "Cancelamento solicitado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar o cancelamento da partida."
          ),
          id: "request-challenge-cancellation-error",
          label: "Erro ao solicitar cancelamento",
          variant: "danger",
        });
      },
    })
  );
  const respondChallengeCancellation = useMutation(
    crpc.league.challenges.respondCancellationRequest.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateLeagueContext();
        toast.show({
          description:
            variables.action === "accept"
              ? "Cancelamento aceito com sucesso."
              : "Cancelamento recusado com sucesso.",
          id:
            variables.action === "accept"
              ? "accept-challenge-cancellation-success"
              : "reject-challenge-cancellation-success",
          label:
            variables.action === "accept"
              ? "Cancelamento aceito"
              : "Cancelamento recusado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível responder à solicitação de cancelamento."
          ),
          id: "respond-challenge-cancellation-error",
          label: "Erro ao responder cancelamento",
          variant: "danger",
        });
      },
    })
  );
  const submitChallengeResult = useMutation(
    crpc.league.challenges.submitResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar enviado com sucesso.",
          id: "submit-challenge-result-success",
          label: "Placar enviado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o placar."
          ),
          id: "submit-challenge-result-error",
          label: "Erro ao enviar placar",
          variant: "danger",
        });
      },
    })
  );
  const confirmChallengeResult = useMutation(
    crpc.league.challenges.confirmResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar confirmado com sucesso.",
          id: "confirm-challenge-result-success",
          label: "Placar confirmado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível confirmar o placar."
          ),
          id: "confirm-challenge-result-error",
          label: "Erro ao confirmar placar",
          variant: "danger",
        });
      },
    })
  );
  const reviewChallenge = useMutation(
    crpc.league.challenges.reviewChallenge.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Validação do desafio atualizada com sucesso.",
          id: "review-challenge-success",
          label: "Desafio validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o desafio."
          ),
          id: "review-challenge-error",
          label: "Erro ao validar desafio",
          variant: "danger",
        });
      },
    })
  );
  const reviewChallengeResult = useMutation(
    crpc.league.challenges.reviewResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Validação do resultado atualizada com sucesso.",
          id: "review-challenge-result-success",
          label: "Resultado validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o resultado."
          ),
          id: "review-challenge-result-error",
          label: "Erro ao validar resultado",
          variant: "danger",
        });
      },
    })
  );
  const adminManageChallenge = useMutation(
    crpc.league.challenges.adminManage.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateLeagueContext();
        toast.show(getAdminManageChallengeSuccessToast(variables));
      },
      onError: (error, variables) => {
        toast.show(
          getAdminManageChallengeErrorToast({
            action: variables.action,
            message: getToastErrorMessage(
              error,
              "Não foi possível aplicar a ação."
            ),
          })
        );
      },
    })
  );
  const adminSubmitChallengeResult = useMutation(
    crpc.league.challenges.adminSubmitResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar salvo e ranking atualizado.",
          id: "admin-submit-challenge-result-success",
          label: "Placar atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível salvar o placar pelo admin."
          ),
          id: "admin-submit-challenge-result-error",
          label: "Erro ao salvar placar",
          variant: "danger",
        });
      },
    })
  );

  const challenges = challengesQuery.data ?? [];
  const courts = league?.courts ?? [];
  const defaultDurationMinutes =
    league?.ruleConfig.matchConfig.defaultDurationMinutes ?? 0;
  const error = challengesError;
  const isLoading = challengesQuery.isPending || occupiedSlotsQuery.isPending;
  const isPending =
    createChallenge.isPending ||
    acceptChallengeProposal.isPending ||
    declineChallengeProposal.isPending ||
    counterProposeChallenge.isPending ||
    cancelChallenge.isPending ||
    requestChallengeCancellation.isPending ||
    respondChallengeCancellation.isPending ||
    submitChallengeResult.isPending ||
    confirmChallengeResult.isPending ||
    reviewChallenge.isPending ||
    reviewChallengeResult.isPending ||
    adminManageChallenge.isPending ||
    adminSubmitChallengeResult.isPending;
  const occupiedSlots = occupiedSlotsQuery.data ?? [];

  const onAccept = (challengeId: string) => {
    acceptChallengeProposal.mutate({ challengeId });
  };
  const onAdminManage = async (input: {
    action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
    challengeId: string;
  }) => {
    await adminManageChallenge.mutateAsync(input);
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
    await adminSubmitChallengeResult.mutateAsync(input);
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
      pendingCount: tabCounts.pending,
    })
  );
  const [counterProposalTarget, setCounterProposalTarget] =
    useState<ChallengeItem | null>(null);
  const [resultTarget, setResultTarget] = useState<ChallengeItem | null>(null);
  const [adminActionTarget, setAdminActionTarget] =
    useState<AdminActionTarget | null>(null);
  const showAdminPendingTab = canManage && tabCounts.pending > 0;

  useEffect(() => {
    if (!(canManage && !showAdminPendingTab && activeTab === "pending")) {
      return;
    }

    setActiveTab("active");
  }, [activeTab, canManage, showAdminPendingTab]);

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

  function renderChallengesContent() {
    if (bootstrapStatus === "error") {
      return <ErrorState message="Não foi possível carregar a liga." />;
    }

    if (!league) {
      return <LoadingState />;
    }

    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      return (
        <ErrorState
          error={error}
          message="Não foi possível carregar os desafios."
        />
      );
    }

    function getOpponent(challenge: ChallengeItem) {
      return challenge.challenger.playerProfileId === viewerPlayerProfileId
        ? challenge.challenged
        : challenge.challenger;
    }

    function isViewerReceiver(challenge: ChallengeItem) {
      if (canManage) {
        return false;
      }

      if (challenge.status === "pending_opponent_response") {
        return challenge.challenged.playerProfileId === viewerPlayerProfileId;
      }

      if (challenge.status === "pending_creator_reapproval") {
        return challenge.challenger.playerProfileId === viewerPlayerProfileId;
      }

      return false;
    }

    function canSubmitScore(challenge: ChallengeItem) {
      return (
        !canManage &&
        [
          "confirmed",
          "pending_result_submission",
          "pending_result_correction",
          "pending_result_confirmation",
        ].includes(challenge.status)
      );
    }

    function canConfirmScore(challenge: ChallengeItem) {
      if (canManage || challenge.status !== "pending_result_confirmation") {
        return false;
      }

      const submittedBy =
        challenge.latestResultSubmission?.submittedByMembershipId;

      if (!submittedBy) {
        return false;
      }

      let viewerMembershipId: string | null = null;

      if (challenge.challenger.playerProfileId === viewerPlayerProfileId) {
        viewerMembershipId = challenge.challenger.membershipId;
      } else if (
        challenge.challenged.playerProfileId === viewerPlayerProfileId
      ) {
        viewerMembershipId = challenge.challenged.membershipId;
      }

      return Boolean(viewerMembershipId && viewerMembershipId !== submittedBy);
    }

    function buildScheduledStartAt(challenge: ChallengeItem) {
      const scheduledStartAt = new Date(
        `${challenge.currentProposal.matchDate}T00:00:00.000Z`
      );

      if (Number.isNaN(scheduledStartAt.getTime())) {
        return null;
      }

      scheduledStartAt.setUTCMinutes(
        challenge.currentProposal.startMinute,
        0,
        0
      );

      return scheduledStartAt;
    }

    function canRequestCancellation(challenge: ChallengeItem) {
      if (canManage || challenge.status !== "confirmed") {
        return false;
      }

      const scheduledStartAt = buildScheduledStartAt(challenge);

      if (!scheduledStartAt) {
        return false;
      }

      return Date.now() < scheduledStartAt.getTime();
    }

    function isViewerCancellationResponder(challenge: ChallengeItem) {
      if (
        canManage ||
        challenge.status !== "pending_cancellation_acceptance" ||
        !challenge.cancellationRequestedByMembershipId
      ) {
        return false;
      }

      if (
        challenge.cancellationRequestedByMembershipId ===
        challenge.challenger.membershipId
      ) {
        return challenge.challenged.playerProfileId === viewerPlayerProfileId;
      }

      return challenge.challenger.playerProfileId === viewerPlayerProfileId;
    }

    return (
      <>
        {visibleChallenges.length === 0 ? (
          <EmptyState
            description={emptyState.description}
            title={emptyState.title}
          />
        ) : (
          <View className="gap-2">
            {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this render block intentionally keeps the player/admin challenge actions colocated with each item */}
            {visibleChallenges.map((challenge) => {
              const viewerIsReceiver = isViewerReceiver(challenge);
              const viewerIsCancellationResponder =
                isViewerCancellationResponder(challenge);
              const statusChip = formatStatus(challenge.status);
              const scoreSummary = formatScoreSummary(challenge);
              const winnerMembershipId =
                challenge.latestResultSubmission?.winnerMembershipId ?? null;
              const challengerScoreClass = getScoreValueClassName({
                hasScoreSummary: Boolean(scoreSummary),
                isWinner:
                  winnerMembershipId === challenge.challenger.membershipId,
              });
              const challengedScoreClass = getScoreValueClassName({
                hasScoreSummary: Boolean(scoreSummary),
                isWinner:
                  winnerMembershipId === challenge.challenged.membershipId,
              });
              const menuActions: Array<{
                icon: ComponentProps<typeof HugeIcons>["icon"];
                id: string;
                isDanger?: boolean;
                label: string;
                onPress: () => void;
              }> = [];

              if (!canManage && viewerIsReceiver) {
                menuActions.push(
                  {
                    icon: Tick02Icon,
                    id: `${challenge.id}-accept`,
                    label: "Aceitar",
                    onPress: () => {
                      onAccept(challenge.id);
                    },
                  },
                  {
                    icon: Edit02Icon,
                    id: `${challenge.id}-counter-propose`,
                    label: "Reenviar",
                    onPress: () => {
                      setCounterProposalTarget(challenge);
                    },
                  },
                  {
                    icon: Cancel01Icon,
                    id: `${challenge.id}-decline`,
                    isDanger: true,
                    label: "Recusar",
                    onPress: () => {
                      onDecline(challenge.id);
                    },
                  }
                );
              }

              if (!canManage && viewerIsCancellationResponder) {
                menuActions.push(
                  {
                    icon: Tick02Icon,
                    id: `${challenge.id}-accept-cancellation`,
                    label: "Aceitar cancelamento",
                    onPress: () => {
                      onRespondCancellation({
                        action: "accept",
                        challengeId: challenge.id,
                      });
                    },
                  },
                  {
                    icon: Cancel01Icon,
                    id: `${challenge.id}-reject-cancellation`,
                    isDanger: true,
                    label: "Recusar cancelamento",
                    onPress: () => {
                      onRespondCancellation({
                        action: "reject",
                        challengeId: challenge.id,
                      });
                    },
                  }
                );
              }

              if (
                !(
                  canManage ||
                  viewerIsReceiver ||
                  viewerIsCancellationResponder ||
                  canRequestCancellation(challenge) ||
                  challenge.status === "pending_result_confirmation" ||
                  challenge.status === "pending_result_correction" ||
                  challenge.status === "confirmed" ||
                  challenge.status === "pending_cancellation_acceptance" ||
                  CLOSED_STATUSES.has(challenge.status)
                )
              ) {
                menuActions.push({
                  icon: Cancel01Icon,
                  id: `${challenge.id}-cancel`,
                  isDanger: true,
                  label: "Cancelar",
                  onPress: () => {
                    onCancel(challenge.id);
                  },
                });
              }

              if (canRequestCancellation(challenge)) {
                menuActions.push({
                  icon: Cancel01Icon,
                  id: `${challenge.id}-request-cancellation`,
                  isDanger: true,
                  label: "Solicitar cancelamento",
                  onPress: () => {
                    onRequestCancellation(challenge.id);
                  },
                });
              }

              if (canSubmitScore(challenge)) {
                menuActions.push({
                  icon: Edit02Icon,
                  id: `${challenge.id}-submit-result`,
                  label:
                    challenge.status === "pending_result_confirmation"
                      ? "Reeditar placar"
                      : "Enviar placar",
                  onPress: () => {
                    setResultTarget(challenge);
                  },
                });
              }

              if (canConfirmScore(challenge)) {
                menuActions.push({
                  icon: Tick02Icon,
                  id: `${challenge.id}-confirm-result`,
                  label: "Confirmar placar",
                  onPress: () => {
                    onConfirmResult(challenge.id);
                  },
                });
              }

              if (canManage) {
                for (const actionId of buildChallengeAdminMenuActionIds(
                  challenge
                )) {
                  switch (actionId) {
                    case "approve_challenge":
                      menuActions.push({
                        icon: Tick02Icon,
                        id: `${challenge.id}-approve-challenge`,
                        label: "Aprovar desafio",
                        onPress: () => {
                          onReviewChallenge({
                            action: "approve",
                            challengeId: challenge.id,
                          });
                        },
                      });
                      break;
                    case "reject_challenge":
                      menuActions.push({
                        icon: Cancel01Icon,
                        id: `${challenge.id}-reject-challenge`,
                        isDanger: true,
                        label: "Rejeitar",
                        onPress: () => {
                          onReviewChallenge({
                            action: "reject",
                            challengeId: challenge.id,
                          });
                        },
                      });
                      break;
                    case "approve_result":
                      menuActions.push({
                        icon: Tick02Icon,
                        id: `${challenge.id}-approve-result`,
                        label: "Aprovar resultado",
                        onPress: () => {
                          onReviewResult({
                            action: "approve",
                            challengeId: challenge.id,
                            resultSubmissionId:
                              challenge.latestResultSubmission?.id ?? "",
                          });
                        },
                      });
                      break;
                    case "request_result_correction":
                      menuActions.push({
                        icon: Edit02Icon,
                        id: `${challenge.id}-request-correction`,
                        label: "Solicitar correção",
                        onPress: () => {
                          onReviewResult({
                            action: "request_correction",
                            challengeId: challenge.id,
                            resultSubmissionId:
                              challenge.latestResultSubmission?.id ?? "",
                          });
                        },
                      });
                      break;
                    case "submit_result":
                      menuActions.push({
                        icon: Edit02Icon,
                        id: `${challenge.id}-admin-submit-result`,
                        label: challenge.latestResultSubmission
                          ? "Editar placar"
                          : "Lançar placar",
                        onPress: () => {
                          setResultTarget(challenge);
                        },
                      });
                      break;
                    case "admin_cancel":
                      menuActions.push({
                        icon: Cancel01Icon,
                        id: `${challenge.id}-admin-cancel`,
                        isDanger: true,
                        label: "Cancelar",
                        onPress: () => {
                          setAdminActionTarget({
                            action: "cancel",
                            challenge,
                          });
                        },
                      });
                      break;
                    case "admin_invalidate":
                      menuActions.push({
                        icon: Cancel01Icon,
                        id: `${challenge.id}-admin-invalidate`,
                        isDanger: true,
                        label: "Invalidar",
                        onPress: () => {
                          setAdminActionTarget({
                            action: "invalidate",
                            challenge,
                          });
                        },
                      });
                      break;
                    case "reopen_challenge":
                      menuActions.push({
                        icon: Edit02Icon,
                        id: `${challenge.id}-reopen-challenge`,
                        label: "Reabrir desafio",
                        onPress: () => {
                          setAdminActionTarget({
                            action: "reopen_challenge",
                            challenge,
                          });
                        },
                      });
                      break;
                    case "reopen_result":
                      menuActions.push({
                        icon: Edit02Icon,
                        id: `${challenge.id}-reopen-result`,
                        label: "Reabrir resultado",
                        onPress: () => {
                          setAdminActionTarget({
                            action: "reopen_result",
                            challenge,
                          });
                        },
                      });
                      break;
                    default:
                      break;
                  }
                }
              }

              return (
                <Card className="p-3" key={challenge.id}>
                  <View className="flex-row items-center gap-3">
                    <View className="relative h-13 w-12">
                      <Image
                        className="absolute top-0 left-0 size-8.5 rounded-full border border-separator"
                        fallback="green"
                        source={challenge.challenger.player.avatarUrl}
                      />
                      <Image
                        className="absolute right-0 bottom-0 size-8.5 rounded-full border border-separator"
                        fallback="blue"
                        source={challenge.challenged.player.avatarUrl}
                      />
                    </View>
                    <View className="min-w-0 flex-1 gap-2">
                      <View className="flex-row items-center justify-between gap-3">
                        <Chip
                          color={statusChip.color}
                          variant={statusChip.variant}
                        >
                          {statusChip.label}
                        </Chip>
                        {/* Menu com as opções */}
                        {menuActions.length > 0 ? (
                          <Menu>
                            <Menu.Trigger asChild>
                              <Button
                                className="size-7"
                                isDisabled={isPending}
                                isIconOnly
                                size="sm"
                                variant="tertiary"
                              >
                                <HugeIcons
                                  className="size-4.5"
                                  icon={MoreVerticalIcon}
                                />
                              </Button>
                            </Menu.Trigger>
                            <Menu.Portal>
                              <Menu.Overlay />
                              <Menu.Content presentation="popover">
                                {menuActions.map((action) => (
                                  <Menu.Item
                                    key={action.id}
                                    onPress={action.onPress}
                                  >
                                    <Menu.ItemTitle
                                      className={
                                        action.isDanger
                                          ? "flex-none text-danger"
                                          : "flex-none"
                                      }
                                    >
                                      {action.label}
                                    </Menu.ItemTitle>
                                    <HugeIcons
                                      className={cn(
                                        "size-4.5",
                                        action.isDanger ? "text-danger" : ""
                                      )}
                                      icon={action.icon}
                                    />
                                  </Menu.Item>
                                ))}
                              </Menu.Content>
                            </Menu.Portal>
                          </Menu>
                        ) : null}
                      </View>

                      <View className="gap-1">
                        <View className="flex-row items-center gap-1">
                          <Text
                            className={cn(
                              "max-w-[40%]",
                              winnerMembershipId ===
                                challenge.challenger.membershipId
                                ? "font-semibold text-accent"
                                : ""
                            )}
                            numberOfLines={1}
                            variant="description"
                          >
                            {challenge.challenger.player.fullName}
                          </Text>
                          <Text
                            className={cn(challengerScoreClass)}
                            variant="description"
                          >
                            {scoreSummary?.challengerScore ?? "-"}
                          </Text>
                          <Text className="text-muted" variant="description">
                            x
                          </Text>
                          <Text
                            className={cn(challengedScoreClass)}
                            variant="description"
                          >
                            {scoreSummary?.challengedScore ?? "-"}
                          </Text>
                          <Text
                            className={cn(
                              "max-w-[40%]",
                              winnerMembershipId ===
                                challenge.challenged.membershipId
                                ? "font-semibold text-accent"
                                : ""
                            )}
                            numberOfLines={1}
                            variant="description"
                          >
                            {challenge.challenged.player.fullName}
                          </Text>
                        </View>
                        {scoreSummary?.setsSummary ? (
                          <Text className="text-muted" variant="description">
                            {scoreSummary.setsSummary}
                          </Text>
                        ) : null}
                      </View>

                      <Text
                        color="muted"
                        numberOfLines={2}
                        variant="description"
                      >
                        {formatProposalSummary(challenge)}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
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
              counterProposalTarget.matchConfigSnapshot.defaultDurationMinutes
            }
            initialValue={{
              courtId: counterProposalTarget.currentProposal.courtId,
              endMinute: counterProposalTarget.currentProposal.endMinute,
              matchDate: counterProposalTarget.currentProposal.matchDate,
              startMinute: counterProposalTarget.currentProposal.startMinute,
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
            opponentName={getOpponent(counterProposalTarget).player.fullName}
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
          <ChallengeAdminActionDialog
            description={`${getAdminActionCopy(adminActionTarget.action).description} ${adminActionTarget.challenge.challenger.player.fullName} x ${adminActionTarget.challenge.challenged.player.fullName}.`}
            isDanger={getAdminActionCopy(adminActionTarget.action).isDanger}
            isOpen
            isPending={isPending}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setAdminActionTarget(null);
              }
            }}
            onSubmit={async () => {
              await onAdminManage({
                action: adminActionTarget.action,
                challengeId: adminActionTarget.challenge.id,
              });
              setAdminActionTarget(null);
            }}
            submitLabel={
              getAdminActionCopy(adminActionTarget.action).submitLabel
            }
            title={getAdminActionCopy(adminActionTarget.action).title}
          />
        ) : null}
      </>
    );
  }

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
                    {showAdminPendingTab ? (
                      <Tabs.Trigger value="pending">
                        <Tabs.Label>Pendentes</Tabs.Label>
                        {tabCounts.pending > 0 ? (
                          <Badge
                            className="absolute top-1 right-1"
                            color="danger"
                            size="sm"
                          >
                            {tabCounts.pending}
                          </Badge>
                        ) : null}
                      </Tabs.Trigger>
                    ) : null}
                    <Tabs.Trigger value="active">
                      <Tabs.Label>Ativos</Tabs.Label>
                      {tabCounts.active > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="danger"
                          size="sm"
                        >
                          {tabCounts.active}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="corrections">
                      <Tabs.Label>Correções</Tabs.Label>
                      {tabCounts.corrections > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="danger"
                          size="sm"
                        >
                          {tabCounts.corrections}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="history">
                      <Tabs.Label>Histórico</Tabs.Label>
                    </Tabs.Trigger>
                  </>
                ) : (
                  <>
                    <Tabs.Trigger value="active">
                      <Tabs.Label>Ativos</Tabs.Label>
                      {tabCounts.active > 0 ? (
                        <Badge
                          className="absolute top-1 right-1"
                          color="danger"
                          size="sm"
                        >
                          {tabCounts.active}
                        </Badge>
                      ) : null}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="outgoing">
                      <Tabs.Label>Enviados</Tabs.Label>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="incoming">
                      <Tabs.Label>Recebidos</Tabs.Label>
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
        {renderChallengesContent()}
      </Page.ScrollView>
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
