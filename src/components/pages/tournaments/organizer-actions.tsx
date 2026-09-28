import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ScheduleProposalDialog,
  type OccupiedSlot,
} from "@/components/ui/schedule-proposal-dialog";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import { BlockCourtDialog } from "@/components/pages/tournaments/block-court-dialog";
import { CancelMatchesDialog } from "@/components/pages/tournaments/cancel-matches-dialog";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { buildMatchSides } from "@/lib/tournaments/bracket-view";
import { formatEntrySideLabel } from "@/lib/tournaments/tournament-details-derived";
import { buildUnavailabilitySpans } from "@/lib/tournaments/unavailability-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
import type { OrganizerMatchMenuKind } from "@/lib/tournaments/organizer-match-menu";
import { resolveTournamentWindow } from "@convex/domains/tournament/window-rules";

/** W.O. — vencedor escolhido, placar vazio (mesma semântica do backend). */
const WALKOVER_SET = { aGames: 0, bGames: 0, kind: "set" } as const;

/** Ação do organizador sobre UMA partida: o card pede pelo id do confronto
 * (quem carrega o payload do torneio é o host, não o card). */
export type OrganizerMatchActionRequest = {
  action: "edit_result" | "publish_result" | "schedule_match";
  matchId: string;
};

/** Cancelamento (menu do card ou modo seleção da agenda): o diálogo fecha o
 * período dos confrontos com o MESMO motivo. */
export type OrganizerCancelMatchesRequest = {
  action: "cancel_matches";
  matchIds: string[];
};

/** Fechar quadra/dia: sem alvo de partida, o diálogo monta a faixa. */
export type OrganizerBlockCourtRequest = {
  action: "block_court";
  /** Dia aberto na agenda: o bloqueio nasce nele. */
  initialDate?: null | string;
};

export type OrganizerDialogRequest =
  | OrganizerMatchActionRequest
  | OrganizerCancelMatchesRequest
  | OrganizerBlockCourtRequest;

/** O pedido do menu: as ações de partida levam o confronto; concluir o torneio
 * é do torneio e não tem alvo (o item nasce no card da FINAL). */
export type OrganizerActionRequest =
  | OrganizerDialogRequest
  | { action: "conclude_tournament" };

export type RunOrganizerAction = (request: OrganizerActionRequest) => void;

/** O verbo do menu (builder por papel) vira o pedido do host: o cancelamento
 * leva lote de um, o resto leva o confronto. Fonte única do de-para, para o
 * chaveamento e a agenda falarem o MESMO idioma. */
export function buildOrganizerMatchActionRequest(input: {
  kind: OrganizerMatchMenuKind;
  matchId: string;
}): OrganizerActionRequest {
  return input.kind === "cancel_matches"
    ? { action: "cancel_matches", matchIds: [input.matchId] }
    : { action: input.kind, matchId: input.matchId };
}

type OrganizerActionsContextValue = {
  run: RunOrganizerAction;
};

const OrganizerActionsContext =
  createContext<OrganizerActionsContextValue | null>(null);

/**
 * O contexto que toda ação do organizador relê: resultado publicado e
 * agendamento mexem em dado DERIVADO do servidor (o vencedor que avança, a
 * pendência de conclusão, o slot ocupado), então nada entra de forma otimista.
 * O desenho e a troca de posições releem o mesmo conjunto.
 */
export function useTournamentContextInvalidation(tournamentId: string) {
  const crpc = useCRPC();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.tournament.discovery.getById.queryFilter({ tournamentId })
      ),
      queryClient.invalidateQueries(
        crpc.tournament.matches.listForTournament.queryFilter({ tournamentId })
      ),
      queryClient.invalidateQueries(
        crpc.tournament.entries.listForTournament.queryFilter({ tournamentId })
      ),
      queryClient.invalidateQueries(
        crpc.tournament.matches.listOccupiedSlots.queryFilter({ tournamentId })
      ),
      queryClient.invalidateQueries(
        crpc.tournament.unavailability.list.queryFilter({ tournamentId })
      ),
      queryClient.invalidateQueries(crpc.pendings.list.list.queryFilter()),
    ]);
  }, [crpc, queryClient, tournamentId]);
}

/** Canal do menu do organizador: o card só conhece o próprio confronto; quem
 * resolve o payload e abre o diálogo é o host do torneio. */
export function useOrganizerActions() {
  const context = useContext(OrganizerActionsContext);

  if (!context) {
    throw new Error(
      "useOrganizerActions precisa do OrganizerActionsHost do torneio."
    );
  }

  return context;
}

