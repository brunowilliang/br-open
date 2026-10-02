import type {
  TournamentDiscovery,
  TournamentEntryWithPlayers,
  TournamentMatch,
} from "@convex/domains/tournament/contract";
import { Tabs, useThemeColor } from "heroui-native";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { BracketMatchCard } from "@/components/pages/tournaments/bracket-match-card";
import { CategorySelect } from "@/components/ui/category-select";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryCard } from "@/components/ui/entry-card";
import { MatchCard } from "@/components/ui/match-card";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  SCHEDULE_PERIOD_META,
  type SchedulePeriodKey,
} from "@/lib/scheduling/schedule-view";
import {
  bracketEdgeParts,
  type BracketEdgePart,
} from "@/lib/tournaments/bracket-edges";
import {
  BRACKET_BYE_CARD_HEIGHT,
  bracketMatchEstimatedHeight,
  buildBracketCategoryTrees,
  commitCardHeight,
  layoutBracketCategoryTree,
  type BracketCardHeights,
} from "@/lib/tournaments/bracket-tree";
import {
  buildMatchSides,
  isByeMatch,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import { buildScheduledMatchItems } from "@/lib/tournaments/schedule-items";
import {
  buildTournamentEntriesTabItems,
  formatBracketStage,
  formatEntryPlayerNames,
  resolveTournamentEntriesTab,
  type TournamentEntriesTab,
} from "@/lib/tournaments/tournament-details-derived";

import {
  buildGalleryEntry,
  buildGalleryMatch,
  galleryMatchDate,
  GALLERY_COURT,
  GALLERY_PLAYERS,
  type GalleryRole,
} from "./gallery-fixtures";

export type GalleryScreenName = "bracket" | "entries" | "schedule";

export type GalleryScreenCell = {
  categories: TournamentDiscovery["categories"];
  cellId: string;
  courts: TournamentDiscovery["courts"];
  role: GalleryRole;
};

type GalleryScreenProps = {
  cell: GalleryScreenCell;
  onBack: () => void;
};

const SCREEN_PERIOD_ORDER: SchedulePeriodKey[] = [
  "morning",
  "afternoon",
  "evening",
];

// Espelha o desenho da chave real (mesmos builders e mesmas medidas de grafo);
// o que fica de fora é só o gesto do canvas (zoom/pan), que é interação, não
// conteúdo.
const SCREEN_BRACKET_CARD_WIDTH = 320;
const SCREEN_BRACKET_CONNECTOR_WIDTH = 32;
const SCREEN_BRACKET_CARD_GAP_Y = 12;
const SCREEN_BRACKET_EDGE_STROKE = 1.5;

/** Entradas e confrontos das telas de vitrine: um quadro de 4 por categoria,
 * com semifinais decidida/agendada e a final esperando o vencedor — é o que dá
 * conteúdo à Chave e à Agenda (as finais sem data não entram na agenda). */
function buildScreenMatchFixture(cell: GalleryScreenCell): {
  entries: TournamentEntryWithPlayers[];
  matches: TournamentMatch[];
} {
  const entryId = (key: string) => `${cell.cellId}-entry-${key}`;
  const entries = [
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "screen-misto-1",
      playerA: GALLERY_PLAYERS.ana,
      playerB: GALLERY_PLAYERS.diego,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "screen-misto-2",
      playerA: GALLERY_PLAYERS.marina,
      playerB: GALLERY_PLAYERS.rafael,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "screen-misto-3",
      playerA: GALLERY_PLAYERS.camila,
      playerB: GALLERY_PLAYERS.carlos,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "screen-misto-4",
      playerA: GALLERY_PLAYERS.juliana,
      playerB: GALLERY_PLAYERS.gustavo,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "screen-fem-1",
      playerA: GALLERY_PLAYERS.ana,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "screen-fem-2",
      playerA: GALLERY_PLAYERS.camila,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "screen-fem-3",
      playerA: GALLERY_PLAYERS.marina,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "screen-fem-4",
      playerA: GALLERY_PLAYERS.juliana,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "screen-masc-1",
      playerA: GALLERY_PLAYERS.carlos,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "screen-masc-2",
      playerA: GALLERY_PLAYERS.pedro,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "screen-masc-3",
      playerA: GALLERY_PLAYERS.diego,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "screen-masc-4",
      playerA: GALLERY_PLAYERS.rafael,
      playerB: null,
      status: "active",
    }),
  ];
  const winner = (key: string) => entryId(`screen-${key}`);
  const game = (input: {
    courtId: null | string;
    endMinute: null | number;
    entryAKey: string;
    entryBKey: null | string;
    key: string;
    matchDate: null | string;
    round: 1 | 2;
    score: null | TournamentMatch["score"];
    startMinute: null | number;
    status: TournamentMatch["status"];
    winnerKey: null | string;
    categoryKey: "feminino" | "masculino" | "misto";
  }) =>
    buildGalleryMatch({
      categoryKey: input.categoryKey,
      cellId: cell.cellId,
      courtId: input.courtId,
      endMinute: input.endMinute,
      entryAId: entryId(`screen-${input.entryAKey}`),
      entryBId:
        input.entryBKey === null ? null : entryId(`screen-${input.entryBKey}`),
      key: `screen-${input.key}`,
      matchDate: input.matchDate,
      round: input.round,
      score: input.score,
      startMinute: input.startMinute,
      status: input.status,
      winnerEntryId: input.winnerKey === null ? null : winner(input.winnerKey),
    });

  return {
    entries,
    matches: [
      // Misto: semifinal 1 decidida, semifinal 2 marcada e a final em aberto.
      game({
        categoryKey: "misto",
        courtId: GALLERY_COURT.id,
        endMinute: 600,
        entryAKey: "misto-1",
        entryBKey: "misto-2",
        key: "misto-semi-1",
        matchDate: galleryMatchDate(0),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 4, kind: "set" },
            { aGames: 3, bGames: 6, kind: "set" },
            { aGames: 6, bGames: 2, kind: "set" },
          ],
          winnerEntryId: winner("misto-1"),
        },
        startMinute: 540,
        status: "finished",
        winnerKey: "misto-1",
      }),
      game({
        categoryKey: "misto",
        courtId: GALLERY_COURT.id,
        endMinute: 900,
        entryAKey: "misto-3",
        entryBKey: "misto-4",
        key: "misto-semi-2",
        matchDate: galleryMatchDate(0),
        round: 1,
        score: null,
        startMinute: 840,
        status: "scheduled",
        winnerKey: null,
      }),
      game({
        categoryKey: "misto",
        courtId: null,
        endMinute: null,
        entryAKey: "misto-1",
        entryBKey: null,
        key: "misto-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerKey: null,
      }),
      // Feminino: mesma forma, com a semifinal 2 já marcada para amanhã.
      game({
        categoryKey: "feminino",
        courtId: GALLERY_COURT.id,
        endMinute: 720,
        entryAKey: "fem-1",
        entryBKey: "fem-2",
        key: "fem-semi-1",
        matchDate: galleryMatchDate(0),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 2, kind: "set" },
            { aGames: 6, bGames: 3, kind: "set" },
          ],
          winnerEntryId: winner("fem-1"),
        },
        startMinute: 630,
        status: "finished",
        winnerKey: "fem-1",
      }),
      game({
        categoryKey: "feminino",
        courtId: GALLERY_COURT.id,
        endMinute: 600,
        entryAKey: "fem-3",
        entryBKey: "fem-4",
        key: "fem-semi-2",
        matchDate: galleryMatchDate(1),
        round: 1,
        score: null,
        startMinute: 540,
        status: "scheduled",
        winnerKey: null,
      }),
      game({
        categoryKey: "feminino",
        courtId: null,
        endMinute: null,
        entryAKey: "fem-1",
        entryBKey: null,
        key: "fem-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerKey: null,
      }),
      // Masculino: a semifinal 2 fecha a agenda de amanhã, à noite.
      game({
        categoryKey: "masculino",
        courtId: GALLERY_COURT.id,
        endMinute: 720,
        entryAKey: "masc-1",
        entryBKey: "masc-2",
        key: "masc-semi-1",
        matchDate: galleryMatchDate(0),
        round: 1,
        score: {
          sets: [
            { aGames: 6, bGames: 4, kind: "set" },
            { aGames: 6, bGames: 1, kind: "set" },
          ],
          winnerEntryId: winner("masc-1"),
        },
        startMinute: 660,
        status: "finished",
        winnerKey: "masc-1",
      }),
      game({
        categoryKey: "masculino",
        courtId: GALLERY_COURT.id,
        endMinute: 1200,
        entryAKey: "masc-3",
        entryBKey: "masc-4",
        key: "masc-semi-2",
        matchDate: galleryMatchDate(1),
        round: 1,
        score: null,
        startMinute: 1140,
        status: "scheduled",
        winnerKey: null,
      }),
      game({
        categoryKey: "masculino",
        courtId: null,
        endMinute: null,
        entryAKey: "masc-1",
        entryBKey: null,
        key: "masc-final",
        matchDate: null,
        round: 2,
        score: null,
        startMinute: null,
        status: "pending",
        winnerKey: null,
      }),
    ],
  };
}

