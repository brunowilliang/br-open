import { useValue } from "@legendapp/state/react";
import { useCallback } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import {
  buildPlayerAgreementCard,
  useMatchAgreement,
  useNegotiablePlayerMatches,
  type RunMatchCardAgreementAction,
} from "@/components/pages/tournaments/match-agreement-provider";
import { MatchCard } from "@/components/ui/match-card";
import type { Court } from "@convex/domains/match/contract";
import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";
import { MATCH_AGREEMENT_COPY } from "@/lib/tournaments/match-agreement-copy";
import {
  isMatchAgreementLocked,
  type PlayerMatch,
} from "@/lib/tournaments/match-agreement-view";
import {
  formatBracketStage,
  formatEntryPlayerNames,
  isDoublesEntry,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

type PlayerMatchPanelProps = {
  /** Confronto que o card de cima ("Próximo jogo") já desenha: sai do painel. */
  excludeMatchId?: null | string;
  tournamentId: string;
  /** Confronto que a url abriu (`matchId` do aviso): o ref que a página (dona
   * do scroll) mede para rolar até o card dele. */
  focusCardRef?: (node: View | null) => void;
  focusMatchId?: null | string;
};

/**
 * Confronto do PRÓPRIO jogador na tela do torneio: adversário, quadra, horário,
 * status e o menu do COMBINAR JOGO. Usa a porta `listMyMatches` (uma porta por
 * jogador, não a chave inteira) e não desenha nada quando não há o que combinar.
 */
export function PlayerMatchPanel(props: PlayerMatchPanelProps) {
  const { tournamentId } = props;
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const tournament = useValue(bucket$.data.tournament);
  const entriesById = useValue(bucket$.derived.entriesById);
  const { runAction } = useMatchAgreement();
  const matches = useNegotiablePlayerMatches(tournamentId).filter(
    (playerMatch) => playerMatch.match.id !== props.excludeMatchId
  );
  const runAgreementAction = useCallback<RunMatchCardAgreementAction>(
    (request) => {
      runAction({ ...request, tournamentId });
    },
    [runAction, tournamentId]
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      <Text color="muted" variant="description" weight="medium">
        {MATCH_AGREEMENT_COPY.panelTitle}
      </Text>
      {matches.map((playerMatch) => (
        <View
          key={playerMatch.match.id}
          ref={
            props.focusMatchId === playerMatch.match.id
              ? props.focusCardRef
              : undefined
          }
        >
          <PlayerPanelCard
            entriesById={entriesById}
            playerMatch={playerMatch}
            runAction={runAgreementAction}
            tournamentCourts={tournament?.courts ?? []}
            tournamentStatus={tournament?.status ?? null}
          />
        </View>
      ))}
    </View>
  );
}

type PlayerPanelCardProps = {
  entriesById: Record<string, TournamentEntryWithPlayers>;
  playerMatch: PlayerMatch;
  runAction: RunMatchCardAgreementAction;
  tournamentCourts: Court[];
  tournamentStatus: null | string;
};

function PlayerPanelCard(props: PlayerPanelCardProps) {
  const { playerMatch } = props;
  const entryA = props.entriesById[playerMatch.match.entryAId ?? ""] ?? null;
  const entryB = props.entriesById[playerMatch.match.entryBId ?? ""] ?? null;
  const viewerEntry = playerMatch.mySide === "a" ? entryA : entryB;
  const opponentEntry = playerMatch.mySide === "a" ? entryB : entryA;
  const viewerNames = formatEntryPlayerNames(viewerEntry);
  const opponentNames = formatEntryPlayerNames(opponentEntry);
  const courtName =
    props.tournamentCourts.find(
      (court) => court.id === playerMatch.match.courtId
    )?.name ?? "";
  const agreement = buildPlayerAgreementCard({
    courts: props.tournamentCourts,
    isMatchLocked: isMatchAgreementLocked({
      matchStatus: playerMatch.match.status,
      tournamentStatus: props.tournamentStatus,
      winnerEntryId: playerMatch.match.winnerEntryId,
    }),
    playerMatch,
    runAction: props.runAction,
    sideOrder: "viewer",
    tournamentStatus: props.tournamentStatus,
  });

  return (
    <MatchCard
      agreement={agreement}
      challengedAvatarUrl={opponentEntry?.playerA?.avatarUrl ?? null}
      challengedName={opponentNames[0]}
      challengedPartnerAvatarUrl={opponentEntry?.playerB?.avatarUrl ?? null}
      challengedPartnerName={opponentNames[1] ?? null}
      challengerAvatarUrl={viewerEntry?.playerA?.avatarUrl ?? null}
      challengerName={viewerNames[0]}
      challengerPartnerAvatarUrl={viewerEntry?.playerB?.avatarUrl ?? null}
      challengerPartnerName={viewerNames[1] ?? null}
      courtName={courtName}
      matchDate={playerMatch.match.matchDate}
      matchStatus={playerMatch.match.status}
      modality={
        viewerEntry && isDoublesEntry(viewerEntry) ? "doubles" : "singles"
      }
      stageLabel={formatBracketStage(
        playerMatch.match.round,
        playerMatch.totalRounds
      )}
      startMinute={playerMatch.match.startMinute ?? 0}
    />
  );
}