/**
 * Host do menu do organizador nas telas do torneio (chaveamento e agenda):
 * monta os diálogos uma vez e serve o canal `run` pros cards. Concluir o
 * torneio não tem diálogo — dispara e o toast conta o desfecho.
 */
export function OrganizerActionsHost(props: {
  children: ReactNode;
  tournamentId: string;
}) {
  const { children, tournamentId } = props;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const access = useValue(bucket$.derived.access);
  const isOrganizer = access?.canManage ?? false;
  const [request, setRequest] = useState<null | OrganizerDialogRequest>(null);

  // Slots ocupados do reagendamento: o organizador é a única audiência do
  // diálogo, e a lista fica quente antes do primeiro toque no menu.
  const occupiedSlotsQuery = useQuery({
    ...crpc.tournament.matches.listOccupiedSlots.staticQueryOptions({
      tournamentId,
    }),
    enabled: isOrganizer,
  });
  const occupiedSlots: OccupiedSlot[] = (occupiedSlotsQuery.data ?? []).map(
    ({ matchId, ...slot }) => ({ ...slot, slotId: matchId })
  );

  // O ato que ENCERRA o torneio (a pendência só existe enquanto ele não
  // concluir; quem tira o item da tela é a releitura, nada otimista).
  const concludeTournament = useMutation({
    mutationFn: crpcClient.tournament.lifecycle.conclude.mutate,
    mutationKey: crpc.tournament.lifecycle.conclude.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível concluir o torneio. Tente novamente."
        ),
        id: "conclude-tournament-error",
        label: "Falha ao concluir",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "Torneio encerrado.",
        id: "conclude-tournament-success",
        label: "Torneio concluído",
        variant: "success",
      });
    },
  });

  const run = useCallback<RunOrganizerAction>(
    (next) => {
      if (next.action === "conclude_tournament") {
        concludeTournament.mutate({ tournamentId });
        return;
      }

      setRequest(next);
    },
    [concludeTournament.mutate, tournamentId]
  );
  const contextValue = useMemo(() => ({ run }), [run]);

  return (
    <OrganizerActionsContext.Provider value={contextValue}>
      {children}
      {request ? (
        <OrganizerDialog
          occupiedSlots={occupiedSlots}
          onClose={() => {
            setRequest(null);
          }}
          request={request}
          tournamentId={tournamentId}
        />
      ) : null}
    </OrganizerActionsContext.Provider>
  );
}

/** UM diálogo por pedido: o host monta o pedido e quem desenha é o controlador
 * do assunto (partida, cancelamento em lote ou fechar quadra). */
function OrganizerDialog(props: {
  occupiedSlots: OccupiedSlot[];
  onClose: () => void;
  request: OrganizerDialogRequest;
  tournamentId: string;
}) {
  if (props.request.action === "cancel_matches") {
    return (
      <OrganizerCancelController
        onClose={props.onClose}
        request={props.request}
        tournamentId={props.tournamentId}
      />
    );
  }

  if (props.request.action === "block_court") {
    return (
      <OrganizerBlockController
        initialDate={props.request.initialDate}
        onClose={props.onClose}
        tournamentId={props.tournamentId}
      />
    );
  }

  return (
    <OrganizerMatchController
      occupiedSlots={props.occupiedSlots}
      onClose={props.onClose}
      request={props.request}
      tournamentId={props.tournamentId}
    />
  );
}

/** O cancelamento em lote: os dias/fusos saem das partidas ESCOLHIDAS (do bucket
 * do torneio, não do card) e o check fecha cada faixa junto. */
