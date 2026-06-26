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
  buildParticipantInactiveAlertCard,
  buildParticipantLastMatchCard,
  buildParticipantMonthlyChallengesCard,
  buildParticipantMonthlyMatchesCard,
  buildParticipantPendingActionsAlert,
  buildParticipantPositionCard,
} from "@/lib/leagues/participant-overview-derived";
import { WidgetAlert } from "./widget-alert";
import { WidgetCard } from "./widget-card";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

export function ParticipantOverview(props: { league: LeagueOverview }) {
  const { league } = props;
  const bucket$ = getLeagueDetailsBucket$(league.id);
  const viewerMembershipId = useValue(bucket$.derived.viewerMembershipId);
  const viewerPosition = useValue(bucket$.derived.viewerPosition);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const challenges = useValue(bucket$.data.challenges);

  const now = Date.now();
  const inactiveAlert = buildParticipantInactiveAlertCard({
    challenges,
    now,
    ruleConfig: league.ruleConfig,
    viewerMembershipId,
  });
  const pendingActions = buildParticipantPendingActionsAlert({
    challenges,
    viewerMembershipId,
  });
  const position = buildParticipantPositionCard({
    rankingItemsCount: rankingItems.length,
    viewerPosition,
  });
  const monthlyMatches = buildParticipantMonthlyMatchesCard({
    challenges,
    now,
    viewerMembershipId,
  });
  const lastMatch = buildParticipantLastMatchCard({
    challenges,
    now,
    viewerMembershipId,
  });
  const monthlyChallenges = buildParticipantMonthlyChallengesCard({
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
          <WidgetCard
            className="flex-1"
            description={`de ${position.totalPlayers} jogadores`}
            icon={Medal01Icon}
            title={`#${position.position}º lugar`}
          />
        ) : null}
        {monthlyMatches ? (
          <WidgetCard
            className="flex-1"
            description="disputadas este mês"
            icon={Calendar03Icon}
            title={`${monthlyMatches.finishedCount} partidas`}
          />
        ) : null}
      </View>

      <View className="flex-row gap-3">
        {lastMatch ? (
          <WidgetCard
            className="flex-1"
            description={`${lastMatch.scoreSummary} · ${lastMatch.whenLabel}`}
            icon={lastMatch.isWin ? CheckmarkCircle02Icon : Cancel01Icon}
            title={`${lastMatch.isWin ? "Vitória" : "Derrota"} · ${lastMatch.opponentName}`}
          />
        ) : null}
        {monthlyChallenges ? (
          <WidgetCard
            className="flex-1"
            description={
              monthlyChallenges.max === null
                ? "Sem limite mensal"
                : `${monthlyChallenges.createdCount}/${monthlyChallenges.max} criados`
            }
            icon={Target02Icon}
            title="Desafios no mês"
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
