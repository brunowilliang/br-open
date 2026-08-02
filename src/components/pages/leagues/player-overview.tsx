import type { ApiOutputs } from "@convex/shared/api";
import {
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Medal01Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { View } from "react-native";

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
import { WidgetAlert } from "./widget-alert";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

export function PlayerOverview(props: { league: LeagueOverview }) {
  const { league } = props;
  const bucket$ = getLeagueDetailsBucket$(league.id);
  const viewerMembershipId = useValue(bucket$.derived.viewerMembershipId);
  const viewerPosition = useValue(bucket$.derived.viewerPosition);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const challenges = useValue(bucket$.data.challenges);

  const now = Date.now();
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

  return (
    <View className="gap-3">
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
      `${counts.register_result} placar ${
        counts.register_result === 1 ? "para registrar" : "para registrar"
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
          ? "placar para corrigir"
          : "placares para corrigir"
      }`
    );
  }

  return parts.join(" · ");
}
