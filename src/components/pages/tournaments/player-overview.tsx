import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { MatchCard } from "@/components/ui/match-card";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import {
  formatBracketStage,
  formatEntryPlayerNames,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

type TournamentOverview = ApiOutputs["tournament"]["discovery"]["getById"];

type PlayerOverviewProps = {
  /**
   * Invalidação do contexto do torneio (passada pela página, dona do wiring de
   * dados): o alerta é genérico, quem conhece o torneio é a tela.
   */
  onPendingActionPerformed?: () => void;
  tournament: TournamentOverview;
};

/** Casa do torneio para o jogador: alertas de pendência das PRÓPRIAS inscrições
 * e o "Próximo jogo" (`ui/match-card.tsx`). Derivado do que a página já carrega —
 * nenhuma query nova. As ações da própria inscrição (cancelar, responder convite
 * e pagar) vivem na aba Inscrições, não aqui. */
export function PlayerOverview(props: PlayerOverviewProps) {
  const { tournament } = props;
  const bucket$ = getTournamentDetailsBucket$(tournament.id);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const pendings = useValue(bucket$.derived.pendings);
  const pendingsStatus = useValue(bucket$.identity.pendingsStatus);

  const matchesWithSides = useMemo(
    () => buildMatchSides({ entriesById, matches }),
    [entriesById, matches]
  );
  const viewerEntryIds = new Set(tournament.viewerEntryIds);
  const nextMatch = matchesWithSides
    .filter(
      (match) =>
        match.status === "scheduled" &&
        match.matchDate !== null &&
        match.startMinute !== null &&
        ((match.entryAId !== null && viewerEntryIds.has(match.entryAId)) ||
          (match.entryBId !== null && viewerEntryIds.has(match.entryBId)))
    )
    .sort(
      (a, b) =>
        (a.matchDate ?? "").localeCompare(b.matchDate ?? "") ||
        (a.startMinute ?? 0) - (b.startMinute ?? 0)
    )[0];
  // Lados do próximo jogo no shape do card (ui/match-card.tsx): o lado do
  // viewer vai em "challenger" e o adversário em "challenged", mesmo molde de
  // tournaments/[tournamentId]/schedule.tsx.
  const viewerIsSideA =
    nextMatch !== undefined &&
    nextMatch.entryAId !== null &&
    viewerEntryIds.has(nextMatch.entryAId);
  const viewerSideEntry = nextMatch
    ? viewerIsSideA
      ? nextMatch.entryA
      : nextMatch.entryB
    : null;
  const opponentSideEntry = nextMatch
    ? viewerIsSideA
      ? nextMatch.entryB
      : nextMatch.entryA
    : null;
  const viewerSideNames = formatEntryPlayerNames(viewerSideEntry);
  const opponentSideNames = formatEntryPlayerNames(opponentSideEntry);
  const nextMatchCourtName = nextMatch?.courtId
    ? (tournament.courts.find((court) => court.id === nextMatch.courtId)
        ?.name ?? "")
    : "";
  // A última rodada da categoria dá o nome do estágio (o quadro da chave).
  const nextMatchLastRound = Math.max(
    ...matchesWithSides
      .filter((match) => match.categoryId === nextMatch?.categoryId)
      .map((match) => match.round)
  );

  if (!nextMatch && pendings.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      {/* Pendências/alertas do SERVIDOR: o recorte deste torneio vem do bucket e
          a copy/ordem/rota são do item. */}
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      {nextMatch &&
      nextMatch.matchDate !== null &&
      nextMatch.startMinute !== null &&
      viewerSideEntry &&
      opponentSideEntry ? (
        <View className="gap-1">
          <Text color="muted" variant="description" weight="medium">
            Próximo jogo
          </Text>
          {/* Card reutilizado das agendas (ui/match-card.tsx), mesmo molde
              de tournaments/[tournamentId]/schedule.tsx. */}
          <MatchCard
            challengedAvatarUrl={opponentSideEntry.playerA?.avatarUrl ?? null}
            challengedName={opponentSideNames[0]}
            challengedPartnerAvatarUrl={
              opponentSideEntry.playerB?.avatarUrl ?? null
            }
            challengedPartnerName={opponentSideNames[1] ?? null}
            challengerAvatarUrl={viewerSideEntry.playerA?.avatarUrl ?? null}
            challengerName={viewerSideNames[0]}
            challengerPartnerAvatarUrl={
              viewerSideEntry.playerB?.avatarUrl ?? null
            }
            challengerPartnerName={viewerSideNames[1] ?? null}
            courtName={nextMatchCourtName}
            matchDate={nextMatch.matchDate}
            matchStatus={nextMatch.status}
            stageLabel={formatBracketStage(nextMatch.round, nextMatchLastRound)}
            startMinute={nextMatch.startMinute}
          />
        </View>
      ) : null}
    </View>
  );
}
