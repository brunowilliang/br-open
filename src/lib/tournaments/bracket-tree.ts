import type { TournamentMatchWithSides } from "./bracket-view";

/**
 * Rounds of one category: index 0 = round 1, matches sorted by slotInRound.
 * Parent of (round r, slot s) receives children (r-1, 2s) and (r-1, 2s+1)
 * — the slot mapping used by the backend buildBracket.
 */
export type BracketCategoryColumns = TournamentMatchWithSides[][];

export type BracketCategoryTree = {
  columns: BracketCategoryColumns;
  id: string;
  label: string;
};

export type BracketTreeCardLayout = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type BracketTreeLink = {
  /** Match feeding the connector (child card). */
  from: string;
  /** Match receiving it (parent card, next round). */
  to: string;
};

export type BracketTreeLayout = {
  cards: Array<{
    layout: BracketTreeCardLayout;
    match: TournamentMatchWithSides;
  }>;
  height: number;
  links: BracketTreeLink[];
  width: number;
};

/** Screen points the canvas keeps clear around the graph when fitting. */
export const BRACKET_FIT_VIEW_PADDING = 24;

/**
 * The exact zoom a centered fit of one bracket tree lands on: the formula
 * Flow's fitView uses, without its floor — the caller passes it back as
 * minZoom, so pinching out stops exactly at the framed graph instead of
 * shrinking it into dust. Capped at 1 because the canvas never upscales.
 */
export function bracketFitZoom(input: {
  graphHeight: number;
  graphWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}): number | null {
  if (
    input.graphHeight <= 0 ||
    input.graphWidth <= 0 ||
    input.viewportHeight <= 0 ||
    input.viewportWidth <= 0
  ) {
    return null;
  }

  return Math.min(
    (input.viewportWidth - BRACKET_FIT_VIEW_PADDING * 2) / input.graphWidth,
    (input.viewportHeight - BRACKET_FIT_VIEW_PADDING * 2) / input.graphHeight,
    1
  );
}

/** Screen band of the graph that stays visible at the pan limits (QA R20). */
export const PAN_VISIBILITY_BAND = 24;

/**
 * Keeps a translated/scaled graph inside the viewport: at the drag limit the
 * graph edge rests `PAN_VISIBILITY_BAND` inside the screen edge, on either
 * axis, at any zoom. The graph spans [0..graphWidth]x[0..graphHeight], the
 * mapping is screen = translate + zoom * graph.
 */
export function clampPanToViewport(input: {
  graphHeight: number;
  graphWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  x: number;
  y: number;
  zoom: number;
}): { x: number; y: number } {
  "worklet";
  return {
    x: Math.min(
      Math.max(input.x, PAN_VISIBILITY_BAND - input.zoom * input.graphWidth),
      input.viewportWidth - PAN_VISIBILITY_BAND
    ),
    y: Math.min(
      Math.max(input.y, PAN_VISIBILITY_BAND - input.zoom * input.graphHeight),
      input.viewportHeight - PAN_VISIBILITY_BAND
    ),
  };
}

/**
 * The translate that keeps the graph point under the fingers at gesture
 * start pinned under the fingers now, while the zoom moves from `fromScale`
 * to `toScale` (the zoom-toolkit focal-follow core, in this canvas's
 * absolute frame: t1 = f1 - (f0 - t0) * k1/k0). Anchoring on the point
 * under the CURRENT focal instead would freeze a two-finger drag in place —
 * the fingers must carry the content they grabbed. Invariants, pinned by
 * unit tests: a pure zoom keeps the start focal fixed on screen; a moving
 * focal with unchanged zoom translates by exactly the focal delta; the two
 * compose into one gesture.
 */
export function pinchFollowTransform(input: {
  focalX: number;
  focalY: number;
  fromScale: number;
  fromX: number;
  fromY: number;
  startFocalX: number;
  startFocalY: number;
  toScale: number;
}): { x: number; y: number } {
  "worklet";
  const ratio = input.toScale / input.fromScale;
  return {
    x: input.focalX - (input.startFocalX - input.fromX) * ratio,
    y: input.focalY - (input.startFocalY - input.fromY) * ratio,
  };
}

/** Fallback before onLayout reports the real card height. */
export const BRACKET_CARD_ESTIMATED_HEIGHT = 136;

