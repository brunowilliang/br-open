import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Tabs, useToast } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { ChallengeCard } from "@/components/pages/leagues/challenge-card";
import { ChallengeAdminActionDialog } from "@/components/pages/leagues/challenge-admin-action-dialog";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { ChallengeResultDialog } from "@/components/pages/leagues/challenge-result-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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

type AdminActionTarget = {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  challenge: ChallengeItem;
};

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tela de desafios aglutina mutations, dialogs e tabs; estados renderizados inline
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

  const adminRequestResultReminder = useMutation(
    crpc.league.challenges.adminRequestResultReminder.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description:
            "Os jogadores foram notificados para registrar o placar.",
          id: "admin-request-result-reminder-success",
          label: "Lembrete enviado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o lembrete."
          ),
          id: "admin-request-result-reminder-error",
          label: "Erro ao enviar lembrete",
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
    adminSubmitChallengeResult.isPending ||
    adminRequestResultReminder.isPending;
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
  const onRequestResultReminder = (challengeId: string) => {
    adminRequestResultReminder.mutate({ challengeId });
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
      pendingCount: tabCounts.attention,
    })
  );
  const [counterProposalTarget, setCounterProposalTarget] =
    useState<ChallengeItem | null>(null);
  const [resultTarget, setResultTarget] = useState<ChallengeItem | null>(null);
  const [adminActionTarget, setAdminActionTarget] =
    useState<AdminActionTarget | null>(null);

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
      setAdminActionTarget(target);
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
        )}
      </Page.ScrollView>
      <Page.Footer className="pb-floating-tab-bar-4" />
    </Page>
  );
}