function OrganizerCancelController(props: {
  onClose: () => void;
  request: OrganizerCancelMatchesRequest;
  tournamentId: string;
}) {
  const { onClose, request, tournamentId } = props;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const matches = useValue(bucket$.data.matches);
  const cancelSpans = useMemo(
    () =>
      buildUnavailabilitySpans(
        matches.flatMap((match) =>
          request.matchIds.includes(match.id) &&
          match.matchDate &&
          match.startMinute !== null
            ? [
                {
                  endMinute: match.endMinute ?? match.startMinute,
                  matchDate: match.matchDate,
                  startMinute: match.startMinute,
                },
              ]
            : []
        )
      ),
    [matches, request.matchIds]
  );
  const setUnavailability = useMutation({
    mutationFn: crpcClient.tournament.unavailability.set.mutate,
    mutationKey: crpc.tournament.unavailability.set.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível fechar o período. Tente novamente."
        ),
        id: "tournament-unavailability-error",
        label: "Falha ao fechar o período",
        variant: "danger",
      });
    },
  });
  const cancelMatches = useMutation({
    mutationFn: crpcClient.tournament.matches.cancelMatches.mutate,
    mutationKey: crpc.tournament.matches.cancelMatches.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar os jogos. Tente novamente."
        ),
        id: "tournament-cancel-matches-error",
        label: "Falha ao cancelar",
        variant: "danger",
      });
    },
    onSuccess: async ({ cancelled, skipped }) => {
      await invalidateTournamentContext();
      onClose();
      toast.show({
        description: `${cancelled === 1 ? "1 confronto voltou" : `${cancelled} confrontos voltaram`} para A definir. Os jogadores receberam o aviso.${
          skipped > 0
            ? ` ${skipped} ${skipped === 1 ? "confronto" : "confrontos"} sem alteração.`
            : ""
        }`,
        id: "tournament-cancel-matches-success",
        label: cancelled === 1 ? "Jogo cancelado" : "Jogos cancelados",
        variant: "success",
      });
    },
  });
  const isPending = setUnavailability.isPending || cancelMatches.isPending;

  return (
    <CancelMatchesDialog
      isPending={isPending}
      matchCount={request.matchIds.length}
      onClose={onClose}
      onSubmit={async (input) => {
        if (input.blockPeriod) {
          // Bloqueio ANTES do cancelamento: se o fechamento falhar, o toast
          // explica e nada foi cancelado pela metade.
          for (const span of cancelSpans) {
            await setUnavailability.mutateAsync({
              courtId: null,
              date: span.date,
              endMinute: span.endMinute,
              reason: input.reason,
              startMinute: span.startMinute,
              tournamentId,
            });
          }
        }

        await cancelMatches.mutateAsync({
          matchIds: request.matchIds,
          reason: input.reason,
          tournamentId,
        });
      }}
      spans={cancelSpans}
    />
  );
}

/** Fechar quadra/dia: só monta com o torneio na mão (quadras e janela). */
function OrganizerBlockController(props: {
  initialDate?: null | string;
  onClose: () => void;
  tournamentId: string;
}) {
  const { initialDate, onClose, tournamentId } = props;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const tournament = useValue(bucket$.data.tournament);
  const setUnavailability = useMutation({
    mutationFn: crpcClient.tournament.unavailability.set.mutate,
    mutationKey: crpc.tournament.unavailability.set.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível fechar a agenda. Tente novamente."
        ),
        id: "tournament-block-court-error",
        label: "Falha ao fechar a agenda",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      onClose();
      toast.show({
        description: "Ninguém agenda nesse período até você reabrir.",
        id: "tournament-block-court-success",
        label: "Período fechado",
        variant: "success",
      });
    },
  });

  if (!tournament) {
    return null;
  }

  const window = resolveTournamentWindow({
    endDateMs: tournament.endDate,
    startDateMs: tournament.startDate,
  });

  return (
    <BlockCourtDialog
      courts={tournament.courts}
      initialDate={initialDate}
      isPending={setUnavailability.isPending}
      onClose={onClose}
      onSubmit={async (input) => {
        await setUnavailability.mutateAsync({ ...input, tournamentId });
      }}
      windowEndDayKey={window.endDayKey}
      windowStartDayKey={window.startDayKey}
    />
  );
}

/** O diálogo do confronto ATIVO: o alvo chega pelo id e o payload (lados,
 * placar, agendamento atual) sai do bucket do torneio. */
