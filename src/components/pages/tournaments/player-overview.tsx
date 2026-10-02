import type { TournamentEntryWithPlayers } from "@convex/domains/tournament/contract";
import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { Chip } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { AgreementMatchCard } from "@/components/pages/tournaments/agreement-match-card";
import { useNegotiablePlayerMatches } from "@/components/pages/tournaments/match-agreement-provider";
import { TournamentOverviewTabs } from "@/components/pages/tournaments/tournament-overview-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { TournamentPhaseBand } from "@/components/ui/tournament-phase-band";
import {
  buildMatchSides,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import { resolveMatchFocus } from "@/lib/tournaments/match-focus";
import { selectPlayerNextMatches } from "@/lib/tournaments/player-overview-derived";
import {
  buildTournamentDatesKpi,
  buildTournamentDeadlineKpi,
  buildTournamentEntryStatusKpi,
  buildTournamentPhaseLine,
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

/** Casa do torneio para o jogador: a faixa de fase e os alertas ficam acima
 * das abas; a "Visão geral" traz os KPIs de data, os KPIs de status e de suas
 * inscrições (o card abre a aba Inscrições) e a fila "Próximos
 * jogos" — cada card já entrega a pendência do jogo (chip e menu do acerto);
 * Informações/Regulamento/Premiação são as mesmas das outras casas. Derivado
 * do que a página já carrega — nenhuma query nova; as ações da inscrição
 * (cancelar, responder convite e pagar) vivem na aba Inscrições. */
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
  // Divulgada a chave, a porta do acerto traz a leitura de cada jogo: é ela que
  // sabe qual pendência está com o viewer e ordena a fila.
  const playerMatches = useNegotiablePlayerMatches(tournament.id);
  const nextMatches = selectPlayerNextMatches({
    matches: matchesWithSides,
    playerMatches,
    viewerEntryIds: tournament.viewerEntryIds,
  });
  const focus = resolveMatchFocus({
    focusMatchId: props.focusMatchId,
    nextMatchId: nextMatches[0]?.id,
  });
  const focusedMatchId = focus.isNextMatchFocused
    ? (nextMatches[0]?.id ?? null)
    : focus.listFocusMatchId;
  // A última rodada da categoria dá o nome do estágio (o quadro da chave).
  const lastRoundByCategory = useMemo(() => {
    const lastRounds: Record<string, number> = {};

    for (const match of matchesWithSides) {
      lastRounds[match.categoryId] = Math.max(
        lastRounds[match.categoryId] ?? 0,
        match.round
      );
    }

    return lastRounds;
  }, [matchesWithSides]);

  const viewerEntries = tournament.viewerEntryIds
    .map((entryId) => entriesById[entryId])
    .filter(
      (entry): entry is TournamentEntryWithPlayers => entry !== undefined
    );

  const phaseLine = buildTournamentPhaseLine({
    bracketReleaseAt: tournament.bracketReleaseAt,
    bracketReleased: tournament.bracketReleased,
    endDate: tournament.endDate,
    now: Date.now(),
    registrationDeadlineAt: tournament.registrationDeadlineAt,
    status: tournament.status,
  });

  return (
    <View className="gap-3 px-4 pt-4">
      <TournamentPhaseBand phaseLine={phaseLine} />

      {/* Pendências/alertas do SERVIDOR: o recorte deste torneio vem do bucket e
          a copy/ordem/rota são do item. */}
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      <TournamentOverviewTabs
        description={tournament.description}
        overview={
          <PlayerOverviewTab
            endDate={tournament.endDate}
            entries={viewerEntries}
            focusCardRef={props.focusCardRef}
            focusedMatchId={focusedMatchId}
            lastRoundByCategory={lastRoundByCategory}
            nextMatches={nextMatches}
            registrationDeadlineAt={tournament.registrationDeadlineAt}
            startDate={tournament.startDate}
            tournament={tournament}
          />
        }
      />
    </View>
  );
}

type PlayerNextMatchCardProps = {
  isFocused: boolean;
  match: TournamentMatchWithSides;
  onFocusRef?: (node: View | null) => void;
  stageLabel: string;
  tournament: TournamentOverview;
};

/** Um jogo da fila, no shape do card das agendas (`ui/match-card.tsx`): o lado
 * do viewer vai em "challenger" e o adversário em "challenged", mesmo molde de
 * `tournaments/[tournamentId]/schedule.tsx`; o COMBINAR JOGO entra pelo
 * `AgreementMatchCard` (o viewer é dono de um dos lados). */
function PlayerNextMatchCard(props: PlayerNextMatchCardProps) {
  const { match, tournament } = props;
  const viewerIsSideA =
    match.entryAId !== null &&
    tournament.viewerEntryIds.includes(match.entryAId);
  const viewerSideEntry = viewerIsSideA ? match.entryA : match.entryB;
  const opponentSideEntry = viewerIsSideA ? match.entryB : match.entryA;

  if (!(viewerSideEntry && opponentSideEntry)) {
    return null;
  }

  const viewerSideNames = formatEntryPlayerNames(viewerSideEntry);
  const opponentSideNames = formatEntryPlayerNames(opponentSideEntry);
  const courtName = match.courtId
    ? (tournament.courts.find((court) => court.id === match.courtId)?.name ??
      "")
    : "";

  return (
    <View ref={props.isFocused ? props.onFocusRef : undefined}>
      <AgreementMatchCard
        challengedAvatarUrl={opponentSideEntry.playerA?.avatarUrl ?? null}
        challengedName={opponentSideNames[0]}
        challengedPartnerAvatarUrl={
          opponentSideEntry.playerB?.avatarUrl ?? null
        }
        challengedPartnerName={opponentSideNames[1] ?? null}
        challengerAvatarUrl={viewerSideEntry.playerA?.avatarUrl ?? null}
        challengerName={viewerSideNames[0]}
        challengerPartnerAvatarUrl={viewerSideEntry.playerB?.avatarUrl ?? null}
        challengerPartnerName={viewerSideNames[1] ?? null}
        courtName={courtName}
        matchDate={match.matchDate}
        matchId={match.id}
        matchStatus={match.status}
        sideOrder="viewer"
        stageLabel={props.stageLabel}
        startMinute={match.startMinute ?? 0}
        tournamentId={tournament.id}
      />
    </View>
  );
}

/** Painel da "Visão geral": os KPIs de data na frente, os KPIs de status GERAL
 * e de minhas inscrições (o card abre a aba Inscrições) e, por último, a fila
 * de próximos jogos. Sem inscrição do viewer, o status e o card de minhas
 * inscrições esperam. */
function PlayerOverviewTab(props: {
  endDate?: null | number;
  entries: TournamentEntryWithPlayers[];
  focusCardRef?: (node: View | null) => void;
  focusedMatchId: null | string;
  lastRoundByCategory: Record<string, number>;
  nextMatches: TournamentMatchWithSides[];
  registrationDeadlineAt: number;
  startDate: number;
  tournament: TournamentOverview;
}) {
  const router = useRouter();
  const datesKpi = buildTournamentDatesKpi({
    endDate: props.endDate,
    startDate: props.startDate,
  });
  const deadlineKpi = buildTournamentDeadlineKpi(props.registrationDeadlineAt);
  const statusKpi = buildTournamentEntryStatusKpi(
    props.entries.map((entry) => entry.status)
  );
  const activeEntriesCount = props.entries.filter(
    (entry) => entry.status === "active"
  ).length;
  const showEntries = props.entries.length > 0;

  return (
    <View className="gap-3">
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

      {showEntries ? (
        <View className="flex-row">
          {statusKpi ? (
            <View className="w-1/2 pr-1.5">
              <KpiCard
                label="Status"
                value={
                  <Chip color={statusKpi.color} size="md" variant="soft">
                    <Chip.Label>{statusKpi.label}</Chip.Label>
                  </Chip>
                }
              />
            </View>
          ) : null}
          <View className={statusKpi ? "w-1/2 pl-1.5" : "flex-1"}>
            <KpiCard
              label="Minhas inscrições"
              onPress={() => {
                router.navigate({
                  params: { tournamentId: props.tournament.id },
                  pathname: "/tournaments/[tournamentId]/entries",
                });
              }}
              value={`${activeEntriesCount} ${
                activeEntriesCount === 1 ? "ativa" : "ativas"
              }`}
            />
          </View>
        </View>
      ) : null}

      {props.nextMatches.length > 0 ? (
        <View className="gap-1">
          <Text color="muted" variant="description" weight="medium">
            Próximos jogos
          </Text>
          <View className="gap-2">
            {props.nextMatches.map((match) => (
              <PlayerNextMatchCard
                isFocused={match.id === props.focusedMatchId}
                key={match.id}
                match={match}
                onFocusRef={props.focusCardRef}
                stageLabel={formatBracketStage(
                  match.round,
                  props.lastRoundByCategory[match.categoryId] ?? match.round
                )}
                tournament={props.tournament}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
