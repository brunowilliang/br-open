import type { TournamentMatchWithSides } from "./bracket-view";

/** Index 0 = round 1; parent (r, s) takes children (r-1, 2s) and (r-1, 2s+1). */
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
  from: string;
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

export const BRACKET_FIT_VIEW_PADDING = 24;

/** Fit centrado com teto 1 (o canvas nunca upscala), reaplicado como minZoom
 * do gesto: a pinça para exatamente no grafo enquadrado. */
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

export const PAN_VISIBILITY_BAND = 24;

/** Malha [0..graphWidth]x[0..graphHeight], screen = translate + zoom * graph:
 * no limite do arrasto cada borda para `PAN_VISIBILITY_BAND` dentro da tela. */
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

/** Estado INICIAL do canvas e valor re-aplicado a cada re-enquadramento saem
 * daqui: o PRIMEIRO frame nativo do conteúdo já nasce no fit, em vez de pintar
 * em 1x por um frame e saltar. */
export function bracketFitTransform(input: {
  fitZoom: number;
  graphHeight: number;
  graphWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}): { x: number; y: number; zoom: number } {
  return {
    x: (input.viewportWidth - input.graphWidth * input.fitZoom) / 2,
    y: (input.viewportHeight - input.graphHeight * input.fitZoom) / 2,
    zoom: input.fitZoom,
  };
}

/** O ponto do grafo pego no início do gesto fica sob os dedos enquanto o zoom
 * vai de `fromScale` a `toScale` (t1 = f1 - (f0 - t0)*k1/k0); ancorar no focal
 * ATUAL congelaria o arrasto de dois dedos. */
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

/** Altura MEDIDA no device, usada até o `onLayout` reportar a real: a 1ª rodada
 * mede 120 e as rodadas fundas 112; recalculada fora do módulo, o primeiro
 * layout não fecha a malha e o grafo re-enquadra ao medir. */
export const BRACKET_CARD_ESTIMATED_HEIGHT = 120;

/** Altura do card de BYE, card VAZIO fixado nesta mesma altura pelo componente:
 * o retângulo do layout casa com o render por construção e a medida nunca
 * commita; mexer no valor desalinha a âncora dos conectores. */
export const BRACKET_BYE_CARD_HEIGHT = 52;

/** Altura medida por match; ausente = ainda não medida (vale a estimativa). */
export type BracketCardHeights = Record<string, number>;

/** Compara com a altura EFETIVA, nunca com a constante: medida igual não entra
 * no state (chave de 64 monta sem commit), mas um card que volta ao valor
 * estimado PRECISA commitar, senão o conector nasce fora do eixo. */
export function commitCardHeight(input: {
  heights: BracketCardHeights;
  matchId: string;
  measured: number;
}): BracketCardHeights {
  const current = input.heights[input.matchId] ?? BRACKET_CARD_ESTIMATED_HEIGHT;

  return current === input.measured
    ? input.heights
    : { ...input.heights, [input.matchId]: input.measured };
}

type BracketTreeSizing = {
  cardHeightOf: (match: TournamentMatchWithSides) => number;
  cardWidth: number;
  connectorWidth: number;
  gapY: number;
};

/** Uma coluna por rodada dentro de cada categoria: nenhum conector cruza
 * categorias. */
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
