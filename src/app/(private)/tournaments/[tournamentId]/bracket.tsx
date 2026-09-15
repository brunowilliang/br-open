import {
  CrownIcon,
  MoreVerticalIcon,
  PlayIcon,
  ShuffleIcon,
} from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Description,
  Dialog,
  Menu,
  Tabs,
  useToast,
} from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { ChallengeProposalDialog } from "@/components/pages/leagues/challenge-proposal-dialog";
import { BracketCanvas } from "@/components/pages/tournaments/bracket-canvas";
import {
  BracketMatchCard,
  type BracketSwapTarget,
} from "@/components/pages/tournaments/bracket-match-card";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  BRACKET_CARD_ESTIMATED_HEIGHT,
  buildBracketCategoryTrees,
  layoutBracketCategoryTree,
  type BracketTreeLayout,
} from "@/lib/tournaments/bracket-tree";
import {
  buildMatchSides,
  hasScheduledMatch,
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
  const router = useRouter();
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
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isRedrawDialogOpen, setIsRedrawDialogOpen] = useState(false);
  const isOrganizer = access?.canManage ?? false;
  useEffect(() => {
    bucket$.actions.setActiveRoute("bracket");
  }, [bucket$]);

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
          cardHeightOf: (match) =>
            cardHeights[match.id] ?? BRACKET_CARD_ESTIMATED_HEIGHT,
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

  const handleHeightChange = useCallback((matchId: string, height: number) => {
    // A card measuring exactly the estimate changes nothing in the layout
    // (the fallback IS the estimate), and committing it would fire up to 63
    // cascading setStates on a 64-key mount (the IBX-0022 measurement
    // lesson). Only real deltas land in state.
    if (height === BRACKET_CARD_ESTIMATED_HEIGHT) {
      return;
    }
    setCardHeights((previous) =>
      previous[matchId] === height
        ? previous
        : { ...previous, [matchId]: height }
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
      if (swapTarget === null) {
        setSwapTarget(target);
        return;
      }

      const isSameSide =
        swapTarget.match.id === target.match.id &&
        swapTarget.side === target.side;

      if (isSameSide) {
        setSwapTarget(null);
        return;
      }

      // Cross-category or cross-round picks would swap slots the backend
      // can't resolve (swap is same-round only) — restart the selection on
      // the new side instead.
      if (
        swapTarget.match.categoryId !== target.match.categoryId ||
        swapTarget.match.round !== target.match.round
      ) {
        setSwapTarget(target);
        return;
      }

      swapSlotsMutate({
        categoryId: target.match.categoryId,
        round: target.match.round,
        sideA: swapTarget.side,
        sideB: target.side,
        slotA: swapTarget.match.slotInRound,
        slotB: target.match.slotInRound,
        tournamentId,
      });
      setSwapTarget(null);
    },
    [swapTarget, swapSlotsMutate, tournamentId]
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
      />
    ),
    [
      activeTreeLayout,
      handleHeightChange,
      handleSidePress,
      isOrganizer,
      isSwapPending,
      swapTarget,
      tournament,
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
  // Cabeças de chave (seeds + fase de entrada) editam em published e drawn
  // (mudança em drawn vale no próximo sorteio).
  const canManageHeads = canDrawBracket || canRedrawBracket;
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
                      {canManageHeads ? (
                        <Menu.Item
                          onPress={() => {
                            router.navigate({
                              params: { initialTab: "confirmed", tournamentId },
                              pathname: "/tournaments/[tournamentId]/entries",
                            });
                          }}
                        >
                          <Menu.ItemTitle>Cabeças de chave</Menu.ItemTitle>
                          <HugeIcons icon={CrownIcon} />
                        </Menu.Item>
                      ) : null}
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
                            startTournament.mutate({ tournamentId });
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
        // Remount per category: each tree starts framed at its own fit
        // (QA R18) with fresh gesture state.
        <BracketCanvas
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
          occupiedSlots={[]}
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
