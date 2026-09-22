import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";

import { KpiCard } from "@/components/ui/kpi-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import {
  buildTournamentEntriesKpi,
  buildTournamentMatchesKpi,
} from "@/lib/tournaments/organizer-overview-derived";

export function OrganizerOverview(props: {
  onPendingActionPerformed?: () => void;
  tournamentId: string;
}) {
  const crpc = useCRPC();
  const bucket$ = getTournamentDetailsBucket$(props.tournamentId);
  const entries = useValue(bucket$.data.entries);
  const entriesById = useValue(bucket$.derived.entriesById);
  const entriesLoading = useValue(bucket$.identity.entriesLoading);
  const matches = useValue(bucket$.data.matches);
  const matchesLoading = useValue(bucket$.identity.matchesLoading);
  const pendings = useValue(bucket$.derived.pendings);
  const pendingsStatus = useValue(bucket$.identity.pendingsStatus);

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

  return (
    <View className="gap-3">
      {/* Pendências/alertas do SERVIDOR (IBX-0076 / PLN-0008): o recorte deste
          torneio vem do bucket; o `Ver` do item navega para a aba de
          pendências das inscrições. */}
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      {/* KPIs (IBX-0075 r2): os três blocos de número no KpiCard da galeria
          (ui/kpi-card), rótulo+valor idênticos ao texto-simples, emparelhados
          2 por linha na ordem ditada (Receita, Inscrições, Partidas). Linha
          `flex-row gap-3` = molde dos dashboards (KpiCard com flex-1). */}
      <View className="flex-row gap-3">
        <KpiCard
          isLoading={revenueSeriesQuery.isPending || entriesLoading}
          label="Receita do torneio"
          value={formatCurrencyCents(tournamentRevenueCents)}
        />
        <KpiCard
          isLoading={entriesLoading}
          label="Inscrições"
          value={`${confirmed.confirmedCount} ativas`}
        />
      </View>

      <View className="flex-row gap-3">
        {/* "Partidas" lê entries (lados) e matches: o valor espera os dois. */}
        <KpiCard
          isLoading={entriesLoading || matchesLoading}
          label="Partidas"
          value={
            matchesKpi ? `${matchesKpi.finishedCount}/${matchesKpi.total}` : "0"
          }
        />
      </View>
    </View>
  );
}
