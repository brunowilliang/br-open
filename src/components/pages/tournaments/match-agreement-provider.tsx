import { useValue } from "@legendapp/state/react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "heroui-native";

import type { MatchCardAgreement } from "@/components/ui/match-card";
import { ScheduleProposalDialog } from "@/components/ui/schedule-proposal-dialog";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { resolveTournamentWindow } from "@convex/domains/tournament/window-rules";
import {
  MATCH_AGREEMENT_COPY,
  MATCH_AGREEMENT_MESSAGE,
} from "@/lib/tournaments/match-agreement-copy";
import {
  readMatchAgreementActionLabel,
  type MatchAgreementActionKind,
} from "@/lib/tournaments/match-agreement-actions";
import {
  buildPlayerAgreementChip,
  buildPlayerAgreementMenu,
  buildPlayerAgreementScheduleProposal,
  buildPlayerAgreementScoreProposal,
  isMatchAgreementLocked,
  resolveTableWalkoverWinnerEntryId,
  selectNegotiablePlayerMatches,
  type MatchAgreementSideOrder,
  type PlayerMatch,
} from "@/lib/tournaments/match-agreement-view";
import { formatEntrySideLabel } from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

/** W.O. — vencedor escolhido, placar vazio (mesma semântica do backend). */
const WALKOVER_SET = { aGames: 0, bGames: 0, kind: "set" } as const;

export type MatchAgreementRequest = {
  action: MatchAgreementActionKind;
  matchId: string;
  /** Torneio do confronto: a folha e os diálogos vivem no casco privado e cada
   * card conhece o torneio do próprio jogo. */
  tournamentId: string;
};

export type RunMatchAgreementAction = (request: MatchAgreementRequest) => void;

/** Ação do card: o card só conhece o próprio confronto, o torneio vem de quem
 * monta (o card sabe de qual torneio é o jogo). */
export type RunMatchCardAgreementAction = (input: {
  action: MatchAgreementActionKind;
  matchId: string;
}) => void;

type MatchAgreementContextValue = {
  runAction: RunMatchAgreementAction;
};

const MatchAgreementContext = createContext<MatchAgreementContextValue | null>(
  null
);

/** Chip e itens do card do jogador. Builder PURO (sem hook) porque o
 * chaveamento monta o card dentro de um render por nó. */
export function buildPlayerAgreementCard(input: {
  courts: readonly { id: string; name: string }[];
  isMatchLocked: boolean;
  playerMatch: PlayerMatch;
  runAction: RunMatchCardAgreementAction;
  sideOrder: MatchAgreementSideOrder;
  /** Status do torneio: decide se o menu pode oferecer verbo de placar. */
  tournamentStatus: null | string;
}): MatchCardAgreement {
  const matchId = input.playerMatch.match.id;

  return {
    chip: buildPlayerAgreementChip({ playerMatch: input.playerMatch }),
    menuItems: buildPlayerAgreementMenu({
      isMatchLocked: input.isMatchLocked,
      playerMatch: input.playerMatch,
      tournamentStatus: input.tournamentStatus,
    }).map((item) => ({
      icon: item.icon,
      isDanger: item.isDanger,
      label: item.label,
      onPress: () => {
        input.runAction({ action: item.kind, matchId });
      },
    })),
    scheduleProposal: buildPlayerAgreementScheduleProposal({
      courts: input.courts,
      playerMatch: input.playerMatch,
    }),
    scoreProposal: buildPlayerAgreementScoreProposal({
      playerMatch: input.playerMatch,
      sideOrder: input.sideOrder,
    }),
  };
}

/** Acerto de UM torneio: confrontos do próprio jogador (porta `listMyMatches`)
 * mais o payload do torneio que os cards e os diálogos leem do bucket. */
