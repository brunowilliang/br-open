import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useToast } from "heroui-native";
import { View } from "react-native";

import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatRateAsPercent } from "@/lib/format/percent";
import { buildLeaguePaymentAlert } from "@/lib/leagues/league-details-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildPlayerInactiveAlertCard,
  buildPlayerMonthlyWinLoss,
  buildPlayerPendingActionsAlert,
  buildPlayerPositionCard,
  buildPlayerWinRate,
} from "@/lib/leagues/player-overview-derived";
import { KpiCard } from "@/components/ui/kpi-card";
import { WidgetAlert } from "@/components/ui/widget-alert";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

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

/**
 * Casa da liga para o jogador: os três WidgetAlerts de pendência/ação
 * (IBX-0071) e os blocos de número no KpiCard da galeria (IBX-0075 r2) —
 * "Posição", "Partidas no mês" e o desempenho em três ("Vitórias",
 * "Derrotas" e "Aproveitamento", taxa do derived `PlayerWinRate`).
 * RadialChart, BarChart, feed de última partida e CTAs saíram.
 */
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
  const monthlyWinLoss = buildPlayerMonthlyWinLoss({
    challenges,
    now,
    viewerMembershipId,
  });
  const currentMonth = monthlyWinLoss.at(-1);
  const matchesThisMonth = currentMonth
    ? currentMonth.wins + currentMonth.losses
    : 0;
  const winRate = buildPlayerWinRate({ challenges, viewerMembershipId });

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

      {/* KPIs (IBX-0075 r2): os três blocos de número no KpiCard da galeria
          (ui/kpi-card), rótulo+valor do molde texto-simples, emparelhados 2
          por linha na ordem ditada (Posição, Partidas no mês, Desempenho). */}
      <View className="flex-row gap-3">
        <KpiCard
          label="Posição"
          value={
            position ? `#${position.position} de ${position.totalPlayers}` : "0"
          }
        />
        <KpiCard label="Partidas no mês" value={String(matchesThisMonth)} />
      </View>

      {/* Desempenho = os três KPIs na MESMA linha (IBX-0075 r2), labels
          literais do pedido; o "%" fica no VALOR, o mesmo caminho da home. */}
      <View className="flex-row gap-3">
        <KpiCard label="Vitórias" value={String(winRate.wins)} />
        <KpiCard label="Derrotas" value={String(winRate.losses)} />
        <KpiCard
          label="Aproveitamento"
          value={formatRateAsPercent(winRate.rate)}
        />
      </View>
    </View>
  );
}
