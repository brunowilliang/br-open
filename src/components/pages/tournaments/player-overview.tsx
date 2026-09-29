import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { useMemo } from "react";
import { View } from "react-native";

import { AgreementMatchCard } from "@/components/pages/tournaments/agreement-match-card";
import { useNegotiablePlayerMatches } from "@/components/pages/tournaments/match-agreement-provider";
import { PlayerMatchPanel } from "@/components/pages/tournaments/player-match-panel";
import { Text } from "@/components/core/text";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { resolveMatchFocus } from "@/lib/tournaments/match-focus";
import { selectNextPlayerMatch } from "@/lib/tournaments/player-overview-derived";
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
  /** Confronto que a url abriu (`matchId` do aviso): o ref que a página (dona
   * do scroll) mede para rolar até o card dele. */
  focusCardRef?: (node: View | null) => void;
  focusMatchId?: null | string;
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
  // Sem horário o confronto CONTA: o card desenha os dois lados, o chip sai "A
  // definir" e o menu do acerto traz "Propor horário".
  const nextMatch = selectNextPlayerMatch({
    matches: matchesWithSides,
    viewerEntryIds: tournament.viewerEntryIds,
  });
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

  // Divulgada a chave, o painel lista os confrontos do jogador que ainda dá
  // para combinar (`listMyMatches` só devolve com a chave solta).
  const myMatches = useNegotiablePlayerMatches(tournament.id);
  const showOwnMatch = tournament.bracketReleased && myMatches.length > 0;
  // O card de cima cobre o próximo confronto: o painel não repete o mesmo jogo.
  const nextMatchCardId =
    nextMatch && viewerSideEntry && opponentSideEntry
      ? nextMatch.id
      : undefined;
  const focus = resolveMatchFocus({
    focusMatchId: props.focusMatchId,
    nextMatchId: nextMatch?.id,
  });

  if (!nextMatch && pendings.length === 0 && !showOwnMatch) {
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

      {showOwnMatch ? (
        <PlayerMatchPanel
          excludeMatchId={nextMatchCardId}
          focusCardRef={props.focusCardRef}
          focusMatchId={focus.panelFocusMatchId}
          tournamentId={tournament.id}
        />
      ) : null}

      {nextMatch && viewerSideEntry && opponentSideEntry ? (
        <View
          className="gap-1"
          ref={focus.isNextMatchFocused ? props.focusCardRef : undefined}
        >
          <Text color="muted" variant="description" weight="medium">
            Próximo jogo
          </Text>
          {/* Card reutilizado das agendas (ui/match-card.tsx), mesmo molde
              de tournaments/[tournamentId]/schedule.tsx; o COMBINAR JOGO entra
              pelo `AgreementMatchCard` (o viewer é dono de um dos lados). */}
          <AgreementMatchCard
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
            matchId={nextMatch.id}
            matchStatus={nextMatch.status}
            sideOrder="viewer"
            stageLabel={formatBracketStage(nextMatch.round, nextMatchLastRound)}
            // Sem agendamento o minuto é null: o card não lê o número sem data
            // e quadra (o rodapé de horário não entra).
            startMinute={nextMatch.startMinute ?? 0}
            tournamentId={tournament.id}
          />
        </View>
      ) : null}
    </View>
  );
}