type BracketTreeSizing = {
  cardHeightOf: (match: TournamentMatchWithSides) => number;
  cardWidth: number;
  connectorWidth: number;
  gapY: number;
};

/**
 * Groups matches per category, each category with its own round columns
 * (round ascending, matches by slotInRound) — connectors stay inside one
 * category instead of crossing categories like the old mixed columns.
 */
export function buildBracketCategoryTrees(
  matches: TournamentMatchWithSides[],
  categoriesById: Record<string, { displayName?: string; id: string }> = {}
): BracketCategoryTree[] {
  const byCategory = new Map<string, TournamentMatchWithSides[]>();

  for (const match of matches) {
    const list = byCategory.get(match.categoryId) ?? [];
    list.push(match);
    byCategory.set(match.categoryId, list);
  }

  const trees: BracketCategoryTree[] = [];

  for (const [categoryId, categoryMatches] of byCategory) {
    const rounds = new Map<number, TournamentMatchWithSides[]>();

    for (const match of categoryMatches) {
      const round = rounds.get(match.round) ?? [];
      round.push(match);
      rounds.set(match.round, round);
    }

    trees.push({
      columns: [...rounds.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, roundMatches]) =>
          [...roundMatches].sort(
            (left, right) => left.slotInRound - right.slotInRound
          )
        ),
      id: categoryId,
      label: categoriesById[categoryId]?.displayName ?? categoryId,
    });
  }

  return trees;
}

/**
 * Lays out one category tree as absolute card positions plus child->parent
 * match links for the canvas edges.
 */
export function layoutBracketCategoryTree(
  tree: BracketCategoryColumns,
  sizing: BracketTreeSizing
): BracketTreeLayout {
  const { cardHeightOf, cardWidth, connectorWidth, gapY } = sizing;
  const cards: BracketTreeLayout["cards"] = [];
  const links: BracketTreeLink[] = [];

  if (tree.length === 0) {
    return { cards, height: 0, links, width: 0 };
  }

  // centers[roundIndex][slotInRound] = vertical center of that card.
  const centers: number[][] = [];
  const cardById = new Map<string, BracketTreeLayout["cards"][number]>();

  tree.forEach((roundMatches, roundIndex) => {
    let roundPreviousBottom = 0;

    roundMatches.forEach((match, slotInRound) => {
      const height = cardHeightOf(match);
      const x = roundIndex * (cardWidth + connectorWidth);
      let y = 0;
      let center = 0;

      if (roundIndex === 0) {
        center = roundPreviousBottom + height / 2;
        y = roundPreviousBottom;
      } else {
        const childCenters = centers[roundIndex - 1] ?? [];
        const childA = childCenters[slotInRound * 2];
        const childB = childCenters[slotInRound * 2 + 1];

        if (childA !== undefined && childB !== undefined) {
          center = (childA + childB) / 2;
        } else {
          center = childA ?? childB ?? roundPreviousBottom + height / 2;
        }

        // Midpoint could overlap the previous card when heights vary.
        y = Math.max(center - height / 2, roundPreviousBottom);
        center = y + height / 2;
      }

      roundPreviousBottom = y + height + gapY;
      if (!centers[roundIndex]) {
        centers[roundIndex] = [];
      }
      centers[roundIndex][slotInRound] = center;
      const card = { layout: { height, width: cardWidth, x, y }, match };
      cards.push(card);
      cardById.set(match.id, card);
    });
  });

  // Connectors: child match -> parent match (next round).
  tree.forEach((roundMatches, roundIndex) => {
    if (roundIndex === 0) {
      return;
    }

    roundMatches.forEach((parentMatch, slotInRound) => {
      const parent = cardById.get(parentMatch.id);
      if (!parent) {
        return;
      }

      for (const childSlot of [slotInRound * 2, slotInRound * 2 + 1]) {
        const childMatch = tree[roundIndex - 1]?.[childSlot];
        const child = childMatch ? cardById.get(childMatch.id) : undefined;
        if (!child) {
          continue;
        }

        links.push({
          from: child.match.id,
          to: parent.match.id,
        });
      }
    });
  });

  const maxRight = Math.max(
    ...cards.map((card) => card.layout.x + card.layout.width)
  );
  const maxBottom = Math.max(
    ...cards.map((card) => card.layout.y + card.layout.height)
  );

  return { cards, height: maxBottom, links, width: maxRight };
}
