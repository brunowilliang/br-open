import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { TournamentOverviewTabs } from "@/components/pages/tournaments/tournament-overview-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { TournamentPhaseBand } from "@/components/ui/tournament-phase-band";
import { useCRPC } from "@/lib/convex/crpc";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import {
  buildTournamentEntriesKpi,
  buildTournamentMatchesKpi,
} from "@/lib/tournaments/organizer-overview-derived";
import {
  buildTournamentDatesKpi,
  buildTournamentDeadlineKpi,
  buildTournamentPhaseLine,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

export function OrganizerOverview(props: {
  onPendingActionPerformed?: () => void;
  tournamentId: string;
}) {
  const crpc = useCRPC();
  const router = useRouter();
  const bucket$ = getTournamentDetailsBucket$(props.tournamentId);
  const tournament = useValue(bucket$.data.tournament);
  const entries = useValue(bucket$.data.entries);
  const entriesById = useValue(bucket$.derived.entriesById);
  const entriesLoading = useValue(bucket$.identity.entriesLoading);
  const matches = useValue(bucket$.data.matches);
  const matchesLoading = useValue(bucket$.identity.matchesLoading);
  const pendings = useValue(bucket$.derived.pendings);
  const pendingsStatus = useValue(bucket$.identity.pendingsStatus);

  const confirmed = buildTournamentEntriesKpi({ entries });
  const datesKpi = tournament
    ? buildTournamentDatesKpi({
        endDate: tournament.endDate,
        startDate: tournament.startDate,
      })
    : null;
  const deadlineKpi = tournament
    ? buildTournamentDeadlineKpi(tournament.registrationDeadlineAt)
    : null;
  const phaseLine = tournament
    ? buildTournamentPhaseLine({
        bracketReleaseAt: tournament.bracketReleaseAt,
        bracketReleased: tournament.bracketReleased,
        endDate: tournament.endDate,
        now: Date.now(),
        registrationDeadlineAt: tournament.registrationDeadlineAt,
        status: tournament.status,
      })
    : null;
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
    <View className="gap-3 px-4 pt-4">
      <TournamentPhaseBand phaseLine={phaseLine} />

      {/* Pendências/alertas do SERVIDOR: o recorte deste torneio vem do bucket;
          o `Ver` do item navega para a aba de pendências das inscrições. */}
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      <TournamentOverviewTabs
        description={tournament?.description ?? ""}
        overview={
          <View className="gap-3">
            <View className="flex-row">
              {datesKpi ? (
                <View className={deadlineKpi ? "w-1/2 pr-1.5" : "flex-1"}>
                  <KpiCard label="Datas do torneio" value={datesKpi} />
                </View>
              ) : null}
              {deadlineKpi ? (
                <View className={datesKpi ? "w-1/2 pl-1.5" : "flex-1"}>
                  <KpiCard label="Prazo de inscrição" value={deadlineKpi} />
                </View>
              ) : null}
            </View>

            <KpiCard
              isLoading={revenueSeriesQuery.isPending || entriesLoading}
              label="Receita do torneio"
              value={formatCurrencyCents(tournamentRevenueCents)}
            />

            <View className="flex-row">
              {matchesKpi ? (
                <View className="w-1/2 pr-1.5">
                  {/* "Partidas" lê entries (lados) e matches: o valor espera os
                      dois; sem jogo a linha nem monta e "Inscrições" fica
                      sozinha, inteira. */}
                  <KpiCard
                    isLoading={entriesLoading || matchesLoading}
                    label="Partidas"
                    value={`${matchesKpi.finishedCount}/${matchesKpi.total}`}
                  />
                </View>
              ) : null}
              <View className={matchesKpi ? "w-1/2 pl-1.5" : "flex-1"}>
                <KpiCard
                  isLoading={entriesLoading}
                  label="Inscrições"
                  onPress={() => {
                    router.navigate({
                      params: { tournamentId: props.tournamentId },
                      pathname: "/tournaments/[tournamentId]/entries",
                    });
                  }}
                  value={`${confirmed.confirmedCount} ${
                    confirmed.confirmedCount === 1 ? "ativa" : "ativas"
                  }`}
                />
              </View>
            </View>
          </View>
        }
      />
    </View>
  );
}
