import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { KpiCard } from "@/components/ui/kpi-card";
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
 * Casa do torneio para o organizador: os WidgetAlerts de pendência das
 * inscrições (IBX-0071) e os três blocos de número (Receita do torneio,
 * Inscrições, Partidas) no KpiCard da galeria (IBX-0075 r2), com o
 * rótulo+valor do molde texto-simples. A receita soma `bySource` da série da
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

      {/* KPIs (IBX-0075 r2): os três blocos de número no KpiCard da galeria
          (ui/kpi-card), rótulo+valor idênticos ao texto-simples, emparelhados
          2 por linha na ordem ditada (Receita, Inscrições, Partidas). Linha
          `flex-row gap-3` = molde dos dashboards (KpiCard com flex-1). */}
      <View className="flex-row gap-3">
        <KpiCard
          label="Receita do torneio"
          value={formatCurrencyCents(tournamentRevenueCents)}
        />
        <KpiCard
          label="Inscrições"
          value={`${confirmed.confirmedCount} ativas`}
        />
      </View>

      <View className="flex-row gap-3">
        <KpiCard
          label="Partidas"
          value={
            matchesKpi ? `${matchesKpi.finishedCount}/${matchesKpi.total}` : "0"
          }
        />
      </View>
    </View>
  );
}
