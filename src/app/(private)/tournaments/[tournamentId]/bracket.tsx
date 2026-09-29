import { MoreVerticalIcon, ShuffleIcon } from "@hugeicons/core-free-icons";
import { useValue } from "@legendapp/state/react";
import { useMutation } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Dialog, Menu, useToast } from "heroui-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import {
  floatingTabBarHeight$,
  getFloatingTabBarSpacing,
} from "@/lib/navigation/floating-tab-bar-layout";

import { BracketCanvas } from "@/components/pages/tournaments/bracket-canvas";
import { BracketMatchCard } from "@/components/pages/tournaments/bracket-match-card";
import {
  buildPlayerAgreementCard,
  useMatchAgreement,
  useMatchAgreementView,
  type RunMatchAgreementAction,
} from "@/components/pages/tournaments/match-agreement-provider";
import {
  buildOrganizerMatchActionRequest,
  useOrganizerActions,
  useTournamentContextInvalidation,
} from "@/components/pages/tournaments/organizer-actions";
import { CategorySelect } from "@/components/ui/category-select";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
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
} from "@/lib/tournaments/tournament-details-derived";
import { isMatchAgreementLocked } from "@/lib/tournaments/match-agreement-view";
import {
  buildMatchSlotKey,
  canReserveUnreadySlot,
  type OrganizerMatchMenuKind,
} from "@/lib/tournaments/organizer-match-menu";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

/** Card da chave + espaço do cotovelo entre rodadas (uniwind rem = 16). O card
 * na tela é governado pelo ZOOM de abertura (uma coluna): em 320 ele nasce
 * ~1:1, então o desenho aprovado aparece no tamanho dele. */
const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 32;
const CARD_GAP_Y = 12;

type BracketTreeCardEntry = BracketTreeLayout["cards"][number];

