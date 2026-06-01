import type { ApiOutputs } from "@convex/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Description,
  ListGroup,
  Separator,
  Tabs,
  useToast,
} from "heroui-native";
import { Badge } from "heroui-native-pro";
import { Fragment, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { Challenges } from "@/components/pages/leagues/challenges";
import { MembershipRequests } from "@/components/pages/leagues/membership-requests";
import { Ranking } from "@/components/pages/leagues/ranking";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/ui/page";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { getCreateChallengeErrorToast } from "@/lib/leagues/challenge-feedback";
import { buildChallengeTabCounts } from "@/lib/leagues/challenge-tab-counts";
import { getMembershipActionLabel } from "@/lib/leagues/presentation";
import { Edit02Icon } from "@hugeicons/core-free-icons";

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

const ACTIVE_CHALLENGE_BLOCKING_STATUSES = new Set([
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
] as const);

const LEAGUE_TAB_VALUES = [
  "details",
  "ranking",
  "challenges",
  "requests",
  "rules",
] as const;

type LeagueTabValue = (typeof LEAGUE_TAB_VALUES)[number];

function normalizeLeagueTabParam(
  value?: string | string[]
): LeagueTabValue | null {
  const tab = Array.isArray(value) ? value[0] : value;

  return LEAGUE_TAB_VALUES.includes(tab as LeagueTabValue)
    ? (tab as LeagueTabValue)
    : null;
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

function formatValidationMode(value: "automatic" | "manual") {
  switch (value) {
    case "manual":
      return "Manual";
    default:
      return "Automática";
  }
}

function getAdminManageChallengeSuccessToast(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
}) {
  switch (input.action) {
    case "cancel":
      return {
        description: "A ação administrativa foi aplicada com sucesso.",
        id: "admin-manage-challenge-cancel-success",
        label: "Desafio cancelado",
        variant: "success" as const,
      };
    case "invalidate":
      return {
        description: "A ação administrativa foi aplicada com sucesso.",
        id: "admin-manage-challenge-invalidate-success",
        label: "Desafio invalidado",
        variant: "success" as const,
      };
    case "reopen_challenge":
      return {
        description: "O desafio foi reaberto com sucesso.",
        id: "admin-manage-challenge-reopen-challenge-success",
        label: "Desafio reaberto",
        variant: "success" as const,
      };
    case "reopen_result":
      return {
        description: "O resultado foi reaberto com sucesso.",
        id: "admin-manage-challenge-reopen-result-success",
        label: "Resultado reaberto",
        variant: "success" as const,
      };
    default:
      return {
        description: "A ação administrativa foi aplicada com sucesso.",
        id: "admin-manage-challenge-success",
        label: "Ação aplicada",
        variant: "success" as const,
      };
  }
}

function getAdminManageChallengeErrorToast(input: {
  action: "cancel" | "invalidate" | "reopen_challenge" | "reopen_result";
  message?: string;
}) {
  switch (input.action) {
    case "cancel":
      return {
        description:
          input.message || "Não foi possível cancelar o desafio pelo admin.",
        id: "admin-manage-challenge-cancel-error",
        label: "Erro ao cancelar desafio",
        variant: "danger" as const,
      };
    case "invalidate":
      return {
        description:
          input.message || "Não foi possível invalidar o desafio pelo admin.",
        id: "admin-manage-challenge-invalidate-error",
        label: "Erro ao invalidar desafio",
        variant: "danger" as const,
      };
    case "reopen_challenge":
      return {
        description: input.message || "Não foi possível reabrir o desafio.",
        id: "admin-manage-challenge-reopen-challenge-error",
        label: "Erro ao reabrir desafio",
        variant: "danger" as const,
      };
    case "reopen_result":
      return {
        description: input.message || "Não foi possível reabrir o resultado.",
        id: "admin-manage-challenge-reopen-result-error",
        label: "Erro ao reabrir resultado",
        variant: "danger" as const,
      };
    default:
      return {
        description: input.message || "Não foi possível aplicar a ação.",
        id: "admin-manage-challenge-error",
        label: "Erro na ação administrativa",
        variant: "danger" as const,
      };
  }
}

function isChallengeBlockedForLimit(status: string) {
  return ACTIVE_CHALLENGE_BLOCKING_STATUSES.has(
    status as typeof ACTIVE_CHALLENGE_BLOCKING_STATUSES extends Set<infer T>
      ? T
      : never
  );
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
        {
          label: "Validação do desafio",
          value: formatValidationMode(ruleConfig.challengeValidationMode),
        },
        {
          label: "Validação do resultado",
          value: formatValidationMode(ruleConfig.resultValidationMode),
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
          label: "Formato da partida",
          value: `Melhor de ${ruleConfig.matchConfig.bestOfSets} sets`,
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
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();
  const { leagueId: rawLeagueId, tab: rawTab } = useLocalSearchParams<{
    leagueId?: string | string[];
    tab?: string | string[];
  }>();
  const leagueId = Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId;
  const requestedTab = normalizeLeagueTabParam(rawTab);
  const [activeTab, setActiveTab] = useState<string>(requestedTab ?? "details");
  const [createChallengeTarget, setCreateChallengeTarget] = useState<{
    membershipId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

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
  const challengesQuery = useQuery({
    ...crpc.league.challenges.listForLeague.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(
      leagueId &&
        (leagueQuery.data?.isManagerOwner ||
          leagueQuery.data?.viewerMembershipStatus === "active")
    ),
  });
  const occupiedSlotsQuery = useQuery({
    ...crpc.league.challenges.listOccupiedSlots.queryOptions({
      leagueId: leagueId ?? "",
    }),
    enabled: Boolean(
      leagueId &&
        (leagueQuery.data?.isManagerOwner ||
          leagueQuery.data?.viewerMembershipStatus === "active")
    ),
  });

  async function invalidateLeagueContext() {
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
        await invalidateLeagueContext();

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
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar entrada."
          ),
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
        await invalidateLeagueContext();
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
        await invalidateLeagueContext();
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
  const removeMembership = useMutation(
    crpc.league.membership.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Jogador removido com sucesso.",
          id: "remove-membership-success",
          label: "Jogador removido",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível remover o jogador."
          ),
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
        await invalidateLeagueContext();
        toast.show({
          description: "Ranking atualizado com sucesso.",
          id: "reorder-ranking-success",
          label: "Ranking atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar o ranking."
          ),
          id: "reorder-ranking-error",
          label: "Erro ao atualizar ranking",
          variant: "danger",
        });
      },
    })
  );
  const createChallenge = useMutation(
    crpc.league.challenges.create.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
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

  if (!leagueId) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-4 pt-safe-offset-4 bg-background"
      >
        <ErrorState message="Liga inválida." />
      </ScrollView>
    );
  }

  if (leagueQuery.isPending) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-4 pt-safe-offset-4 bg-background"
      >
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
  const showChallengesTab = isManagerOwner || isAcceptedViewer;
  const showRequestsTab = isManagerOwner;
  const showRulesTab = !isManagerOwner;
  const showJoinFooter = !(isManagerOwner || isAcceptedViewer);
  const isRankingTabActive = showRankingTab && activeTab === "ranking";
  const isChallengesTabActive = showChallengesTab && activeTab === "challenges";
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
  const challengeTabCounts = buildChallengeTabCounts({
    canManage: isManagerOwner,
    challenges: challengesQuery.data ?? [],
    viewerUserId: session?.user?.id,
  });
  const viewerRankingItem = rankingItems.find(
    (item) => item.userId === session?.user?.id
  );
  const viewerPosition = viewerRankingItem?.position ?? null;
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
              <Page.Header.Right>
                {isManagerOwner && leagueId ? (
                  <Button
                    isIconOnly
                    onPress={() => {
                      router.navigate({
                        pathname: "/settings/leagues/[leagueId]/edit",
                        params: { leagueId },
                      });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <HugeIcons icon={Edit02Icon} />
                  </Button>
                ) : null}
              </Page.Header.Right>
            </View>
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                <Tabs.Trigger value="details">
                  <Tabs.Label>Detalhes</Tabs.Label>
                </Tabs.Trigger>
                {showRankingTab ? (
                  <Tabs.Trigger value="ranking">
                    <Tabs.Label>Ranking</Tabs.Label>
                  </Tabs.Trigger>
                ) : null}
                {showChallengesTab ? (
                  <Tabs.Trigger value="challenges">
                    <Tabs.Label>Desafios</Tabs.Label>
                    {challengeTabCounts.main > 0 ? (
                      <Badge
                        className="absolute top-1 right-1"
                        color="danger"
                        size="sm"
                      >
                        {challengeTabCounts.main}
                      </Badge>
                    ) : null}
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
              </Tabs.ScrollView>
            </Tabs.List>
          </View>
        </Page.Header>

        {isRankingTabActive || isChallengesTabActive ? null : (
          <Page.ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 pb-safe-offset-4"
          >
            <Tabs.Content value="details">
              <Image
                className="aspect-video w-full rounded-3xl"
                fallback="blue"
                source={league.coverUrl ?? undefined}
              />
              <Image
                className="-mt-15 mb-4 aspect-square size-30 self-center rounded-full"
                fallback="blue"
                source={league.avatarUrl ?? undefined}
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
          </Page.ScrollView>
        )}

        {isRankingTabActive ? (
          <Page.View className="flex-1 bg-background">
            <Tabs.Content className="px-4 pb-safe-offset-4" value="ranking">
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
                onChallengePress={(item) => {
                  if (isManagerOwner) {
                    return;
                  }

                  if (!(viewerRankingItem && challengesQuery.data)) {
                    setCreateChallengeTarget({
                      membershipId: item.id,
                      name: item.name,
                    });
                    setActiveTab("challenges");
                    return;
                  }

                  const viewerMembershipId = viewerRankingItem.id;
                  const monthStart = new Date();
                  monthStart.setUTCDate(1);
                  monthStart.setUTCHours(0, 0, 0, 0);

                  const viewerMonthlyChallenges = challengesQuery.data.filter(
                    (challenge) =>
                      challenge.challenger.membershipId ===
                        viewerMembershipId &&
                      challenge.createdAt >= monthStart.getTime()
                  ).length;

                  if (
                    viewerMonthlyChallenges >=
                    league.ruleConfig.maxChallengesPerMonth
                  ) {
                    toast.show(
                      getCreateChallengeErrorToast(
                        "Você já atingiu o limite mensal de desafios."
                      )
                    );
                    return;
                  }

                  const viewerActiveChallenges = challengesQuery.data.filter(
                    (challenge) =>
                      isChallengeBlockedForLimit(challenge.status) &&
                      (challenge.challenger.membershipId ===
                        viewerMembershipId ||
                        challenge.challenged.membershipId ===
                          viewerMembershipId)
                  ).length;

                  if (
                    viewerActiveChallenges >=
                    league.ruleConfig.maxActiveChallengesPerPlayer
                  ) {
                    toast.show(
                      getCreateChallengeErrorToast(
                        "Você já atingiu o limite de desafios ativos."
                      )
                    );
                    return;
                  }

                  const opponentActiveChallenges = challengesQuery.data.filter(
                    (challenge) =>
                      isChallengeBlockedForLimit(challenge.status) &&
                      (challenge.challenger.membershipId === item.id ||
                        challenge.challenged.membershipId === item.id)
                  ).length;

                  if (
                    opponentActiveChallenges >=
                    league.ruleConfig.maxActiveChallengesPerPlayer
                  ) {
                    toast.show(
                      getCreateChallengeErrorToast(
                        "O adversário já atingiu o limite de desafios ativos."
                      )
                    );
                    return;
                  }

                  setCreateChallengeTarget({
                    membershipId: item.id,
                    name: item.name,
                  });
                  setActiveTab("challenges");
                }}
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

        {isChallengesTabActive ? (
          <Page.View className="flex-1 bg-background">
            <Tabs.Content className="flex-1 px-4" value="challenges">
              <Challenges
                canManage={isManagerOwner}
                challenges={challengesQuery.data ?? []}
                challengeValidationMode={
                  league.ruleConfig.challengeValidationMode
                }
                courts={league.courts}
                createTarget={createChallengeTarget}
                defaultDurationMinutes={
                  league.ruleConfig.matchConfig.defaultDurationMinutes
                }
                errorMessage={
                  challengesQuery.isError
                    ? challengesQuery.error.message
                    : undefined
                }
                isLoading={challengesQuery.isPending}
                isPending={
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
                  adminManageChallenge.isPending
                }
                occupiedSlots={occupiedSlotsQuery.data ?? []}
                onAccept={(challengeId) => {
                  acceptChallengeProposal.mutate({ challengeId });
                }}
                onAdminManage={async (input) => {
                  await adminManageChallenge.mutateAsync(input);
                }}
                onCancel={(challengeId) => {
                  cancelChallenge.mutate({ challengeId });
                }}
                onCloseCreateTarget={() => {
                  setCreateChallengeTarget(null);
                }}
                onConfirmResult={(challengeId) => {
                  confirmChallengeResult.mutate({ challengeId });
                }}
                onCounterPropose={async (input) => {
                  await counterProposeChallenge.mutateAsync(input);
                }}
                onCreate={async (input) => {
                  if (!leagueId) {
                    return;
                  }

                  await createChallenge.mutateAsync({
                    leagueId,
                    ...input,
                  });
                }}
                onDecline={(challengeId) => {
                  declineChallengeProposal.mutate({ challengeId });
                }}
                onRequestCancellation={(challengeId) => {
                  requestChallengeCancellation.mutate({ challengeId });
                }}
                onRespondCancellation={(input) => {
                  respondChallengeCancellation.mutate(input);
                }}
                onReviewChallenge={(input) => {
                  reviewChallenge.mutate(input);
                }}
                onReviewResult={(input) => {
                  reviewChallengeResult.mutate(input);
                }}
                onSubmitResult={async (input) => {
                  await submitChallengeResult.mutateAsync(input);
                }}
                resultValidationMode={league.ruleConfig.resultValidationMode}
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
