import type { ApiOutputs } from "@convex/shared/api";
import { Button, Chip, ListGroup, Menu, Separator, Tabs } from "heroui-native";
import { Badge } from "heroui-native-pro";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { ScrollView, View } from "react-native";

import { Image } from "@/components/core/image";
import { ChallengeAdminActionDialog } from "@/components/pages/leagues/challenge-admin-action-dialog";
import { Text } from "@/components/core/text";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { ChallengeResultDialog } from "@/components/pages/leagues/challenge-result-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { buildChallengeTabCounts } from "@/lib/leagues/challenge-tab-counts";
import {
  Cancel01Icon,
  Edit02Icon,
  MoreVerticalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "better-styled";

type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];
type LeagueCourt =
  ApiOutputs["league"]["discovery"]["getById"]["courts"][number];
type OccupiedChallengeSlot =
  ApiOutputs["league"]["challenges"]["listOccupiedSlots"][number];

type CreateChallengeTarget = {
  membershipId: string;
  name: string;
};

type ChallengesProps = {
  canManage?: boolean;
  challengeValidationMode?: "automatic" | "manual";
  challenges: ChallengeItem[];
  courts: LeagueCourt[];
  createTarget?: CreateChallengeTarget | null;
  defaultDurationMinutes: number;
  errorMessage?: string;
  isLoading?: boolean;
  isPending?: boolean;
  occupiedSlots: OccupiedChallengeSlot[];
  onAccept: (challengeId: string) => void;
  onAdminManage: (input: {
    action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
    challengeId: string;
    reason: string;
  }) => Promise<void> | void;
  onCancel: (challengeId: string) => void;
  onCloseCreateTarget: () => void;
  onConfirmResult: (challengeId: string) => void;
  onCounterPropose: (input: {
    challengeId: string;
    courtId: string;
    endMinute: number;
    matchDate: string;
    startMinute: number;
  }) => Promise<void> | void;
  onCreate: (input: {
    challengedMembershipId: string;
    courtId: string;
    endMinute: number;
    matchDate: string;
    startMinute: number;
  }) => Promise<void> | void;
  onDecline: (challengeId: string) => void;
  onRequestCancellation: (challengeId: string) => void;
  onReviewChallenge: (input: {
    action: "approve" | "reject";
    challengeId: string;
  }) => void;
  onReviewResult: (input: {
    action: "approve" | "invalidate" | "request_correction";
    challengeId: string;
    resultSubmissionId: string;
  }) => void;
  onRespondCancellation: (input: {
    action: "accept" | "reject";
    challengeId: string;
  }) => void;
  onSubmitResult: (input: {
    challengeId: string;
    score: {
      sets: Array<{
        challengedGames: number;
        challengerGames: number;
        kind: "set" | "super_tiebreak";
      }>;
      winnerMembershipId: string;
    };
  }) => Promise<void> | void;
  resultValidationMode?: "automatic" | "manual";
  viewerUserId?: string | null;
};

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
  const firstSet = challenge.latestResultSubmission?.score.sets[0];

  if (!firstSet) {
    return null;
  }

  return {
    challengedGames: firstSet.challengedGames,
    challengerGames: firstSet.challengerGames,
  };
}