export default function TournamentBracketRoute() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  // Alturas flutuantes que a abertura da chave desconta (o header com o seletor
  // de categorias e a barra de navegação de baixo): o header se mede aqui porque o
  // `Page` é filho deste mesmo componente (o contexto da Page nasce daqui pra
  // dentro); a barra é irmã da tela e publica a altura dela no store.
  const [headerHeight, setHeaderHeight] = useState(0);
  const floatingTabBarHeight = useValue(floatingTabBarHeight$);
  const insets = useSafeAreaInsets();
  const bottomInset = getFloatingTabBarSpacing({
    bottomInset: insets.bottom,
    height: floatingTabBarHeight,
  });
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const access = useValue(bucket$.derived.access);
  const tournament = useValue(bucket$.data.tournament);
  const matches = useValue(bucket$.data.matches);
  const entriesById = useValue(bucket$.derived.entriesById);
  const categoriesById = useValue(bucket$.derived.categoriesById);

  const { runAction } = useMatchAgreement();
  const { run } = useOrganizerActions();
  const { byMatchId: myMatchesByMatchId } = useMatchAgreementView(tournamentId);
  // O host do acerto vive no casco privado e não conhece a tela: quem sabe o
  // torneio do nó é o card, então o id vai junto na ação.
  const runAgreementAction = useCallback<RunMatchAgreementAction>(
    (request) => {
      runAction({ ...request, tournamentId });
    },
    [runAction, tournamentId]
  );
  const [swapTarget, setSwapTarget] = useState<BracketSwapTarget | null>(null);
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
  // Encerrado ou cancelado não aceita mais ação de partida no servidor
  // (publishResult exige ongoing): o nó nasce sem menu.
  const isTournamentClosed =
    tournamentStatus === "finished" || tournamentStatus === "cancelled";
  // A pendência de CONCLUIR (toda categoria com campeão) sai do bucket, já
  // recortada para este torneio: é dela que nasce o item do menu da final.
  const tournamentPendings = useValue(bucket$.derived.pendings);
  const isConclusionPending = tournamentPendings.some(
    (item) => item.kind === "organization_tournament_awaiting_conclusion"
  );
  useEffect(() => {
    bucket$.actions.setActiveRoute("bracket");
  }, [bucket$]);

  const invalidateTournamentContext =
    useTournamentContextInvalidation(tournamentId);

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

  // Chave de toda vaga da chave: é dela que sai o "reservar" da semi/final
  // (mesmo predicado da agenda, sobre o MESMO conjunto de partidas).
  const bracketSlotKeys = useMemo(
    () =>
      new Set(
        matchesWithSides.map((match) =>
          buildMatchSlotKey({
            categoryId: match.categoryId,
            round: match.round,
            slotInRound: match.slotInRound,
          })
        )
      ),
    [matchesWithSides]
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

  // One category on the canvas at a time; the category select picks which.
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

  // `run` é estável (mutate do TanStack e tournamentId não trocam): os handlers
  // entram na lista do `renderCard` sem mudar de identidade a cada render (o
  // canvas depende disso). O VERBO do menu vem do builder por papel: a tela só
  // leva o kind até o host, exatamente como a agenda.
  const handleMenuAction = useCallback(
    (kind: OrganizerMatchMenuKind, match: TournamentMatchWithSides) => {
      run(buildOrganizerMatchActionRequest({ kind, matchId: match.id }));
    },
    [run]
  );

  // Stable identity across gesture-end canvas re-renders: the canvas only
  // re-renders its edges then, so cards skip reconciliation entirely.
  const bracketCourts = tournament?.courts;

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

      const playerMatch = myMatchesByMatchId[match.id] ?? null;
      // Acima da 1ª rodada com as DUAS filhas na chave: é a vaga que o
      // organizador reserva antes de saber quem joga (regra compartilhada com o
      // servidor e com a agenda).
      const canReserveSlot = canReserveUnreadySlot({
        categoryId: match.categoryId,
        matchRound: match.round,
        slotInRound: match.slotInRound,
        slotKeys: bracketSlotKeys,
      });

      return (
        <BracketMatchCard
          agreement={
            playerMatch
              ? buildPlayerAgreementCard({
                  courts: bracketCourts ?? [],
                  isMatchLocked: isMatchAgreementLocked({
                    matchStatus: match.status,
                    tournamentStatus,
                    winnerEntryId: match.winnerEntryId,
                  }),
                  playerMatch,
                  runAction: runAgreementAction,
                  sideOrder: "match",
                  tournamentStatus,
                })
              : null
          }
          canReserveSlot={canReserveSlot}
          courtName={courtName}
          isConclusionPending={isConclusionPending}
          isFinal={match.round === activeTreeLayout?.tree.columns.length}
          isOrganizer={isOrganizer}
          isTournamentClosed={isTournamentClosed}
          match={match}
          modality={modality}
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
          onMenuAction={(kind) => {
            handleMenuAction(kind, match);
          }}
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
      bracketCourts,
      bracketSlotKeys,
      courtNameOf,
      feedBySlot,
      handleHeightChange,
      handleMenuAction,
      handleSidePress,
      isConclusionPending,
      isOrganizer,
      isSwapPending,
      isTournamentClosed,
      myMatchesByMatchId,
      runAgreementAction,
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
          bracketReleaseAtMs: tournament.bracketReleaseAt,
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
  // category may have no bracket: the select only offers the ones with a tree.
  const selectableCategories = categories.filter((category) =>
    trees.some((tree) => tree.id === category.id)
  );
  const hasMultipleCategories = selectableCategories.length > 1;
  return (
    <Page>
      <Page.Header
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setHeaderHeight((current) => (current === height ? current : height));
        }}
      >
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
            <CategorySelect
              categories={selectableCategories}
              onChange={handleCategoryChange}
              tabMode="type"
              value={activeTreeLayout.tree.id}
            />
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
          bottomInset={bottomInset}
          cardWidth={CARD_WIDTH}
          connectorWidth={CONNECTOR_WIDTH}
          focusSeed={bracketFocusSeed}
          headerInset={headerHeight}
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
