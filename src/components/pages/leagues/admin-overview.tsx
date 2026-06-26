import {
  Activity01Icon,
  Calendar03Icon,
  Target02Icon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import {
  buildAdminActivityRateCard,
  buildAdminJoinRequestsAlert,
  buildAdminMonthlyMatchesCard,
  buildAdminOngoingChallengesCard,
  buildAdminOccupationCard,
  buildAdminValidationsAlert,
  summarizeAdminPendingActions,
} from "@/lib/leagues/admin-overview-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { WidgetAlert } from "./widget-alert";
import { WidgetCard } from "./widget-card";

export function AdminOverview() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const challenges = useValue(bucket$.data.challenges);
  const league = useValue(bucket$.data.league);
  const membershipOverview = useValue(bucket$.data.membershipOverview);

  const now = Date.now();
  const joinRequests = buildAdminJoinRequestsAlert({
    pendingRequestsCount: membershipOverview?.pendingRequests.length ?? 0,
  });
  const validations = buildAdminValidationsAlert({ challenges });
  const occupation = buildAdminOccupationCard({
    activeCount: membershipOverview?.ranking.length ?? 0,
    maxPlayers: league?.maxPlayers ?? null,
  });
  const monthlyMatches = buildAdminMonthlyMatchesCard({ challenges, now });
  const ongoing = buildAdminOngoingChallengesCard({ challenges });
  const activityRate = buildAdminActivityRateCard({
    challenges,
    now,
    ranking: membershipOverview?.ranking ?? [],
  });

  const activityPercent = Math.round(activityRate.rate * 100);

  return (
    <View className="gap-3">
      {joinRequests ? (
        <WidgetAlert
          status="accent"
          title={`${joinRequests.total} ${
            joinRequests.total === 1
              ? "jogador aguardando aprovação"
              : "jogadores aguardando aprovação"
          }`}
        />
      ) : null}

      {validations ? (
        <WidgetAlert
          description={summarizeAdminPendingActions(validations.actions)}
          status="warning"
          title={`${validations.total} ${
            validations.total === 1
              ? "item precisando de atenção"
              : "itens precisando de atenção"
          }`}
        />
      ) : null}

      <View className="flex-row gap-3">
        <WidgetCard
          className="flex-1"
          description={occupation.label}
          icon={UserGroup02Icon}
          title={`${occupation.activeCount} ativos`}
        />
        <WidgetCard
          className="flex-1"
          description="disputadas este mês"
          icon={Calendar03Icon}
          title={`${monthlyMatches.finishedCount} partidas`}
        />
      </View>

      <View className="flex-row gap-3">
        <WidgetCard
          className="flex-1"
          description="em andamento"
          icon={Target02Icon}
          title={`${ongoing.ongoingCount} desafios`}
        />
        <WidgetCard
          className="flex-1"
          description="dos jogadores ativos jogaram este mês"
          icon={Activity01Icon}
          title={`${activityPercent}%`}
        />
      </View>
    </View>
  );
}
