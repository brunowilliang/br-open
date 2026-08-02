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
  buildOrganizerActivityRateCard,
  buildOrganizerJoinRequestsAlert,
  buildOrganizerMonthlyMatchesCard,
  buildOrganizerOngoingChallengesCard,
  buildOrganizerOccupationCard,
  buildOrganizerValidationsAlert,
  summarizeOrganizerPendingActions,
} from "@/lib/leagues/organizer-overview-derived";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { formatCount } from "@/lib/format/pluralize";
import { KpiCard } from "@/components/ui/kpi-card";
import { WidgetAlert } from "./widget-alert";

export function OrganizerOverview() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const challenges = useValue(bucket$.data.challenges);
  const league = useValue(bucket$.data.league);
  const membershipOverview = useValue(bucket$.data.membershipOverview);

  const now = Date.now();
  const joinRequests = buildOrganizerJoinRequestsAlert({
    pendingRequestsCount: membershipOverview?.pendingRequests.length ?? 0,
  });
  const validations = buildOrganizerValidationsAlert({ challenges });
  const occupation = buildOrganizerOccupationCard({
    activeCount: membershipOverview?.ranking.length ?? 0,
    maxPlayers: league?.maxPlayers ?? null,
  });
  const monthlyMatches = buildOrganizerMonthlyMatchesCard({ challenges, now });
  const ongoing = buildOrganizerOngoingChallengesCard({ challenges });
  const activityRate = buildOrganizerActivityRateCard({
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
          description={summarizeOrganizerPendingActions(validations.actions)}
          status="warning"
          title={`${validations.total} ${
            validations.total === 1
              ? "item precisando de atenção"
              : "itens precisando de atenção"
          }`}
        />
      ) : null}

      <View className="flex-row gap-3">
        <KpiCard
          description={occupation.label}
          icon={UserGroup02Icon}
          label="Ocupação"
          value={formatCount(occupation.activeCount, "ativo", "ativos")}
        />
        <KpiCard
          description="disputadas este mês"
          icon={Calendar03Icon}
          label="Partidas"
          value={`${monthlyMatches.finishedCount} partidas`}
        />
      </View>

      <View className="flex-row gap-3">
        <KpiCard
          description="em andamento"
          icon={Target02Icon}
          label="Desafios"
          value={`${ongoing.ongoingCount} desafios`}
        />
        <KpiCard
          description="dos jogadores ativos jogaram este mês"
          icon={Activity01Icon}
          label="Atividade"
          value={`${activityPercent}%`}
        />
      </View>
    </View>
  );
}