export function useMatchAgreementView(tournamentId: string) {
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const crpc = useCRPC();
  // O ator ativo é GLOBAL (não passa pelo bucket): o card do acerto aparece
  // também fora do torneio, onde só a tela de dentro hidratava o viewer.
  const viewerQuery = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const discoveryQuery = useQuery(
    crpc.tournament.discovery.getById.staticQueryOptions({ tournamentId })
  );
  const entriesQuery = useQuery(
    crpc.tournament.entries.listForTournament.staticQueryOptions({
      tournamentId,
    })
  );
  const activeActor = viewerQuery.data?.activeActor ?? null;
  const viewerProfileId =
    activeActor?.kind === "player" ? activeActor.id : null;
  const tournament = useValue(bucket$.data.tournament);
  const entriesById = useValue(bucket$.derived.entriesById);

  // Fora da tela do torneio ninguém hidrata o bucket — e os diálogos leem dele.
  // As MESMAS queries da tela, então sem leitura extra.
  useEffect(() => {
    if (discoveryQuery.data) {
      bucket$.actions.hydrateDiscovery(
        discoveryQuery.data,
        discoveryQuery.dataUpdatedAt
      );
    }
  }, [bucket$, discoveryQuery.data, discoveryQuery.dataUpdatedAt]);
  useEffect(() => {
    if (entriesQuery.data) {
      bucket$.actions.hydrateEntries(entriesQuery.data);
    }
  }, [bucket$, entriesQuery.data]);

  // Sem ator JOGADOR a porta nem é chamada: o servidor exige perfil de jogador
  // ativo e o organizador não combina confronto por aqui.
  const myMatchesQuery = useQuery({
    ...crpc.tournament.agreements.listMyMatches.staticQueryOptions({
      tournamentId,
    }),
    enabled: viewerProfileId !== null,
  });
  const byMatchId = useMemo(
    () =>
      Object.fromEntries(
        (myMatchesQuery.data ?? []).map((playerMatch) => [
          playerMatch.match.id,
          playerMatch,
        ])
      ) as Record<string, PlayerMatch>,
    [myMatchesQuery.data]
  );

  return { byMatchId, entriesById, tournament };
}

/** Confrontos que o PRÓPRIO jogador ainda combina (porta do servidor). */
export function useNegotiablePlayerMatches(
  tournamentId: string
): PlayerMatch[] {
  const { byMatchId } = useMatchAgreementView(tournamentId);

  return useMemo(
    () => selectNegotiablePlayerMatches(Object.values(byMatchId)),
    [byMatchId]
  );
}

/** Card do confronto do jogador pronto para o `MatchCard` global: null quando o
 * confronto não é dele (ou o dado ainda não chegou): o card segue sem menu. */
export function useMatchAgreementCard(input: {
  matchId: null | string;
  sideOrder: MatchAgreementSideOrder;
  tournamentId: string;
}): MatchCardAgreement | null {
  const { byMatchId, tournament } = useMatchAgreementView(input.tournamentId);
  const courts = tournament?.courts;
  const tournamentStatus = tournament?.status ?? null;
  const { runAction } = useMatchAgreement();
  const { matchId, sideOrder, tournamentId } = input;

  return useMemo(() => {
    const playerMatch = matchId ? (byMatchId[matchId] ?? null) : null;

    if (!playerMatch) {
      return null;
    }

    return buildPlayerAgreementCard({
      courts: courts ?? [],
      isMatchLocked: isMatchAgreementLocked({
        matchStatus: playerMatch.match.status,
        tournamentStatus,
        winnerEntryId: playerMatch.match.winnerEntryId,
      }),
      playerMatch,
      runAction: (request) => {
        runAction({ ...request, tournamentId });
      },
      sideOrder,
      tournamentStatus,
    });
  }, [
    byMatchId,
    courts,
    matchId,
    runAction,
    sideOrder,
    tournamentId,
    tournamentStatus,
  ]);
}

export function useMatchAgreement() {
  const context = useContext(MatchAgreementContext);

  if (!context) {
    throw new Error(
      "useMatchAgreement precisa do MatchAgreementHost do casco privado."
    );
  }

  return context;
}

/** Tudo que a tela mostra do acerto muda junto: o confronto, a pendência e a
 * home (o agregado dos próximos jogos). */