function getAdminActionCopy(action: AdminActionTarget["action"]) {
  switch (action) {
    case "cancel":
      return {
        description:
          "Explique por que esse desafio deve ser encerrado administrativamente.",
        isDanger: true,
        submitLabel: "Cancelar desafio",
        title: "Cancelar administrativamente",
      };
    case "invalidate":
      return {
        description:
          "Explique por que essa partida ou resultado não deve mais valer.",
        isDanger: true,
        submitLabel: "Invalidar desafio",
        title: "Invalidar administrativamente",
      };
    case "reopen_challenge":
      return {
        description:
          "Explique por que o fluxo do desafio precisa ser reaberto.",
        isDanger: false,
        submitLabel: "Reabrir desafio",
        title: "Reabrir desafio",
      };
    case "reopen_result":
      return {
        description: "Explique por que o placar precisa ser reaberto.",
        isDanger: false,
        submitLabel: "Reabrir resultado",
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this component intentionally keeps challenge-tab filtering and per-item challenge actions colocated
export const Challenges = (props: ChallengesProps) => {
  const {
    canManage,
    challenges,
    courts,
    createTarget,
    defaultDurationMinutes,
    errorMessage,
    isLoading,
    isPending,
    occupiedSlots,
    onAccept,
    onAdminManage,
    onCancel,
    onCloseCreateTarget,
    onConfirmResult,
    onCounterPropose,
    onCreate,
    onDecline,
    onRequestCancellation,
    onReviewChallenge,
    onReviewResult,
    onRespondCancellation,
    onSubmitResult,
    viewerUserId,
  } = props;
  const [activeTab, setActiveTab] = useState(canManage ? "pending" : "active");
  const [counterProposalTarget, setCounterProposalTarget] =
    useState<ChallengeItem | null>(null);
  const [resultTarget, setResultTarget] = useState<ChallengeItem | null>(null);
  const [adminActionTarget, setAdminActionTarget] =
    useState<AdminActionTarget | null>(null);
  const tabCounts = useMemo(
    () =>
      buildChallengeTabCounts({
        canManage,
        challenges,
        viewerUserId,
      }),
    [canManage, challenges, viewerUserId]
  );
  const showAdminPendingTab = canManage && tabCounts.pending > 0;

  useEffect(() => {
    if (!(canManage && !showAdminPendingTab && activeTab === "pending")) {
      return;
    }

    setActiveTab("active");
  }, [activeTab, canManage, showAdminPendingTab]);

  const visibleChallenges = useMemo(() => {
    if (canManage) {
      switch (activeTab) {
        case "pending":
          return challenges.filter((challenge) =>
            [
              "pending_admin_challenge_validation",
              "pending_admin_result_validation",
              "pending_admin_decision",
            ].includes(challenge.status)
          );
        case "active":
          return challenges.filter((challenge) =>
            [
              "pending_opponent_response",
              "pending_creator_reapproval",
              "confirmed",
              "pending_cancellation_acceptance",
              "pending_result_submission",
              "pending_result_confirmation",
            ].includes(challenge.status)
          );
        case "corrections":
          return challenges.filter(
            (challenge) => challenge.status === "pending_result_correction"
          );
        case "history":
          return challenges.filter((challenge) =>
            CLOSED_STATUSES.has(challenge.status)
          );
        default:
          return challenges.filter((challenge) =>
            [
              "pending_admin_challenge_validation",
              "pending_admin_result_validation",
              "pending_admin_decision",
            ].includes(challenge.status)
          );
      }
    }

    switch (activeTab) {
      case "outgoing":
        return challenges.filter(
          (challenge) => challenge.challenger.userId === viewerUserId
        );
      case "active":
        return challenges.filter(
          (challenge) => !CLOSED_STATUSES.has(challenge.status)
        );
      case "history":
        return challenges.filter((challenge) =>
          CLOSED_STATUSES.has(challenge.status)
        );
      default:
        return challenges.filter(
          (challenge) => challenge.challenged.userId === viewerUserId
        );
    }
  }, [activeTab, canManage, challenges, viewerUserId]);
  const hasAnyChallenges = challenges.length > 0;
  let emptyStateDescription =
    "Nenhum desafio corresponde ao filtro selecionado.";
  let emptyStateTitle = "Nada por aqui";

  if (!hasAnyChallenges) {
    emptyStateDescription = canManage
      ? "Quando os jogadores começarem a desafiar, os desafios aparecerão aqui."
      : "Quando você abrir ou receber desafios, eles aparecerão aqui.";
    emptyStateTitle = "Nenhum desafio encontrado";
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (errorMessage) {
    return <ErrorState message={errorMessage} />;
  }

  function getOpponent(challenge: ChallengeItem) {
    return challenge.challenger.userId === viewerUserId
      ? challenge.challenged
      : challenge.challenger;
  }

  function isViewerReceiver(challenge: ChallengeItem) {
    if (canManage) {
      return false;
    }

    if (challenge.status === "pending_opponent_response") {
      return challenge.challenged.userId === viewerUserId;
    }

    if (challenge.status === "pending_creator_reapproval") {
      return challenge.challenger.userId === viewerUserId;
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

    if (challenge.challenger.userId === viewerUserId) {
      viewerMembershipId = challenge.challenger.membershipId;
    } else if (challenge.challenged.userId === viewerUserId) {
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

    scheduledStartAt.setUTCMinutes(challenge.currentProposal.startMinute, 0, 0);

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
      return challenge.challenged.userId === viewerUserId;
    }

    return challenge.challenger.userId === viewerUserId;
  }

  return (
    <>
      <Tabs onValueChange={setActiveTab} value={activeTab} variant="secondary">
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

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 pt-3 grow pb-safe-offset-4"
        showsVerticalScrollIndicator={false}
      >
        {visibleChallenges.length === 0 ? (
          <EmptyState
            description={emptyStateDescription}
            title={emptyStateTitle}
          />
        ) : (
          <ListGroup>
            {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this render block intentionally keeps the player/admin challenge actions colocated with each item */}
            {visibleChallenges.map((challenge, index) => {
              const viewerIsReceiver = isViewerReceiver(challenge);
              const viewerIsCancellationResponder =
                isViewerCancellationResponder(challenge);
              const statusChip = formatStatus(challenge.status);
              const scoreSummary = formatScoreSummary(challenge);
              const winnerMembershipId =
                challenge.latestResultSubmission?.winnerMembershipId ?? null;
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

              if (
                canManage &&
                challenge.status === "pending_admin_challenge_validation"
              ) {
                menuActions.push(
                  {
                    icon: Tick02Icon,
                    id: `${challenge.id}-approve-challenge`,
                    label: "Aprovar desafio",
                    onPress: () => {
                      onReviewChallenge({
                        action: "approve",
                        challengeId: challenge.id,
                      });
                    },
                  },
                  {
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
                  }
                );
              }

              if (
                canManage &&
                challenge.status === "pending_admin_result_validation" &&
                challenge.latestResultSubmission
              ) {
                menuActions.push(
                  {
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
                  },
                  {
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
                  }
                );
              }

              if (
                canManage &&
                [
                  "pending_opponent_response",
                  "pending_creator_reapproval",
                  "pending_admin_challenge_validation",
                  "confirmed",
                  "pending_cancellation_acceptance",
                  "pending_result_submission",
                  "pending_result_confirmation",
                  "pending_admin_result_validation",
                  "pending_result_correction",
                  "pending_admin_decision",
                ].includes(challenge.status)
              ) {
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
              }

              if (
                canManage &&
                [
                  "confirmed",
                  "pending_cancellation_acceptance",
                  "pending_result_submission",
                  "pending_result_confirmation",
                  "pending_admin_result_validation",
                  "pending_result_correction",
                  "pending_admin_decision",
                  "finished",
                ].includes(challenge.status)
              ) {
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
              }

              if (
                canManage &&
                ["declined", "cancelled"].includes(challenge.status)
              ) {
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
              }

              if (canManage && challenge.status === "invalidated") {
                menuActions.push({
                  icon: Edit02Icon,
                  id: `${challenge.id}-reopen-invalidated`,
                  label: challenge.latestResultSubmission
                    ? "Reabrir resultado"
                    : "Reabrir desafio",
                  onPress: () => {
                    setAdminActionTarget({
                      action: challenge.latestResultSubmission
                        ? "reopen_result"
                        : "reopen_challenge",
                      challenge,
                    });
                  },
                });
              }

              if (canManage && challenge.status === "finished") {
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
              }

              return (
                <Fragment key={challenge.id}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ListGroup.Item disabled>
                    <ListGroup.ItemPrefix>
                      <View className="relative h-12 w-10">
                        <Image
                          className="absolute top-0 left-0 size-7 rounded-full border border-separator"
                          fallback="green"
                          source={challenge.challenger.player.avatarUrl}
                        />
                        <Image
                          className="absolute right-0 bottom-0 size-7 rounded-full border border-separator"
                          fallback="blue"
                          source={challenge.challenged.player.avatarUrl}
                        />
                      </View>
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
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

                      <View className="flex-row items-center gap-1">
                        <Text
                          className={cn(
                            "min-w-0",
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
                        {scoreSummary ? (
                          <>
                            <Text
                              className={cn(
                                winnerMembershipId ===
                                  challenge.challenger.membershipId
                                  ? "font-semibold text-accent"
                                  : "text-foreground"
                              )}
                              variant="description"
                            >
                              {scoreSummary.challengerGames}
                            </Text>
                            <Text className="text-muted" variant="description">
                              x
                            </Text>
                            <Text
                              className={cn(
                                winnerMembershipId ===
                                  challenge.challenged.membershipId
                                  ? "font-semibold text-accent"
                                  : "text-foreground"
                              )}
                              variant="description"
                            >
                              {scoreSummary.challengedGames}
                            </Text>
                          </>
                        ) : (
                          <Text className="text-muted" variant="description">
                            x
                          </Text>
                        )}
                        <Text
                          className={cn(
                            "min-w-0",
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

                      <ListGroup.ItemDescription>
                        {formatProposalSummary(challenge)}
                      </ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                  </ListGroup.Item>
                </Fragment>
              );
            })}
          </ListGroup>
        )}
      </ScrollView>

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
          initialScoreText={
            resultTarget.latestResultSubmission?.score.sets[0]
              ? `${resultTarget.latestResultSubmission.score.sets[0].challengerGames}x${resultTarget.latestResultSubmission.score.sets[0].challengedGames}`
              : undefined
          }
          isOpen
          isPending={isPending}
          matchConfig={resultTarget.matchConfigSnapshot}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setResultTarget(null);
            }
          }}
          onSubmit={async (value) => {
            await onSubmitResult({
              challengeId: resultTarget.id,
              score: value,
            });
            setResultTarget(null);
          }}
          title={
            resultTarget.status === "pending_result_confirmation"
              ? "Reeditar placar"
              : "Enviar placar"
          }
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
          onSubmit={async (reason) => {
            await onAdminManage({
              action: adminActionTarget.action,
              challengeId: adminActionTarget.challenge.id,
              reason,
            });
            setAdminActionTarget(null);
          }}
          submitLabel={getAdminActionCopy(adminActionTarget.action).submitLabel}
          title={getAdminActionCopy(adminActionTarget.action).title}
        />
      ) : null}
    </>
  );
};
