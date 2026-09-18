import type { ApiOutputs } from "@convex/shared/api";
import {
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Medal01Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useToast } from "heroui-native";
import { View } from "react-native";

import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { buildLeaguePaymentAlert } from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildPlayerInactiveAlertCard,
  buildPlayerLastMatchCard,
  buildPlayerMonthlyChallengesCard,
  buildPlayerMonthlyMatchesCard,
  buildPlayerPendingActionsAlert,
  buildPlayerPositionCard,
} from "@/lib/leagues/player-overview-derived";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCount } from "@/lib/format/pluralize";
import { WidgetAlert } from "@/components/ui/widget-alert";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

export function PlayerOverview(props: { league: LeagueOverview }) {
  const { league } = props;
  const bucket$ = getLeagueDetailsBucket$(league.id);
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const membershipId = useValue(bucket$.viewer.membershipId);
  const viewerMembershipId = useValue(bucket$.derived.viewerMembershipId);
  const viewerPosition = useValue(bucket$.derived.viewerPosition);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const challenges = useValue(bucket$.data.challenges);

  const now = Date.now();
  const paymentAlert = buildLeaguePaymentAlert({
    dueAt: league.viewerMembershipDueAt,
    now,
    reminderDaysBefore: league.reminderDaysBefore,
    status: league.viewerMembershipStatus,
  });
  const inactiveAlert = buildPlayerInactiveAlertCard({
    challenges,
    now,
    ruleConfig: league.ruleConfig,
    viewerMembershipId,
  });
  const pendingActions = buildPlayerPendingActionsAlert({
    challenges,
    viewerMembershipId,
  });
  const position = buildPlayerPositionCard({
    rankingItemsCount: rankingItems.length,
    viewerPosition,
  });
  const monthlyMatches = buildPlayerMonthlyMatchesCard({
    challenges,
    now,
    viewerMembershipId,
  });
  const lastMatch = buildPlayerLastMatchCard({
    challenges,
    now,
    viewerMembershipId,
  });
  const monthlyChallenges = buildPlayerMonthlyChallengesCard({
    challenges,
    now,
    ruleConfig: league.ruleConfig,
    viewerMembershipId,
  });

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível gerar o código de pagamento. Tente novamente."
        ),
        id: "create-charge-error",
        label: "Falha ao gerar PIX",
        variant: "danger",
      });
    },
    onSuccess: (result) => {
      router.navigate({
        params: { chargeId: result.chargeId },
        pathname: "/checkout/[chargeId]",
      });
    },
  });

  return (
    <View className="gap-3">
      {paymentAlert ? (
        <WidgetAlert
          action={
            paymentAlert.actionLabel && membershipId
              ? {
                  isDisabled: createCharge.isPending,
                  label: paymentAlert.actionLabel,
                  onPress: () => {
                    createCharge.mutate({
                      sourceId: membershipId,
                      sourceType: "league_membership",
                    });
                  },
                }
              : undefined
          }
          description={paymentAlert.description}
          status={paymentAlert.severity}
          title={paymentAlert.title}
        />
      ) : null}

      {inactiveAlert ? (
        <WidgetAlert
          description={
            inactiveAlert.severity === "danger"
              ? `Já se passaram ${inactiveAlert.daysSinceLastMatch} dias desde sua última partida.`
              : `Faltam ${inactiveAlert.daysUntilPenalty} dias para você cair no ranking.`
          }
          status={inactiveAlert.severity === "danger" ? "danger" : "warning"}
          title={
            inactiveAlert.severity === "danger"
              ? "Você está inativo"
              : "Risco de queda por inatividade"
          }
        />
      ) : null}

      {pendingActions ? (
        <WidgetAlert
          description={summarizePendingActions(pendingActions.actions)}
          status="warning"
          title={`${pendingActions.total} ${
            pendingActions.total === 1
              ? "desafio precisando de atenção"
              : "desafios precisando de atenção"
          }`}
        />
      ) : null}

      <View className="flex-row gap-3">
        {position ? (
          <KpiCard
            description={`de ${formatCount(position.totalPlayers, "jogador", "jogadores")}`}
            icon={Medal01Icon}
            label="Posição"
            value={`#${position.position}º lugar`}
          />
        ) : null}
        {monthlyMatches ? (
          <KpiCard
            description="disputadas este mês"
            icon={Calendar03Icon}
            label="Partidas"
            value={`${monthlyMatches.finishedCount} partidas`}
          />
        ) : null}
      </View>

      <View className="flex-row gap-3">
        {lastMatch ? (
          <KpiCard
            description={`${lastMatch.scoreSummary} · ${lastMatch.whenLabel}`}
            icon={lastMatch.isWin ? CheckmarkCircle02Icon : Cancel01Icon}
            label="Última partida"
            value={`${lastMatch.isWin ? "Vitória" : "Derrota"} · ${lastMatch.opponentName}`}
          />
        ) : null}
        {monthlyChallenges ? (
          <KpiCard
            icon={Target02Icon}
            label="Desafios no mês"
            value={
              monthlyChallenges.max === null
                ? "Sem limite mensal"
                : `${monthlyChallenges.createdCount}/${monthlyChallenges.max} criados`
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function summarizePendingActions(actions: { kind: string }[]): string {
  const counts = {
    confirm_result: 0,
    register_result: 0,
    request_correction: 0,
  };

  for (const action of actions) {
    if (action.kind in counts) {
      counts[action.kind as keyof typeof counts] += 1;
    }
  }

  const parts: string[] = [];

  if (counts.register_result > 0) {
    parts.push(
      `${counts.register_result} ${
        counts.register_result === 1
          ? "resultado para registrar"
          : "resultados para registrar"
      }`
    );
  }

  if (counts.confirm_result > 0) {
    parts.push(
      `${counts.confirm_result} ${
        counts.confirm_result === 1
          ? "resultado para confirmar"
          : "resultados para confirmar"
      }`
    );
  }

  if (counts.request_correction > 0) {
    parts.push(
      `${counts.request_correction} ${
        counts.request_correction === 1
          ? "resultado para corrigir"
          : "resultados para corrigir"
      }`
    );
  }

  return parts.join(" · ");
}
