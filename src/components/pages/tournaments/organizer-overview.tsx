import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { WidgetAlert } from "@/components/ui/widget-alert";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import {
  buildTournamentAwaitingPaymentAlert,
  buildTournamentEntriesKpi,
  buildTournamentMatchesKpi,
  buildTournamentPendingApprovalAlert,
} from "@/lib/tournaments/organizer-overview-derived";

/**
 * Casa do torneio para o organizador (plano de conteúdo IBX-0071): os
 * WidgetAlerts de pendência ficam; KPIs viram linhas de texto simples
 * (rótulo + valor) e os charts saíram. Receita soma `bySource` da série da
 * organização (query existente) filtrada pelas inscrições DESTE torneio no
 * cliente — nenhuma query nova.
 */
export function OrganizerOverview(props: { tournamentId: string }) {
  const router = useRouter();
  const crpc = useCRPC();
  const bucket$ = getTournamentDetailsBucket$(props.tournamentId);
  const entries = useValue(bucket$.data.entries);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);

  const pendingApproval = buildTournamentPendingApprovalAlert({ entries });
  const awaitingPayment = buildTournamentAwaitingPaymentAlert({ entries });
  const confirmed = buildTournamentEntriesKpi({ entries });
  const matchesWithSides = buildMatchSides({ entriesById, matches });
  const matchesKpi = buildTournamentMatchesKpi({ matches: matchesWithSides });

  const revenueSeriesQuery = useQuery(
    crpc.payment.dashboard.getRevenueSeries.staticQueryOptions({ months: 12 })
  );
  const entryIds = new Set(entries.map((entry) => entry.id));
  const tournamentRevenueCents = revenueSeriesQuery.data
    ? revenueSeriesQuery.data.bySource.reduce(
        (total, source) =>
          source.sourceType === "tournament_entry" &&
          entryIds.has(source.sourceId)
            ? total + source.totalCents
            : total,
        0
      )
    : 0;

  function handleSeeEntriesPress() {
    router.navigate({
      params: { initialTab: "pending", tournamentId: props.tournamentId },
      pathname: "/tournaments/[tournamentId]/entries",
    });
  }

  return (
    <View className="gap-3">
      {pendingApproval ? (
        <WidgetAlert
          action={{
            label: "Ver",
            onPress: handleSeeEntriesPress,
          }}
          status="accent"
          title={`${pendingApproval.total} ${
            pendingApproval.total === 1
              ? "inscrição aguardando aprovação"
              : "inscrições aguardando aprovação"
          }`}
        />
      ) : null}

      {awaitingPayment ? (
        <WidgetAlert
          action={{
            label: "Ver",
            onPress: handleSeeEntriesPress,
          }}
          status="warning"
          title={`${awaitingPayment.total} ${
            awaitingPayment.total === 1
              ? "inscrição aguardando pagamento"
              : "inscrições aguardando pagamento"
          }`}
        />
      ) : null}

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Receita do torneio
        </Text>
        <Text weight="semibold">
          {formatCurrencyCents(tournamentRevenueCents)}
        </Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Inscrições
        </Text>
        <Text weight="semibold">{`${confirmed.confirmedCount} ativas`}</Text>
      </View>

      <View className="gap-1">
        <Text color="muted" variant="description" weight="medium">
          Partidas
        </Text>
        <Text weight="semibold">
          {matchesKpi ? `${matchesKpi.finishedCount}/${matchesKpi.total}` : "0"}
        </Text>
      </View>
    </View>
  );
}
