import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { View } from "react-native";

import { KpiCard } from "@/components/ui/kpi-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { formatRateAsPercent } from "@/lib/format/percent";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildPlayerMonthlyWinLoss,
  buildPlayerPositionCard,
  buildPlayerWinRate,
} from "@/lib/leagues/player-overview-derived";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

/**
 * Casa da liga para o jogador: as pendências/alertas vêm do SERVIDOR
 * (`pendings.list` do escopo player, recortado para esta liga no bucket) e o
 * renderer único os desenha — os builders do cliente
 * (`buildLeaguePaymentAlert`, `buildPlayerPendingActionsAlert`,
 * `buildPlayerInactiveAlertCard`) foram EXTINTOS no cutover do PLN-0008. Os
 * KPIs "Posição", "Partidas no mês" e o desempenho em três seguem no KpiCard da
 * galeria (IBX-0075 r2).
 */
export function PlayerOverview(props: {
  league: LeagueOverview;
  /**
   * Invalidação do contexto da liga (passada pela página, dona do wiring de
   * dados): o alerta é genérico, quem conhece a liga é a tela.
   */
  onPendingActionPerformed?: () => void;
}) {
  const { league } = props;
  const bucket$ = getLeagueDetailsBucket$(league.id);
  const pendings = useValue(bucket$.derived.pendings);
  const pendingsStatus = useValue(bucket$.identity.pendingsStatus);
  const viewerMembershipId = useValue(bucket$.derived.viewerMembershipId);
  const viewerPosition = useValue(bucket$.derived.viewerPosition);
  const rankingItems = useValue(bucket$.derived.rankingItems);
  const challenges = useValue(bucket$.data.challenges);

  const now = Date.now();
  const position = buildPlayerPositionCard({
    rankingItemsCount: rankingItems.length,
    viewerPosition,
  });
  const monthlyWinLoss = buildPlayerMonthlyWinLoss({
    challenges,
    now,
    viewerMembershipId,
  });
  const currentMonth = monthlyWinLoss.at(-1);
  const matchesThisMonth = currentMonth
    ? currentMonth.wins + currentMonth.losses
    : 0;
  const winRate = buildPlayerWinRate({ challenges, viewerMembershipId });

  return (
    <View className="gap-3">
      {/* Pendências/alertas do SERVIDOR (IBX-0076 / PLN-0008): o recorte desta
          liga vem do bucket e a copy/ordem/rota são do item. */}
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      {/* KPIs (IBX-0075 r2): os três blocos de número no KpiCard da galeria
          (ui/kpi-card), rótulo+valor do molde texto-simples, emparelhados 2
          por linha na ordem ditada (Posição, Partidas no mês, Desempenho). */}
      <View className="flex-row gap-3">
        <KpiCard
          label="Posição"
          value={
            position === null
              ? "0"
              : `#${position.position} de ${position.totalPlayers}`
          }
        />
        <KpiCard label="Partidas no mês" value={String(matchesThisMonth)} />
      </View>

      {/* Desempenho = os três KPIs na MESMA linha (IBX-0075 r2), labels
          literais do pedido; o "%" fica no VALOR, o mesmo caminho da home. */}
      <View className="flex-row gap-3">
        <KpiCard label="Vitórias" value={String(winRate.wins)} />
        <KpiCard label="Derrotas" value={String(winRate.losses)} />
        <KpiCard
          label="Aproveitamento"
          value={formatRateAsPercent(winRate.rate)}
        />
      </View>
    </View>
  );
}
