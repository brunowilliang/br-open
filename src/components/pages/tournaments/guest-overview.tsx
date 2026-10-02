import { TournamentOverviewTabs } from "@/components/pages/tournaments/tournament-overview-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { TournamentPhaseBand } from "@/components/ui/tournament-phase-band";
import {
  buildTournamentDatesKpi,
  buildTournamentDeadlineKpi,
  buildTournamentPhaseLine,
} from "@/lib/tournaments/tournament-details-derived";
import type { ApiOutputs } from "@convex/shared/api";
import { View } from "react-native";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

/** Visitante: a faixa de fase abre a casa, seguida dos KPIs de data (torneio e
 * inscrições); o resto fica nas mesmas abas dos outros papéis. */
export function GuestOverview(props: { tournament: TournamentOverview }) {
  const datesKpi = buildTournamentDatesKpi({
    endDate: props.tournament.endDate,
    startDate: props.tournament.startDate,
  });
  const deadlineKpi = buildTournamentDeadlineKpi(
    props.tournament.registrationDeadlineAt
  );
  const phaseLine = buildTournamentPhaseLine({
    bracketReleaseAt: props.tournament.bracketReleaseAt,
    bracketReleased: props.tournament.bracketReleased,
    endDate: props.tournament.endDate,
    now: Date.now(),
    registrationDeadlineAt: props.tournament.registrationDeadlineAt,
    status: props.tournament.status,
  });

  return (
    <View className="gap-3 px-4 pt-4">
      <TournamentPhaseBand phaseLine={phaseLine} />

      {datesKpi || deadlineKpi ? (
        <View className="flex-row">
          {datesKpi ? (
            <View className={deadlineKpi ? "w-1/2 pr-1.5" : "flex-1"}>
              <KpiCard label="Datas do torneio" value={datesKpi} />
            </View>
          ) : null}
          {deadlineKpi ? (
            <View className={datesKpi ? "w-1/2 pl-1.5" : "flex-1"}>
              <KpiCard label="Inscrições" value={deadlineKpi} />
            </View>
          ) : null}
        </View>
      ) : null}

      <TournamentOverviewTabs description={props.tournament.description} />
    </View>
  );
}