function OrganizerMatchController(props: {
  occupiedSlots: OccupiedSlot[];
  onClose: () => void;
  request: OrganizerMatchActionRequest;
  tournamentId: string;
}) {
  const { occupiedSlots, onClose, request, tournamentId } = props;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const tournament = useValue(bucket$.data.tournament);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const match = useMemo(
    () =>
      buildMatchSides({ entriesById, matches }).find(
        (item) => item.id === request.matchId
      ) ?? null,
    [entriesById, matches, request.matchId]
  );

  const publishResult = useMutation({
    mutationFn: crpcClient.tournament.matches.publishResult.mutate,
    mutationKey: crpc.tournament.matches.publishResult.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível salvar o resultado. Tente novamente."
        ),
        id: "tournament-result-error",
        label: "Falha ao salvar resultado",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      onClose();
      toast.show({
        description: "O vencedor avançou na chave.",
        id: "tournament-result-success",
        label: "Resultado salvo",
        variant: "success",
      });
    },
  });
  // Edição de resultado JÁ publicado: o CONFLICT do servidor (partida seguinte
  // já jogada) chega com a mensagem pronta — o toast só a exibe.
  const editResult = useMutation({
    mutationFn: crpcClient.tournament.matches.editResult.mutate,
    mutationKey: crpc.tournament.matches.editResult.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível salvar o resultado. Tente novamente."
        ),
        id: "tournament-edit-result-error",
        label: "Falha ao salvar resultado",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      onClose();
      toast.show({
        description: "O resultado foi atualizado na chave.",
        id: "tournament-edit-result-success",
        label: "Resultado atualizado",
        variant: "success",
      });
    },
  });
  const scheduleMatch = useMutation({
    mutationFn: crpcClient.tournament.matches.scheduleMatch.mutate,
    mutationKey: crpc.tournament.matches.scheduleMatch.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível agendar o confronto. Tente novamente."
        ),
        id: "tournament-schedule-error",
        label: "Falha ao agendar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      onClose();
      toast.show({
        description: "Os jogadores foram notificados do agendamento.",
        id: "tournament-schedule-success",
        label: "Confronto agendado",
        variant: "success",
      });
    },
  });

  if (!(match && tournament)) {
    return null;
  }

  if (request.action === "schedule_match") {
    // Sem os dois lados o organizador RESERVA a vaga da semi/final: o horário
    // fica no confronto e vale quando os vencedores aparecerem.
    const isReserving = !(match.entryAId && match.entryBId);
    const window = resolveTournamentWindow({
      endDateMs: tournament.endDate,
      startDateMs: tournament.startDate,
    });

    return (
      <ScheduleProposalDialog
        actionLabel="Salvar agendamento"
        courts={tournament.courts}
        defaultDurationMinutes={tournament.matchConfig.defaultDurationMinutes}
        description={`${formatEntrySideLabel(match.entryA)} contra ${formatEntrySideLabel(match.entryB)}.${
          isReserving
            ? " A vaga já fica com este horário quando os vencedores aparecerem."
            : ""
        }`}
        initialValue={
          match.matchDate
            ? {
                courtId: match.courtId ?? "",
                endMinute:
                  (match.startMinute ?? 0) +
                  tournament.matchConfig.defaultDurationMinutes,
                matchDate: match.matchDate,
                startMinute: match.startMinute ?? 0,
              }
            : undefined
        }
        isOpen
        isPending={scheduleMatch.isPending}
        occupiedSlots={occupiedSlots}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
        onSubmit={async (value) => {
          // O agendamento do organizador é por quadra: o diálogo trava o envio
          // sem ela, então o valor nulo não chega aqui.
          if (value.courtId === null) {
            return;
          }

          await scheduleMatch.mutateAsync({
            courtId: value.courtId,
            // Ghost minute: a UI do torneio não tem campo de duração, mas
            // ScheduleTournamentMatchSchema (deployado) exige `endMinute`.
            endMinute: value.endMinute,
            matchDate: value.matchDate,
            matchId: match.id,
            startMinute: value.startMinute,
          });
        }}
        slotIdToIgnore={match.id}
        title={
          match.matchDate
            ? "Reagendar confronto"
            : isReserving
              ? "Reservar horário"
              : "Agendar confronto"
        }
        windowEndDayKey={window.endDayKey}
        windowStartDayKey={window.startDayKey}
      />
    );
  }

  const isEdit = request.action === "edit_result";

  return (
    <ScoreResultDialog
      initialSets={match.score?.sets}
      isOpen
      isPending={isEdit ? editResult.isPending : publishResult.isPending}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      onSubmit={async (value) => {
        const payload = {
          matchId: match.id,
          score: {
            sets: value.walkover ? [WALKOVER_SET] : value.sets,
            winnerEntryId: value.explicitWinnerId,
          },
          walkover: value.walkover,
        };

        if (isEdit) {
          await editResult.mutateAsync(payload);
          return;
        }

        await publishResult.mutateAsync(payload);
      }}
      sideAId={match.entryAId ?? ""}
      sideAName={formatEntrySideLabel(match.entryA)}
      sideBId={match.entryBId ?? ""}
      sideBName={formatEntrySideLabel(match.entryB)}
      title={isEdit ? "Editar resultado" : "Lançar resultado"}
      walkoverEnabled
    />
  );
}