/** Catálogo da tela de Inscrições: a MESMA lista de vitrine com os status que
 * cada segmento mostra (a Chave usa a fixture própria, toda ativa). */
function buildScreenEntriesFixture(cell: GalleryScreenCell): {
  confirmed: TournamentEntryWithPlayers[];
  mine: TournamentEntryWithPlayers[];
  pending: TournamentEntryWithPlayers[];
} {
  const entries = [
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "list-misto-1",
      playerA: GALLERY_PLAYERS.ana,
      playerB: GALLERY_PLAYERS.diego,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "list-misto-2",
      playerA: GALLERY_PLAYERS.marina,
      playerB: GALLERY_PLAYERS.rafael,
      status: "awaiting_payment",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "list-misto-3",
      playerA: GALLERY_PLAYERS.camila,
      playerB: GALLERY_PLAYERS.carlos,
      status: "pending_approval",
    }),
    buildGalleryEntry({
      categoryKey: "misto",
      cellId: cell.cellId,
      key: "list-misto-4",
      playerA: GALLERY_PLAYERS.juliana,
      playerB: GALLERY_PLAYERS.gustavo,
      status: "pending_partner",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "list-fem-1",
      playerA: GALLERY_PLAYERS.ana,
      playerB: null,
      status: "awaiting_payment",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "list-fem-2",
      playerA: GALLERY_PLAYERS.camila,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "list-fem-3",
      playerA: GALLERY_PLAYERS.marina,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "feminino",
      cellId: cell.cellId,
      key: "list-fem-4",
      playerA: GALLERY_PLAYERS.juliana,
      playerB: null,
      status: "pending_approval",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "list-masc-1",
      playerA: GALLERY_PLAYERS.carlos,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "list-masc-2",
      playerA: GALLERY_PLAYERS.pedro,
      playerB: null,
      status: "pending_approval",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "list-masc-3",
      playerA: GALLERY_PLAYERS.diego,
      playerB: null,
      status: "active",
    }),
    buildGalleryEntry({
      categoryKey: "masculino",
      cellId: cell.cellId,
      key: "list-masc-4",
      playerA: GALLERY_PLAYERS.rafael,
      playerB: null,
      status: "awaiting_payment",
    }),
  ];
  // O viewer das telas é a Ana, a mesma da casa: o segmento "Minhas" mostra as
  // inscrições dela (uma viva e uma esperando pagamento).
  const viewerEntryIds = new Set([
    `${cell.cellId}-entry-list-misto-1`,
    `${cell.cellId}-entry-list-fem-1`,
  ]);

  return {
    confirmed: entries.filter((entry) => entry.status === "active"),
    mine: entries.filter((entry) => viewerEntryIds.has(entry.id)),
    pending: entries.filter(
      (entry) =>
        entry.status === "awaiting_payment" ||
        entry.status === "pending_approval" ||
        entry.status === "pending_partner"
    ),
  };
}