async function invalidateAgreementContext(input: {
  crpc: ReturnType<typeof useCRPC>;
  queryClient: QueryClient;
  tournamentId: string;
}) {
  const { crpc, queryClient, tournamentId } = input;

  await Promise.all([
    queryClient.invalidateQueries(
      crpc.tournament.agreements.listMyMatches.queryFilter({ tournamentId })
    ),
    queryClient.invalidateQueries(
      crpc.tournament.discovery.getById.queryFilter({ tournamentId })
    ),
    queryClient.invalidateQueries(
      crpc.tournament.matches.listForTournament.queryFilter({ tournamentId })
    ),
    queryClient.invalidateQueries(
      crpc.tournament.matches.listOccupiedSlots.queryFilter({ tournamentId })
    ),
    queryClient.invalidateQueries(crpc.pendings.list.list.queryFilter()),
    queryClient.invalidateQueries(
      crpc.player.dashboard.getOverview.queryFilter({ months: 6 })
    ),
  ]);
}

/**
 * COMBINAR JOGO de quem JOGA, em qualquer tela: o menu do card chama `runAction`
 * (aceite sai direto; os diálogos vão para o controlador). Vive no casco
 * privado porque o jogador combina tanto na home quanto dentro do torneio.
 */
export function MatchAgreementHost(props: { children: React.ReactNode }) {
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [request, setRequest] = useState<null | MatchAgreementRequest>(null);

  const acceptSchedule = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.acceptSchedule.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.acceptSchedule.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível aceitar o horário. Tente novamente."
        ),
        id: "accept-match-schedule-error",
        label: "Falha ao aceitar horário",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastAcceptScheduleDescription,
        id: "accept-match-schedule-success",
        label: MATCH_AGREEMENT_COPY.toastAcceptScheduleLabel,
        variant: "success",
      });
    },
  });

  const acceptScore = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.acceptScore.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.acceptScore.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível confirmar o placar. Tente novamente."
        ),
        id: "accept-match-score-error",
        label: "Falha ao confirmar placar",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastAcceptScoreDescription,
        id: "accept-match-score-success",
        label: MATCH_AGREEMENT_COPY.toastAcceptScoreLabel,
        variant: "success",
      });
    },
  });

  const declineSchedule = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.declineSchedule.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.declineSchedule.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar o horário. Tente novamente."
        ),
        id: "decline-match-schedule-error",
        label: "Falha ao recusar horário",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastDeclineScheduleDescription,
        id: "decline-match-schedule-success",
        label: MATCH_AGREEMENT_COPY.toastDeclineScheduleLabel,
        variant: "success",
      });
    },
  });

  const declineScore = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.declineScore.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.declineScore.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar o placar. Tente novamente."
        ),
        id: "decline-match-score-error",
        label: "Falha ao recusar placar",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastDeclineScoreDescription,
        id: "decline-match-score-success",
        label: MATCH_AGREEMENT_COPY.toastDeclineScoreLabel,
        variant: "success",
      });
    },
  });

  const cancelSchedule = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.cancelSchedule.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.cancelSchedule.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar a proposta. Tente novamente."
        ),
        id: "cancel-match-schedule-error",
        label: "Falha ao cancelar proposta",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastCancelScheduleDescription,
        id: "cancel-match-schedule-success",
        label: MATCH_AGREEMENT_COPY.toastCancelScheduleLabel,
        variant: "success",
      });
    },
  });

  const cancelScore = useMutation({
    mutationFn: (input: { matchId: string; tournamentId: string }) =>
      crpcClient.tournament.agreements.cancelScore.mutate({
        matchId: input.matchId,
      }),
    mutationKey: crpc.tournament.agreements.cancelScore.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar o resultado. Tente novamente."
        ),
        id: "cancel-match-score-error",
        label: "Falha ao cancelar resultado",
        variant: "danger",
      });
    },
    onSuccess: async (_data, input) => {
      await invalidateAgreementContext({
        crpc,
        queryClient,
        tournamentId: input.tournamentId,
      });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastCancelScoreDescription,
        id: "cancel-match-score-success",
        label: MATCH_AGREEMENT_COPY.toastCancelScoreLabel,
        variant: "success",
      });
    },
  });

  // As mutações trocam de identidade a cada render; a ação fica estável para os
  // cards (o memo do `MatchCard` só invalida quando o acerto muda de verdade).
  const responsesRef = useRef({
    acceptSchedule,
    acceptScore,
    cancelSchedule,
    cancelScore,
    declineSchedule,
    declineScore,
  });
  responsesRef.current = {
    acceptSchedule,
    acceptScore,
    cancelSchedule,
    cancelScore,
    declineSchedule,
    declineScore,
  };
  const runAction = useCallback<RunMatchAgreementAction>((next) => {
    const responses = responsesRef.current;

    if (next.action === "approve_schedule") {
      responses.acceptSchedule.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    if (next.action === "approve_score") {
      responses.acceptScore.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    if (next.action === "decline_schedule") {
      responses.declineSchedule.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    if (next.action === "decline_score") {
      responses.declineScore.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    if (next.action === "cancel_schedule") {
      responses.cancelSchedule.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    if (next.action === "cancel_score") {
      responses.cancelScore.mutate({
        matchId: next.matchId,
        tournamentId: next.tournamentId,
      });
      return;
    }

    setRequest(next);
  }, []);
  const contextValue = useMemo(() => ({ runAction }), [runAction]);

  return (
    <MatchAgreementContext.Provider value={contextValue}>
      {props.children}

      {request ? (
        <MatchAgreementController
          onClose={() => {
            setRequest(null);
          }}
          request={request}
        />
      ) : null}
    </MatchAgreementContext.Provider>
  );
}

/** Os dois diálogos do acerto do confronto ATIVO. Enquanto a porta do torneio
 * não devolve o confronto, não desenha nada. */
function MatchAgreementController(props: {
  onClose: () => void;
  request: MatchAgreementRequest;
}) {
  const { onClose, request } = props;
  const { matchId, tournamentId } = request;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { byMatchId, entriesById, tournament } =
    useMatchAgreementView(tournamentId);
  // O verbo que abriu o diálogo também nomeia o sheet: fora do `idle` o canal
  // já tem proposta ou acerto, e aí o verbo é o da contraposta.
  const actionLabel = readMatchAgreementActionLabel(request.action);
  const isScheduleAction =
    request.action === "counter_schedule" ||
    request.action === "propose_schedule";
  const canSeeOccupiedSlots = Boolean(
    tournament &&
      (tournament.isTournamentOrganizer || tournament.bracketReleased)
  );
  const occupiedSlotsQuery = useQuery({
    ...crpc.tournament.matches.listOccupiedSlots.staticQueryOptions({
      tournamentId,
    }),
    enabled: isScheduleAction && canSeeOccupiedSlots,
  });
  const occupiedSlots = (occupiedSlotsQuery.data ?? []).map(
    ({ matchId: slotMatchId, ...slot }) => ({ ...slot, slotId: slotMatchId })
  );
  // Os bloqueios entram CRUS (a mesma lista que o servidor usa para recusar):
  // com a quadra ainda não escolhida, só o bloqueio de todas as quadras barra.
  const unavailabilityQuery = useQuery({
    ...crpc.tournament.unavailability.list.staticQueryOptions({ tournamentId }),
    enabled: isScheduleAction && canSeeOccupiedSlots,
  });
  const unavailabilityBlocks = unavailabilityQuery.data ?? [];

  const proposeSchedule = useMutation({
    mutationFn: crpcClient.tournament.agreements.proposeSchedule.mutate,
    mutationKey: crpc.tournament.agreements.proposeSchedule.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível enviar o horário. Tente novamente."
        ),
        id: "propose-schedule-error",
        label: "Falha ao propor horário",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      onClose();
      await invalidateAgreementContext({ crpc, queryClient, tournamentId });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastProposeScheduleDescription,
        id: "propose-schedule-success",
        label: MATCH_AGREEMENT_COPY.toastProposeScheduleLabel,
        variant: "success",
      });
    },
  });

  const proposeScore = useMutation({
    mutationFn: crpcClient.tournament.agreements.proposeScore.mutate,
    mutationKey: crpc.tournament.agreements.proposeScore.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível enviar o placar. Tente novamente."
        ),
        id: "propose-score-error",
        label: "Falha ao propor placar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      onClose();
      await invalidateAgreementContext({ crpc, queryClient, tournamentId });
      toast.show({
        description: MATCH_AGREEMENT_COPY.toastProposeScoreDescription,
        id: "propose-score-success",
        label: MATCH_AGREEMENT_COPY.toastProposeScoreLabel,
        variant: "success",
      });
    },
  });

  const playerMatch = byMatchId[matchId] ?? null;

  if (!(playerMatch && tournament)) {
    return null;
  }

  const entryA = entriesById[playerMatch.match.entryAId ?? ""] ?? null;
  const entryB = entriesById[playerMatch.match.entryBId ?? ""] ?? null;
  const scheduleProposal = playerMatch.agreements.schedule.proposal;
  const scoreProposal = playerMatch.agreements.score.proposal;
  // O rascunho abre com o que já está na mesa (proposta vigente ou o horário do
  // confronto): combinar outro não começa do zero.
  const scheduleInitialValue =
    scheduleProposal ??
    (playerMatch.match.matchDate && playerMatch.match.startMinute !== null
      ? {
          courtId: playerMatch.match.courtId,
          endMinute:
            playerMatch.match.startMinute +
            tournament.matchConfig.defaultDurationMinutes,
          matchDate: playerMatch.match.matchDate,
          startMinute: playerMatch.match.startMinute,
        }
      : null);

  if (isScheduleAction) {
    const window = resolveTournamentWindow({
      endDateMs: tournament.endDate,
      startDateMs: tournament.startDate,
    });

    return (
      <ScheduleProposalDialog
        actionLabel={actionLabel}
        courts={tournament.courts}
        defaultDurationMinutes={tournament.matchConfig.defaultDurationMinutes}
        description={MATCH_AGREEMENT_MESSAGE.scheduleDialogDescription({
          sides: `${formatEntrySideLabel(entryA)} contra ${formatEntrySideLabel(entryB)}`,
        })}
        initialValue={
          scheduleInitialValue
            ? {
                courtId: scheduleInitialValue.courtId ?? null,
                endMinute:
                  scheduleInitialValue.startMinute +
                  tournament.matchConfig.defaultDurationMinutes,
                matchDate: scheduleInitialValue.matchDate,
                startMinute: scheduleInitialValue.startMinute,
              }
            : undefined
        }
        isCourtRequired={tournament.courts.length > 0}
        isOpen
        isPending={proposeSchedule.isPending}
        occupiedSlots={occupiedSlots}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
        onSubmit={async (value) => {
          await proposeSchedule.mutateAsync({
            courtId: value.courtId,
            endMinute: value.endMinute,
            matchDate: value.matchDate,
            matchId: playerMatch.match.id,
            startMinute: value.startMinute,
          });
        }}
        slotIdToIgnore={playerMatch.match.id}
        title={actionLabel}
        unavailabilityBlocks={unavailabilityBlocks}
        unchangedMessage={MATCH_AGREEMENT_MESSAGE.sameScheduleProposal}
        windowEndDayKey={window.endDayKey}
        windowStartDayKey={window.startDayKey}
      />
    );
  }

  return (
    <ScoreResultDialog
      actionLabel={actionLabel}
      initialSets={scoreProposal?.score.sets ?? playerMatch.match.score?.sets}
      initialWalkoverWinnerId={resolveTableWalkoverWinnerEntryId(playerMatch)}
      isOpen
      isPending={proposeScore.isPending}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      onSubmit={async (value) => {
        await proposeScore.mutateAsync({
          matchId: playerMatch.match.id,
          score: {
            sets: value.walkover ? [WALKOVER_SET] : value.sets,
            winnerEntryId: value.explicitWinnerId,
          },
          walkover: value.walkover,
        });
      }}
      sideAId={playerMatch.match.entryAId ?? ""}
      sideAName={formatEntrySideLabel(entryA)}
      sideBId={playerMatch.match.entryBId ?? ""}
      sideBName={formatEntrySideLabel(entryB)}
      title={actionLabel}
      unchangedMessage={MATCH_AGREEMENT_MESSAGE.sameScoreProposal}
      unchangedWalkoverMessage={MATCH_AGREEMENT_MESSAGE.sameWalkoverProposal}
      walkoverEnabled
    />
  );
}
