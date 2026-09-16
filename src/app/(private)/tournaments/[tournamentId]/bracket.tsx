import {
  MoreVerticalIcon,
  PlayIcon,
  ShuffleIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Button,
  Description,
  Dialog,
  Menu,
  Tabs,
  useToast,
} from "heroui-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { BracketCanvas } from "@/components/pages/tournaments/bracket-canvas";
import { BracketMatchCard } from "@/components/pages/tournaments/bracket-match-card";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  logBracketHeightMismatch,
  logBracketLayout,
  logBracketRects,
} from "@/lib/tournaments/bracket-diagnostics";
import {
  BRACKET_BYE_CARD_HEIGHT,
  BRACKET_CARD_ESTIMATED_HEIGHT,
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
  formatMatchScheduleSummary,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";
/** w-64 card + elbow space between rounds (uniwind rem = 16). */
const CARD_WIDTH = 256;
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
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  // The detail layout keeps inactive tab screens mounted
  // (detachInactiveScreens={false}) and is reused across tournament
  // revisits, so this screen and its canvas survive with the gesture
  // transform the previous visit left behind. Re-entering the tab must
  // start framed again (QA R18): remount the canvas on every focus after
  // the first (the first mount is already fresh).
  const hasFocusedBracket = useRef(false);
  const [bracketFocusSeed, setBracketFocusSeed] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedBracket.current) {
        setBracketFocusSeed((seed) => seed + 1);
        return;
      }
      hasFocusedBracket.current = true;
    }, [])
  );
  const isOrganizer = access?.canManage ?? false;
  // Janela do ajuste de posição (IBX-0053): a mesma rodada vale em
  // drawn|ongoing, o move para OUTRA rodada só com a chave sorteada — a
  // regra vive no modelo puro de bracket-view.
  const tournamentStatus = tournament?.status ?? "";
  useEffect(() => {
    bucket$.actions.setActiveRoute("bracket");
  }, [bucket$]);

  // Slots ocupados pros horários do dialog de agendamento (padrão da liga,
  // ranking.tsx:66) — só o organizador agenda, mesma audiência do dialog.
  const occupiedSlotsQuery = useQuery({
    ...crpc.tournament.matches.listOccupiedSlots.queryOptions({
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

  const publishResult = useMutation(
    crpc.tournament.matches.publishResult.mutationOptions({
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
    })
  );
  // IBX-0028: edição de resultado JÁ publicado. O CONFLICT do servidor
  // (partida seguinte já jogada) chega com a mensagem pronta — o toast
  // apenas a exibe. Sucesso refresha a chave via invalidateTournamentContext.
  const editResult = useMutation(
    crpc.tournament.matches.editResult.mutationOptions({
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
    })
  );
  const scheduleMatch = useMutation(
    crpc.tournament.matches.scheduleMatch.mutationOptions({
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
    })
  );

  const { mutate: swapSlotsMutate, isPending: isSwapPending } = useMutation(
    crpc.tournament.bracket.swapSlots.mutationOptions({
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
    })
  );

  const drawBracket = useMutation(
    crpc.tournament.bracket.draw.mutationOptions({
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
    })
  );

  const startTournament = useMutation(
    crpc.tournament.bracket.start.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível iniciar o torneio. Tente novamente."
          ),
          id: "start-tournament-error",
          label: "Falha ao iniciar",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateTournamentContext();
        toast.show({
          description: "A chave está pública e o torneio em andamento.",
          id: "start-tournament-success",
          label: "Torneio iniciado",
          variant: "success",
        });
      },
    })
  );

  const matchesWithSides = useMemo(
    () => buildMatchSides({ entriesById, matches }),
    [entriesById, matches]
  );

  const trees = useMemo(
    () => buildBracketCategoryTrees(matchesWithSides, categoriesById),
    [matchesWithSides, categoriesById]
  );

  const treeLayouts = useMemo(
    () =>
      trees.map((tree) => ({
        layout: layoutBracketCategoryTree(tree.columns, {
          // Card de bye tem altura FIXA (o próprio card a fixa na constante):
          // a linha não entra em cardHeights e a medida nunca commita.
          cardHeightOf: (match) =>
            cardHeights[match.id] ??
            (isByeMatch(match)
              ? BRACKET_BYE_CARD_HEIGHT
              : BRACKET_CARD_ESTIMATED_HEIGHT),
          cardWidth: CARD_WIDTH,
          connectorWidth: CONNECTOR_WIDTH,
          gapY: CARD_GAP_Y,
        }),
        tree,
      })),
    [trees, cardHeights]
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

  // Partidas FILHAS por "rodada:slot" (a coluna da árvore ativa). O ajuste usa
  // isto pra saber se o lado vazio de um card ainda espera o vencedor do
  // confronto de baixo (feed vivo = não aceita inscrição; só linha podada
  // aceita) e se a vaga é vitória propagada de um RESULTADO PUBLICADO (travada
  // — regra do Forja em 16/09).
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

  // Sonda temporária (BUG-0033): resumo do layout + retângulo/âncora por
  // card com a origem da altura, uma vez por estado de layout.
  useEffect(() => {
    if (!activeTreeLayout) {
      return;
    }

    const { layout: activeLayout, tree } = activeTreeLayout;
    const measured = activeLayout.cards.filter(
      (card) => cardHeights[card.match.id] !== undefined
    ).length;

    logBracketLayout({
      estimated: activeLayout.cards.length - measured,
      focusSeed: bracketFocusSeed,
      graphHeight: activeLayout.height,
      graphWidth: activeLayout.width,
      links: activeLayout.links.length,
      measured,
      tournamentId: String(tournamentId),
      treeId: tree.id,
    });
    logBracketRects({
      cards: activeLayout.cards.map((card) => ({
        anchorY: card.layout.y + card.layout.height / 2,
        height: card.layout.height,
        id: card.match.id,
        round: card.match.round,
        source:
          cardHeights[card.match.id] === undefined ? "estimate" : "measured",
        x: card.layout.x,
        y: card.layout.y,
      })),
      focusSeed: bracketFocusSeed,
      treeId: tree.id,
    });
  }, [activeTreeLayout, bracketFocusSeed, cardHeights, tournamentId]);

  const handleHeightChange = useCallback((matchId: string, height: number) => {
    // A altura EFETIVA de um card sem medida é a estimativa (o fallback do
    // layout), então medir a estimativa não mexe em nada e não entra no
    // state — é a lição IBX-0022 (montagem de 64 chaves sem cascata de
    // setState). Comparar com a constante em vez da altura efetiva congelava
    // o retângulo: um card commitado em 154 que volta a medir 136 (a linha
    // de agendamento sai do card) nunca re-alinhava e o conector ficava 9pt
    // fora do eixo (BUG-0033). commitCardHeight resolve os dois.
    setCardHeights((previous) =>
      commitCardHeight({ heights: previous, matchId, measured: height })
    );
  }, []);

  function handleCategoryChange(categoryId: string) {
    setActiveCategoryId(categoryId);
  }

  // O re-sorteio reconstrói a chave e apaga as partidas: com confronto
  // agendado (data, horário, quadra) ele morre junto, então a UI confirma
  // antes de disparar. Sem agendamento, dispara direto.
  function handleRedrawPress() {
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
    ({ match }: BracketTreeCardEntry) => (
      <BracketMatchCard
        isFinal={match.round === activeTreeLayout?.tree.columns.length}
        isOrganizer={isOrganizer}
        match={match}
        onEditResultPress={setEditTarget}
        onHeightChange={(height) => {
          // Card de bye: altura FIXA na constante do layout (o próprio card a
          // fixa), então a medida é sempre a mesma do retângulo e não entra no
          // state — commitar reintroduziria o churn de re-layout que o
          // BUG-0033 fechou.
          if (isByeMatch(match)) {
            return;
          }
          // Sonda temporária (BUG-0033): o card mediu uma altura diferente da
          // que o layout está usando. Com o guard antigo (comparação com a
          // constante) a medida que caía exatamente na estimativa era
          // descartada — oldGuardWouldDrop marca exatamente esse caso.
          const layoutHeight =
            cardHeights[match.id] ?? BRACKET_CARD_ESTIMATED_HEIGHT;
          if (height !== layoutHeight) {
            logBracketHeightMismatch({
              layoutHeight,
              matchId: match.id,
              measured: height,
              oldGuardWouldDrop: height === BRACKET_CARD_ESTIMATED_HEIGHT,
              round: match.round,
              treeId: activeTreeLayout?.tree.id ?? "?",
            });
          }
          handleHeightChange(match.id, height);
        }}
        onResultPress={(target) => {
          setResultTarget({ match: target });
        }}
        onSchedulePress={setScheduleTarget}
        onSidePress={handleSidePress}
        scheduleSummary={formatMatchScheduleSummary({
          courtName:
            tournament?.courts.find((court) => court.id === match.courtId)
              ?.name ?? null,
          matchDate: match.matchDate,
          startMinute: match.startMinute,
        })}
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
            feedBySlot.get(`${match.round - 1}:${match.slotInRound * 2 + 1}`) ??
            null,
          match,
          tournamentStatus,
        })}
      />
    ),
    [
      activeTreeLayout,
      cardHeights,
      feedBySlot,
      handleHeightChange,
      handleSidePress,
      isOrganizer,
      isSwapPending,
      swapTarget,
      tournament,
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
  const canDrawBracket = isOrganizer && tournament?.status === "published";
  // The draw skips categories with fewer than 2 active entries, so a listed
  // category may have no bracket: only offer tabs that render a tree.
  const categoryTabs = categories.filter((category) =>
    trees.some((tree) => tree.id === category.id)
  );
  const hasMultipleCategories = categoryTabs.length > 1;
  const canStartTournament = isOrganizer && tournament?.status === "drawn";
  const canRedrawBracket = canStartTournament;
  const hasBracketMenu =
    canDrawBracket || canRedrawBracket || canStartTournament;
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
                      {canDrawBracket ? (
                        <Menu.Item
                          onPress={() => {
                            drawBracket.mutate({ tournamentId });
                          }}
                        >
                          <Menu.ItemTitle>Sortear chave</Menu.ItemTitle>
                          <HugeIcons icon={ShuffleIcon} />
                        </Menu.Item>
                      ) : null}
                      {canRedrawBracket ? (
                        <Menu.Item
                          onPress={() => {
                            handleRedrawPress();
                          }}
                        >
                          <Menu.ItemTitle>Re-sortear</Menu.ItemTitle>
                          <HugeIcons icon={ShuffleIcon} />
                        </Menu.Item>
                      ) : null}
                      {canStartTournament ? (
                        <Menu.Item
                          onPress={() => {
                            setIsStartDialogOpen(true);
                          }}
                        >
                          <Menu.ItemTitle>Iniciar torneio</Menu.ItemTitle>
                          <HugeIcons icon={PlayIcon} />
                        </Menu.Item>
                      ) : null}
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
        // Remount per category and per tab focus: each entry starts framed
        // at its own fit (QA R18) with fresh gesture state.
        <BracketCanvas
          key={`${activeTreeLayout.tree.id}:${bracketFocusSeed}`}
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
        <ChallengeProposalDialog
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
              // Ghost minute: required by the deployed
              // ScheduleTournamentMatchSchema — the tournament UI has no
              // duration field (IBX-0030).
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

      <Dialog isOpen={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Iniciar torneio?</Dialog.Title>
            <Description>
              A chave será publicada e o torneio começa.
            </Description>
            <View className="flex-row gap-2 self-end">
              <Button
                onPress={() => {
                  setIsStartDialogOpen(false);
                }}
                size="sm"
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                isDisabled={startTournament.isPending}
                onPress={() => {
                  startTournament.mutate({ tournamentId });
                }}
                size="sm"
              >
                <Button.Label>Iniciar torneio</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog isOpen={isRedrawDialogOpen} onOpenChange={setIsRedrawDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Re-sortear a chave</Dialog.Title>
            <Description>
              As posições serão sorteadas de novo. Os confrontos já agendados
              serão apagados, com data, horário e quadra.
            </Description>
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