function GalleryScreenHeader(props: {
  children?: ReactNode;
  onBack: () => void;
  title: string;
}) {
  return (
    <Page.Header>
      <View className="flex-1 flex-col gap-2">
        <View className="flex-1 flex-row items-center">
          <Page.Header.Left>
            <Page.Header.BackButton
              onPress={props.onBack}
              variant="secondary"
            />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>{props.title}</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </View>
        {props.children}
      </View>
    </Page.Header>
  );
}

/** Chave de vitrine: o grafo da chave real (layout e conectores compartilhados)
 * com os cards sem menu e sem troca de lado. */
export function GalleryBracketScreen({ cell, onBack }: GalleryScreenProps) {
  const fixture = useMemo(() => buildScreenMatchFixture(cell), [cell]);
  const entriesById = useMemo(
    () => Object.fromEntries(fixture.entries.map((entry) => [entry.id, entry])),
    [fixture]
  );
  const matchesWithSides = useMemo(
    () => buildMatchSides({ entriesById, matches: fixture.matches }),
    [entriesById, fixture]
  );
  const categoriesById = useMemo(
    () =>
      Object.fromEntries(
        cell.categories.map((category) => [category.id, category])
      ),
    [cell.categories]
  );
  const trees = useMemo(
    () => buildBracketCategoryTrees(matchesWithSides, categoriesById),
    [categoriesById, matchesWithSides]
  );
  const [cardHeights, setCardHeights] = useState<BracketCardHeights>({});
  const [activeCategoryId, setActiveCategoryId] = useState<null | string>(null);
  const activeTree =
    trees.find((tree) => tree.id === activeCategoryId) ?? trees[0] ?? null;
  const modalityOf = useCallback(
    (match: TournamentMatchWithSides) =>
      categoriesById[match.categoryId]?.modality === "doubles"
        ? "doubles"
        : "singles",
    [categoriesById]
  );
  const courtNameOf = useCallback(
    (match: TournamentMatchWithSides) =>
      match.courtId
        ? (cell.courts.find((court) => court.id === match.courtId)?.name ??
          null)
        : null,
    [cell.courts]
  );
  const layout = useMemo(
    () =>
      activeTree
        ? layoutBracketCategoryTree(activeTree.columns, {
            cardHeightOf: (match) =>
              cardHeights[match.id] ??
              (isByeMatch(match)
                ? BRACKET_BYE_CARD_HEIGHT
                : bracketMatchEstimatedHeight({
                    courtName: courtNameOf(match),
                    matchDate: match.matchDate,
                    modality: modalityOf(match),
                  })),
            cardWidth: SCREEN_BRACKET_CARD_WIDTH,
            connectorWidth: SCREEN_BRACKET_CONNECTOR_WIDTH,
            gapY: SCREEN_BRACKET_CARD_GAP_Y,
          })
        : null,
    [activeTree, cardHeights, courtNameOf, modalityOf]
  );
  const edgeParts = useMemo(() => {
    if (!layout) {
      return [];
    }

    const cardsById = new Map(
      layout.cards.map((card) => [card.match.id, card])
    );
    const parts: Array<{ key: string; part: BracketEdgePart }> = [];

    for (const link of layout.links) {
      const from = cardsById.get(link.from);
      const to = cardsById.get(link.to);

      if (!(from && to)) {
        continue;
      }

      for (const part of bracketEdgeParts({
        from: from.layout,
        thickness: SCREEN_BRACKET_EDGE_STROKE,
        to: to.layout,
      })) {
        parts.push({ key: `${link.from}>${link.to}:${parts.length}`, part });
      }
    }

    return parts;
  }, [layout]);
  const edgeTint = useThemeColor("muted");

  return (
    <Page>
      <GalleryScreenHeader onBack={onBack} title="Chaveamento">
        {trees.length > 1 && activeTree ? (
          <CategorySelect
            categories={cell.categories}
            onChange={setActiveCategoryId}
            tabMode="type"
            value={activeTree.id}
          />
        ) : null}
      </GalleryScreenHeader>

      {layout && activeTree ? (
        <ScrollView
          className="flex-1"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <ScrollView contentContainerClassName="p-4">
            <View style={{ height: layout.height, width: layout.width }}>
              {edgeParts.map(({ key, part }) => (
                <View
                  key={key}
                  pointerEvents="none"
                  style={{
                    backgroundColor: edgeTint,
                    height: part.height,
                    left: part.x,
                    position: "absolute",
                    top: part.y,
                    width: part.width,
                  }}
                />
              ))}
              {layout.cards.map(({ layout: box, match }) => (
                <View
                  key={match.id}
                  style={{
                    left: box.x,
                    position: "absolute",
                    top: box.y,
                    width: box.width,
                  }}
                >
                  <BracketMatchCard
                    agreement={null}
                    canReserveSlot={false}
                    courtName={courtNameOf(match)}
                    isConclusionPending={false}
                    isFinal={match.round === activeTree.columns.length}
                    isOrganizer={false}
                    isTournamentClosed={false}
                    match={match}
                    modality={modalityOf(match)}
                    onHeightChange={(height) => {
                      setCardHeights((previous) =>
                        commitCardHeight({
                          estimatedHeight: isByeMatch(match)
                            ? BRACKET_BYE_CARD_HEIGHT
                            : bracketMatchEstimatedHeight({
                                courtName: courtNameOf(match),
                                matchDate: match.matchDate,
                                modality: modalityOf(match),
                              }),
                          heights: previous,
                          matchId: match.id,
                          measured: height,
                        })
                      );
                    }}
                    onMenuAction={() => undefined}
                    onSidePress={() => undefined}
                    selectedSide={null}
                    stageLabel={formatBracketStage(
                      match.round,
                      activeTree.columns.length
                    )}
                    swapDisabled={false}
                    swapPickEnabled={{ a: false, b: false }}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : null}
    </Page>
  );
}

/** Agenda de vitrine: as tabs de dia e os períodos da agenda real, com os jogos
 * da chave da mesma célula (os cards saem sem o acerto/menu). */
export function GalleryScheduleScreen({ cell, onBack }: GalleryScreenProps) {
  const fixture = useMemo(() => buildScreenMatchFixture(cell), [cell]);
  const entriesById = useMemo(
    () => Object.fromEntries(fixture.entries.map((entry) => [entry.id, entry])),
    [fixture]
  );
  const items = useMemo(
    () =>
      buildScheduledMatchItems({
        courts: cell.courts,
        entriesById,
        matches: fixture.matches,
      }),
    [cell.courts, entriesById, fixture]
  );
  const todayDayKey = galleryMatchDate(0);
  const dateTabs = useMemo(
    () => buildScheduleDateTabs({ todayDayKey, windowDays: 7 }),
    [todayDayKey]
  );
  const [activeDate, setActiveDate] = useState(todayDayKey);
  const dayView = useMemo(
    () => buildScheduleDayView({ challenges: items, matchDate: activeDate }),
    [activeDate, items]
  );
  const hasDayItems = SCREEN_PERIOD_ORDER.some(
    (period) => dayView[period].length > 0
  );

  return (
    <Page>
      <GalleryScreenHeader onBack={onBack} title="Agenda">
        <Tabs
          onValueChange={(value) => {
            setActiveDate(value);
          }}
          value={activeDate}
        >
          <Tabs.List>
            <Tabs.ScrollView>
              <Tabs.Indicator />
              {dateTabs.map((tab) => (
                <Tabs.Trigger key={tab.matchDate} value={tab.matchDate}>
                  <Tabs.Label>{tab.label}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.ScrollView>
          </Tabs.List>
        </Tabs>
      </GalleryScreenHeader>

      <Page.ScrollView
        contentContainerClassName="grow gap-3 px-4 pb-safe-offset-4"
        showsVerticalScrollIndicator={false}
      >
        {hasDayItems ? (
          SCREEN_PERIOD_ORDER.map((period) => {
            const periodItems = dayView[period];

            if (periodItems.length === 0) {
              return null;
            }

            return (
              <View className="gap-2" key={period}>
                <Text color="muted" variant="description" weight="medium">
                  {SCHEDULE_PERIOD_META[period].label}
                </Text>
                <View className="gap-2">
                  {periodItems.map((item) => (
                    <MatchCard
                      challengedAvatarUrl={item.sideBAvatarUrl}
                      challengedName={item.sideBName}
                      challengedPartnerAvatarUrl={item.sideBPartnerAvatarUrl}
                      challengedPartnerName={item.sideBPartnerName}
                      challengerAvatarUrl={item.sideAAvatarUrl}
                      challengerName={item.sideAName}
                      challengerPartnerAvatarUrl={item.sideAPartnerAvatarUrl}
                      challengerPartnerName={item.sideAPartnerName}
                      courtName={item.courtName}
                      key={item.id}
                      matchDate={item.matchDate}
                      matchStatus={item.matchStatus}
                      scoreSets={item.scoreSets}
                      stageLabel={item.stageLabel}
                      startMinute={item.startMinute}
                      walkoverWinner={item.walkoverWinner}
                    />
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            description="Veja os jogos nos outros dias da agenda."
            title="Nenhum jogo neste dia"
          />
        )}
      </Page.ScrollView>
    </Page>
  );
}

/** Inscrições de vitrine: os segmentos do papel resolvido (lista real) com o
 * catálogo de status e os cards SEM as ações (aprovar, pagar, cancelar). */
export function GalleryEntriesScreen({ cell, onBack }: GalleryScreenProps) {
  const fixture = useMemo(() => buildScreenEntriesFixture(cell), [cell]);
  const categoriesById = useMemo(
    () =>
      Object.fromEntries(
        cell.categories.map((category) => [category.id, category])
      ),
    [cell.categories]
  );
  const tabItems = buildTournamentEntriesTabItems({ role: cell.role });
  const [userTab, setUserTab] = useState<null | TournamentEntriesTab>(null);
  const activeTab = resolveTournamentEntriesTab({
    role: cell.role,
    userTab,
  });
  const visibleEntries =
    activeTab === "pending"
      ? fixture.pending
      : activeTab === "mine"
        ? fixture.mine
        : fixture.confirmed;

  return (
    <Page>
      <GalleryScreenHeader onBack={onBack} title="Inscrições">
        {tabItems.length > 1 ? (
          <Tabs
            onValueChange={(value) => {
              setUserTab(value as TournamentEntriesTab);
            }}
            value={activeTab}
          >
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                {tabItems.map((item) => (
                  <Tabs.Trigger key={item.value} value={item.value}>
                    <Tabs.Label>{item.label}</Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.ScrollView>
            </Tabs.List>
          </Tabs>
        ) : null}
      </GalleryScreenHeader>

      <Page.ScrollView
        contentContainerClassName="grow gap-2 px-4 pb-safe-offset-4"
        showsVerticalScrollIndicator={false}
      >
        {visibleEntries.map((entry) => {
          const names = formatEntryPlayerNames(entry);

          return (
            <EntryCard
              categoryLabel={categoriesById[entry.categoryId]?.name ?? null}
              entryStatus={entry.status}
              key={entry.id}
              noteLabel={
                entry.status === "pending_partner"
                  ? "Aguardando @gustavo.lima aceitar o convite."
                  : null
              }
              partnerAvatarUrl={entry.playerB?.avatarUrl ?? null}
              partnerName={names[1] ?? null}
              playerAvatarUrl={entry.playerA?.avatarUrl ?? null}
              playerName={names[0] ?? ""}
            />
          );
        })}
      </Page.ScrollView>
    </Page>
  );
}
