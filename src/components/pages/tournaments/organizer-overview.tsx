import { useValue } from "@legendapp/state/react";
import {
  Calendar03Icon,
  Target02Icon,
  UserGroup02Icon,
  VolleyballIcon,
} from "@hugeicons/core-free-icons";
import { View } from "react-native";

import { WidgetAlert } from "@/components/ui/widget-alert";
import { KpiCard } from "@/components/ui/kpi-card";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import {
  buildTournamentAwaitingPaymentAlert,
  buildTournamentCategoriesKpi,
  buildTournamentEntriesKpi,
  buildTournamentMatchesKpi,
  buildTournamentPendingApprovalAlert,
  buildTournamentPendingKpi,
} from "@/lib/tournaments/organizer-overview-derived";

/** Painel do organizador na overview do torneio (molde league OrganizerOverview). */
export function OrganizerOverview(props: { tournamentId: string }) {
  const bucket$ = getTournamentDetailsBucket$(props.tournamentId);
  const entries = useValue(bucket$.data.entries);
  const matches = useValue(bucket$.data.matches);
  const categoriesById = useValue(bucket$.derived.categoriesById);
  const entriesById = useValue(bucket$.derived.entriesById);

  const pendingApproval = buildTournamentPendingApprovalAlert({ entries });
  const awaitingPayment = buildTournamentAwaitingPaymentAlert({ entries });
  const confirmed = buildTournamentEntriesKpi({ entries });
  const pending = buildTournamentPendingKpi({ entries });
  const categories = buildTournamentCategoriesKpi({
    categories: Object.values(categoriesById),
  });
  const matchesWithSides = buildMatchSides({ entriesById, matches });
  const matchesKpi = buildTournamentMatchesKpi({ matches: matchesWithSides });

  return (
    <View className="gap-3">
      {pendingApproval ? (
        <WidgetAlert
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
          status="warning"
          title={`${awaitingPayment.total} ${
            awaitingPayment.total === 1
              ? "inscrição aguardando pagamento"
              : "inscrições aguardando pagamento"
          }`}
        />
      ) : null}

      <View className="flex-row gap-3">
        <KpiCard
          description="confirmadas"
          icon={UserGroup02Icon}
          label="Inscrições"
          value={`${confirmed.confirmedCount} ativas`}
        />
        <KpiCard
          description="aprovação, convite ou pagamento"
          icon={Target02Icon}
          label="Pendências"
          value={`${pending.pendingCount} pendentes`}
        />
      </View>

      <View className="flex-row gap-3">
        <KpiCard
          description="com chave própria"
          icon={VolleyballIcon}
          label="Categorias"
          value={`${categories.activeCount} ativas`}
        />
        {matchesKpi ? (
          <KpiCard
            description="concluídas na chave"
            icon={Calendar03Icon}
            label="Partidas"
            value={`${matchesKpi.finishedCount}/${matchesKpi.total}`}
          />
        ) : (
          <KpiCard
            description="disponível após o sorteio"
            icon={Calendar03Icon}
            label="Partidas"
            value="0"
          />
        )}
      </View>
    </View>
  );
}
