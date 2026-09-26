import { MoreVerticalIcon, ShuffleIcon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, Dialog, Menu, Tabs, useToast } from "heroui-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";

import { ScheduleProposalDialog } from "@/components/ui/schedule-proposal-dialog";
import { BracketCanvas } from "@/components/pages/tournaments/bracket-canvas";
import { BracketMatchCard } from "@/components/pages/tournaments/bracket-match-card";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  BRACKET_BYE_CARD_HEIGHT,
  bracketMatchEstimatedHeight,
  buildBracketCategoryTrees,
  commitCardHeight,
  layoutBracketCategoryTree,
  type BracketCardHeights,
  type BracketTreeLayout,
} from "@/lib/tournaments/bracket-tree";
import {
  buildMatchSides,
  hasScheduledMatch,
  isByeMatch,
  resolveSwapPickSides,
  resolveSwapSelection,
  type BracketFeed,
  type BracketSwapTarget,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import {
  buildBracketPlaceholder,
  formatBracketStage,
  formatEntrySideLabel,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

/** Card da chave + espaço do cotovelo entre rodadas (uniwind rem = 16). O card
 * na tela é governado pelo ZOOM de abertura (uma coluna): em 320 ele nasce
 * ~1:1, então o desenho aprovado aparece no tamanho dele. */
const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 32;
const CARD_GAP_Y = 12;

/** W.O. — vencedor escolhido, placar vazio (mesma semântica do backend). */
const WALKOVER_SET = {
  aGames: 0,
  bGames: 0,
  kind: "set",
} as const;

type ResultTarget = { match: TournamentMatchWithSides };
type BracketTreeCardEntry = BracketTreeLayout["cards"][number];

export default function TournamentBracketRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const access = useValue(bucket$.derived.access);
  const tournament = useValue(bucket$.data.tournament);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const categoriesById = useValue(bucket$.derived.categoriesById);

  const [resultTarget, setResultTarget] = useState<ResultTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] =
    useState<TournamentMatchWithSides | null>(null);
  const [swapTarget, setSwapTarget] = useState<BracketSwapTarget | null>(null);
  const [editTarget, setEditTarget] = useState<TournamentMatchWithSides | null>(
    null
  );
  const [cardHeights, setCardHeights] = useState<BracketCardHeights>({});
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isRedrawDialogOpen, setIsRedrawDialogOpen] = useState(false);
  // Inactive tab screens stay mounted (detachInactiveScreens={false}), so this
  // canvas survives with the last visit's transform: re-entering the tab must
  // re-seed the fit on the SAME instance — remounting by key blinks the screen.
  const hasFocusedBracket = useRef(false);
  const [bracketFocusSeed, setBracketFocusSeed] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedBracket.current) {
        setBracketFocusSeed((seed) => seed + 1);
      } else {
        hasFocusedBracket.current = true;
      }
    }, [])
  );
  const isOrganizer = access?.canManage ?? false;
  // O ajuste de posição (mesma rodada ou entre rodadas) SÓ existe com a chave
  // sorteada — iniciar congela a chave; a regra vive no modelo puro de
  // bracket-view.
  const tournamentStatus = tournament?.status ?? "";
  useEffect(() => {
    bucket$.actions.setActiveRoute("bracket");
  }, [bucket$]);

  // Slots ocupados pros horários do dialog de agendamento (padrão da liga,
  // ranking.tsx:66) — só o organizador agenda, mesma audiência do dialog.
  const occupiedSlotsQuery = useQuery({
    ...crpc.tournament.matches.listOccupiedSlots.staticQueryOptions({
      tournamentId,
    }),
    enabled: isOrganizer,
  });
  const occupiedSlots = (occupiedSlotsQuery.data ?? []).map(
    ({ matchId, ...slot }) => ({ ...slot, slotId: matchId })
  );

  async function invalidateTournamentContext() {
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
        crpc.tournament.matches.listOccupiedSlots.queryFilter({
          tournamentId,
        })
      ),
    ]);
  }

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
      setResultTarget(null);
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
      setEditTarget(null);
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
      setScheduleTarget(null);
      toast.show({
        description: "Os jogadores foram notificados do agendamento.",
        id: "tournament-schedule-success",
        label: "Confronto agendado",
        variant: "success",
      });
    },
  });

  const { mutate: swapSlotsMutate, isPending: isSwapPending } = useMutation({
    mutationFn: crpcClient.tournament.bracket.swapSlots.mutate,
    mutationKey: crpc.tournament.bracket.swapSlots.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível trocar as posições. Tente novamente."
        ),
        id: "tournament-swap-error",
        label: "Falha ao trocar posições",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "As posições foram trocadas.",
        id: "tournament-swap-success",
        label: "Posições trocadas",
        variant: "success",
      });
    },
  });

  const drawBracket = useMutation({
    mutationFn: crpcClient.tournament.bracket.draw.mutate,
    mutationKey: crpc.tournament.bracket.draw.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível sortear a chave. Tente novamente."
        ),
        id: "draw-tournament-error",
        label: "Falha ao sortear",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setIsRedrawDialogOpen(false);
      toast.show({
        description:
          "Chave sorteada. Ajuste as posições se precisar antes de iniciar.",
        id: "draw-tournament-success",
        label: "Chave sorteada",
        variant: "success",
      });
    },
  });

  const matchesWithSides = useMemo(
    () => buildMatchSides({ entriesById, matches }),
    [entriesById, matches]
  );

  // O nome da quadra RESOLVIDO é o mesmo valor nos dois lados: a estimativa
  // conta o chip do pé pelo critério do card (dia E quadra), então os dois têm
  // de ver o mesmo `null` — um `courtId` sem quadra no torneio não desenha chip.
  const courtNameOf = useCallback(
    (match: TournamentMatchWithSides) =>
      tournament?.courts.find((court) => court.id === match.courtId)?.name ??
      null,
    [tournament]
  );

  const trees = useMemo(
    () => buildBracketCategoryTrees(matchesWithSides, categoriesById),
    [matchesWithSides, categoriesById]
  );

  const treeLayouts = useMemo(
    () =>
      trees.map((tree) => {
        // A MODALIDADE é da categoria (a árvore é por categoria, então ela é
        // homogênea); a altura sai por partida porque o chip do pé depende do
        // agendamento.
        const modality = categoriesById[tree.id]?.modality ?? "singles";

        return {
          layout: layoutBracketCategoryTree(tree.columns, {
            // Card de bye tem altura FIXA (o próprio card a fixa na constante):
            // a linha não entra em cardHeights e a medida nunca commita.
            cardHeightOf: (match) =>
              cardHeights[match.id] ??
              (isByeMatch(match)
                ? BRACKET_BYE_CARD_HEIGHT
                : bracketMatchEstimatedHeight({
                    courtName: courtNameOf(match),
                    matchDate: match.matchDate,
                    modality,
                  })),
            cardWidth: CARD_WIDTH,
            connectorWidth: CONNECTOR_WIDTH,
            gapY: CARD_GAP_Y,
          }),
          modality,
          tree,
        };
      }),
    [categoriesById, courtNameOf, trees, cardHeights]
  );

  // One category on the canvas at a time; the tab bar picks which.
  const activeTreeLayout = useMemo(() => {
    if (treeLayouts.length === 0) {
      return null;
    }

    const selected = treeLayouts.find(
      ({ tree }) => tree.id === activeCategoryId
    );

    return selected ?? treeLayouts[0];
  }, [activeCategoryId, treeLayouts]);

  const layout = activeTreeLayout?.layout;

  // Partidas FILHAS por "rodada:slot" (coluna da árvore ativa): o ajuste usa
  // isto pra saber se o lado vazio ainda espera o vencedor de baixo (feed vivo
  // não aceita inscrição; só linha podada aceita) ou se é vitória propagada.
  const feedBySlot = useMemo(() => {
    const bySlot = new Map<string, BracketFeed>();

    for (const roundMatches of activeTreeLayout?.tree.columns ?? []) {
      for (const match of roundMatches) {
        bySlot.set(`${match.round}:${match.slotInRound}`, {
          status: match.status,
          winnerEntryId: match.winnerEntryId,
        });
      }
    }

    return bySlot;
  }, [activeTreeLayout]);

  const handleHeightChange = useCallback(
    (input: { estimatedHeight: number; height: number; matchId: string }) => {
      // Medir a estimativa (card sem medida) não entra no state: sem cascata de
      // setState na montagem. Comparar com a estimativa congelava o retângulo e
      // jogava o conector fora do eixo — commitCardHeight cobre os dois casos.
      setCardHeights((previous) =>
        commitCardHeight({
          estimatedHeight: input.estimatedHeight,
          heights: previous,
          matchId: input.matchId,
          measured: input.height,
        })
      );
    },
    []
  );

  function handleCategoryChange(categoryId: string) {
    setActiveCategoryId(categoryId);
  }

  // O sorteio/re-sorteio reconstrói a chave e apaga as partidas: com confronto
  // agendado (data, horário, quadra) ele morre junto, então a UI confirma antes
  // de disparar. Sem agendamento (o primeiro sorteio nunca tem), vai direto.
  function handleDrawPress() {
    if (hasScheduledMatch(matches)) {
      setIsRedrawDialogOpen(true);
      return;
    }

    drawBracket.mutate({ tournamentId });
  }

  const handleSidePress = useCallback(
    (target: BracketSwapTarget) => {
      const outcome = resolveSwapSelection({
        current: swapTarget,
        next: target,
        tournamentStatus,
      });

      if (outcome.kind === "clear") {
        setSwapTarget(null);
        return;
      }

      if (outcome.kind !== "swap") {
        setSwapTarget(outcome.target);
        return;
      }

      // Uma coordenada por lado: mesma rodada (roundA === roundB) ou move
      // cross-rodada (só com a chave drawn, regra do modelo). Destino vazio
      // esvazia a origem, destino ocupado transpõe — semântica do servidor.
      swapSlotsMutate({
        categoryId: outcome.to.match.categoryId,
        roundA: outcome.from.match.round,
        roundB: outcome.to.match.round,
        sideA: outcome.from.side,
        sideB: outcome.to.side,
        slotA: outcome.from.match.slotInRound,
        slotB: outcome.to.match.slotInRound,
        tournamentId,
      });
      setSwapTarget(null);
    },
    [swapSlotsMutate, swapTarget, tournamentId, tournamentStatus]
  );

  // Stable identity across gesture-end canvas re-renders: the canvas only
  // re-renders its edges then, so cards skip reconciliation entirely.
  const renderCard = useCallback(
    ({ match }: BracketTreeCardEntry) => {
      const courtName = courtNameOf(match);
      // A modalidade da árvore ativa vale para os dois: a altura estimada do nó
      // e a forma do lado — na dupla a vaga em aberto desenha o par.
      const modality = activeTreeLayout?.modality ?? "singles";
      const estimatedHeight = bracketMatchEstimatedHeight({
        courtName,
        matchDate: match.matchDate,
        modality,
      });

      return (
        <BracketMatchCard
          courtName={courtName}
          isFinal={match.round === activeTreeLayout?.tree.columns.length}
          isOrganizer={isOrganizer}
          match={match}
          modality={modality}
          onEditResultPress={setEditTarget}
          onHeightChange={(height) => {
            // Card de bye: altura FIXA na constante do layout (o próprio card a
            // fixa), então a medida é sempre a mesma do retângulo e não entra no
            // state — commitar reintroduziria o churn de re-layout.
            if (isByeMatch(match)) {
              return;
            }
            handleHeightChange({
              estimatedHeight,
              height,
              matchId: match.id,
            });
          }}
          onResultPress={(target) => {
            setResultTarget({ match: target });
          }}
          onSchedulePress={setScheduleTarget}
          onSidePress={handleSidePress}
          selectedSide={
            swapTarget?.match.id === match.id ? swapTarget.side : null
          }
          stageLabel={formatBracketStage(
            match.round,
            activeTreeLayout?.tree.columns.length ?? match.round
          )}
          swapDisabled={isSwapPending}
          swapPickEnabled={resolveSwapPickSides({
            current: swapTarget,
            feedA:
              feedBySlot.get(`${match.round - 1}:${match.slotInRound * 2}`) ??
              null,
            feedB:
              feedBySlot.get(
                `${match.round - 1}:${match.slotInRound * 2 + 1}`
              ) ?? null,
            match,
            tournamentStatus,
          })}
        />
      );
    },
    [
      activeTreeLayout,
      courtNameOf,
      feedBySlot,
      handleHeightChange,
      handleSidePress,
      isOrganizer,
      isSwapPending,
      swapTarget,
      tournamentStatus,
    ]
  );

  const isError = bootstrapStatus === "error";
  const isLoading = bootstrapStatus !== "ready" || !tournament;
  const bracketPlaceholder =
    tournament && access && !access.canOpenBracket
      ? buildBracketPlaceholder({
          access,
          startDateMs: tournament.startDate,
        })
      : null;
  const hasBracket = trees.length > 0 && activeTreeLayout !== null;
  const categories = tournament?.categories ?? [];
  // `published` = primeiro sorteio (a chave nasce aqui); `drawn` = re-sorteio da
  // prévia já sorteada. Iniciar congela, então `ongoing` e depois ficam sem menu.
  const isFirstDraw = tournament?.status === "published";
  const hasBracketMenu =
    isOrganizer && (isFirstDraw || tournament?.status === "drawn");
  // The draw skips categories with fewer than 2 active entries, so a listed
  // category may have no bracket: only offer tabs that render a tree.
  const categoryTabs = categories.filter((category) =>
    trees.some((tree) => tree.id === category.id)
  );
  const hasMultipleCategories = categoryTabs.length > 1;
  return (
    <Page>
      <Page.Header>
        <View className="flex-1 flex-col gap-2">
          <View className="flex-1 flex-row">
            <Page.Header.Left />
            <Page.Header.Center>
              <Page.Header.Title>Chaveamento</Page.Header.Title>
            </Page.Header.Center>
            <Page.Header.Right>
              {hasBracketMenu ? (
                <Menu>
                  <Menu.Trigger asChild>
                    <Button isIconOnly size="sm" variant="tertiary">
                      <HugeIcons icon={MoreVerticalIcon} />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Overlay className="bg-backdrop" />
                    <Menu.Content presentation="popover" width={240}>
                      <Menu.Item
                        onPress={() => {
                          handleDrawPress();
                        }}
                      >
                        <Menu.ItemTitle>
                          {isFirstDraw ? "Sortear" : "Re-sortear"}
                        </Menu.ItemTitle>
                        <HugeIcons icon={ShuffleIcon} />
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              ) : null}
            </Page.Header.Right>
          </View>
          {hasMultipleCategories && activeTreeLayout ? (
            <Tabs
              onValueChange={(value) => {
                handleCategoryChange(value);
              }}
              value={activeTreeLayout.tree.id}
            >
              <Tabs.List>
                <Tabs.ScrollView>
                  <Tabs.Indicator />
                  {categoryTabs.map((category) => (
                    <Tabs.Trigger key={category.id} value={category.id}>
                      <Tabs.Label>{category.displayName}</Tabs.Label>
                    </Tabs.Trigger>
                  ))}
                </Tabs.ScrollView>
              </Tabs.List>
            </Tabs>
          ) : null}
        </View>
      </Page.Header>

      {isError ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <ErrorState message="Não foi possível carregar a chave." />
        </Page.ScrollView>
      ) : isLoading ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <LoadingState />
        </Page.ScrollView>
      ) : bracketPlaceholder ? (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <EmptyState
            description={bracketPlaceholder}
            title="Chave em preparação"
          />
        </Page.ScrollView>
      ) : hasBracket && layout ? (
        // Remount per CATEGORY only (each tree starts framed at its own fit);
        // a re-entrada na aba NÃO remonta: o focusSeed re-enquadra a mesma
        // instância (sem piscar).
        <BracketCanvas
          cardWidth={CARD_WIDTH}
          connectorWidth={CONNECTOR_WIDTH}
          focusSeed={bracketFocusSeed}
          key={activeTreeLayout.tree.id}
          layout={layout}
          renderCard={renderCard}
        />
      ) : (
        <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
          <EmptyState
            description="O sorteio ainda não foi feito."
            title="Sem chave"
          />
        </Page.ScrollView>
      )}

      {resultTarget && tournament ? (
        <ScoreResultDialog
          initialSets={resultTarget.match.score?.sets}
          isOpen
          isPending={publishResult.isPending}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setResultTarget(null);
            }
          }}
          onSubmit={async (value) => {
            await publishResult.mutateAsync({
              matchId: resultTarget.match.id,
              score: {
                sets: value.walkover ? [WALKOVER_SET] : value.sets,
                winnerEntryId: value.explicitWinnerId,
              },
              walkover: value.walkover,
            });
          }}
          sideAId={resultTarget.match.entryAId ?? ""}
          sideAName={formatEntrySideLabel(resultTarget.match.entryA)}
          sideBId={resultTarget.match.entryBId ?? ""}
          sideBName={formatEntrySideLabel(resultTarget.match.entryB)}
          title="Lançar resultado"
          walkoverEnabled
        />
      ) : null}

      {editTarget && tournament ? (
        <ScoreResultDialog
          initialSets={editTarget.score?.sets}
          isOpen
          isPending={editResult.isPending}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditTarget(null);
            }
          }}
          onSubmit={async (value) => {
            await editResult.mutateAsync({
              matchId: editTarget.id,
              score: {
                sets: value.walkover ? [WALKOVER_SET] : value.sets,
                winnerEntryId: value.explicitWinnerId,
              },
              walkover: value.walkover,
            });
          }}
          sideAId={editTarget.entryAId ?? ""}
          sideAName={formatEntrySideLabel(editTarget.entryA)}
          sideBId={editTarget.entryBId ?? ""}
          sideBName={formatEntrySideLabel(editTarget.entryB)}
          title="Editar resultado"
          walkoverEnabled
        />
      ) : null}

      {scheduleTarget && tournament ? (
        <ScheduleProposalDialog
          actionLabel="Salvar agendamento"
          courts={tournament.courts}
          defaultDurationMinutes={tournament.matchConfig.defaultDurationMinutes}
          description={`${formatEntrySideLabel(scheduleTarget.entryA)} contra ${formatEntrySideLabel(scheduleTarget.entryB)}.`}
          initialValue={
            scheduleTarget.matchDate
              ? {
                  courtId: scheduleTarget.courtId ?? "",
                  endMinute:
                    (scheduleTarget.startMinute ?? 0) +
                    tournament.matchConfig.defaultDurationMinutes,
                  matchDate: scheduleTarget.matchDate,
                  startMinute: scheduleTarget.startMinute ?? 0,
                }
              : undefined
          }
          isOpen
          isPending={scheduleMatch.isPending}
          occupiedSlots={occupiedSlots}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setScheduleTarget(null);
            }
          }}
          onSubmit={async (value) => {
            await scheduleMatch.mutateAsync({
              courtId: value.courtId,
              // Ghost minute: a UI do torneio não tem campo de duração, mas
              // ScheduleTournamentMatchSchema (deployado) exige `endMinute`.
              endMinute: value.endMinute,
              matchDate: value.matchDate,
              matchId: scheduleTarget.id,
              startMinute: value.startMinute,
            });
          }}
          slotIdToIgnore={scheduleTarget.id}
          title={
            scheduleTarget.matchDate
              ? "Reagendar confronto"
              : "Agendar confronto"
          }
        />
      ) : null}

      <Dialog isOpen={isRedrawDialogOpen} onOpenChange={setIsRedrawDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Re-sortear a chave</Dialog.Title>
            <Text color="muted" variant="description">
              As posições serão sorteadas de novo. Os confrontos já agendados
              serão apagados, com data, horário e quadra.
            </Text>
            <View className="flex-row gap-2 self-end">
              <Button
                onPress={() => {
                  setIsRedrawDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Voltar</Button.Label>
              </Button>
              <Button
                isDisabled={drawBracket.isPending}
                onPress={() => {
                  drawBracket.mutate({ tournamentId });
                }}
                size="sm"
                variant="danger"
              >
                <Button.Label>Re-sortear</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}
