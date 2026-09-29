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

/** Folga entre a coluna da abertura e o header flutuante (o seletor de
 * categorias do chaveamento, medido pela tela): o card não nasce colado nele. */
export const BRACKET_OPENING_HEADER_GAP = 16;

/** Faixa vertical ÚTIL da abertura: começa abaixo do header flutuante com a
 * folga e termina acima da barra de navegação (e do padding do enquadramento).
 * É dentro dela que a coluna do foco cabe e ancora — a centragem no viewport
 * inteiro deixava o topo atrás da tab e a base sob a barra. */
export function bracketOpeningBand(input: {
  /** Espaço que a barra de navegação ocupa na base (`getFloatingTabBarSpacing`). */
  bottomInset: number;
  headerInset: number;
  viewportHeight: number;
}): { bottom: number; top: number } {
  return {
    bottom: input.viewportHeight - input.bottomInset - BRACKET_FIT_VIEW_PADDING,
    top: input.headerInset + BRACKET_OPENING_HEADER_GAP,
  };
}

/** Zoom de ABERTURA do canvas: enquadra UMA coluna (card + cotovelo) em vez do
 * grafo inteiro — é o que faz o card nascer grande na tela. O piso do gesto
 * continua sendo `bracketFitZoom` (a chave inteira), então a pinça afasta até
 * ela; e nunca passa de 1, porque o canvas não upscala. Com a coluna do foco
 * medida, o mesmo enquadramento vale na vertical: ela tem que caber inteira na
 * faixa útil (`bracketOpeningBand`), que é o que dá o respiro da tab. */
export function bracketOpeningZoom(input: {
  /** Faixa vertical útil: teto do zoom da coluna do foco. */
  band: { bottom: number; top: number };
  cardWidth: number;
  /** Altura da coluna do foco em pt de GRAFO; 0 = sem coluna (só a largura). */
  columnHeight: number;
  connectorWidth: number;
  fitZoom: number;
  viewportWidth: number;
}): number {
  const oneColumn =
    (input.viewportWidth - BRACKET_FIT_VIEW_PADDING * 2) /
    (input.cardWidth + input.connectorWidth);
  const bandHeight = input.band.bottom - input.band.top;
  const columnCeiling =
    input.columnHeight > 0 && bandHeight > 0
      ? bandHeight / input.columnHeight
      : 1;

  return Math.max(
    input.fitZoom,
    Math.min(1, oneColumn, columnCeiling > 0 ? columnCeiling : 1)
  );
}

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
 * em 1x por um frame e saltar. Com zoom ACIMA do fit (a abertura de uma coluna)
 * o conteúdo é maior que o viewport: aí a borda de cima/esquerda para na margem
 * — centrar mostraria o MEIO do grafo e cortaria a primeira coluna. */
export function bracketFitTransform(input: {
  fitZoom: number;
  graphHeight: number;
  graphWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}): { x: number; y: number; zoom: number } {
  return {
    x: Math.max(
      (input.viewportWidth - input.graphWidth * input.fitZoom) / 2,
      BRACKET_FIT_VIEW_PADDING
    ),
    y: Math.max(
      (input.viewportHeight - input.graphHeight * input.fitZoom) / 2,
      BRACKET_FIT_VIEW_PADDING
    ),
    zoom: input.fitZoom,
  };
}

/** Caixa da coluna (rodada) em coordenadas de grafo. */
export type BracketOpeningColumn = {
  bottom: number;
  top: number;
  /** Largura do card da rodada: é com ela que a abertura centra na horizontal. */
  width: number;
  x: number;
};

/** Coluna onde a abertura enquadra: a rodada MENOS avançada que ainda tem
 * partida sem resultado — sem nada lançado é a primeira, tudo decidido é a
 * última (a final). Bye (`walkover`) já nasceu decidido e a vaga morta
 * (`vacant`) não é partida: nenhuma das duas segura a rodada aberta. */
export function bracketOpeningColumn(
  layout: BracketTreeLayout
): BracketOpeningColumn | null {
  let lastRound: number | null = null;
  let openRound: number | null = null;

  for (const { match } of layout.cards) {
    if (lastRound === null || match.round > lastRound) {
      lastRound = match.round;
    }
    if (
      (match.status === "pending" || match.status === "scheduled") &&
      (openRound === null || match.round < openRound)
    ) {
      openRound = match.round;
    }
  }

  const round = openRound ?? lastRound;
  if (round === null) {
    return null;
  }

  const cards = layout.cards.filter(({ match }) => match.round === round);

  return {
    bottom: Math.max(...cards.map(({ layout: box }) => box.y + box.height)),
    top: Math.min(...cards.map(({ layout: box }) => box.y)),
    width: Math.max(...cards.map(({ layout: box }) => box.width)),
    x: Math.min(...cards.map(({ layout: box }) => box.x)),
  };
}

/** Transform de ABERTURA: a coluna do foco sai CENTRADA nos dois eixos — na
 * horizontal, o que deixa as rodadas vizinhas aparecendo nas bordas; na
 * vertical, dentro da faixa útil (abaixo do header e acima da barra de baixo, e
 * não do viewport, que é o que a empurrava pra baixo). Com o grafo inteiro já no
 * zoom de abertura não há o que deslocar: cai no fit centrado. */
export function bracketOpeningTransform(input: {
  band: { bottom: number; top: number };
  column: BracketOpeningColumn | null;
  fitZoom: number;
  graphHeight: number;
  graphWidth: number;
  openingZoom: number;
  viewportHeight: number;
  viewportWidth: number;
}): { x: number; y: number; zoom: number } {
  if (!input.column || input.fitZoom >= input.openingZoom) {
    return bracketFitTransform({
      fitZoom: input.openingZoom,
      graphHeight: input.graphHeight,
      graphWidth: input.graphWidth,
      viewportHeight: input.viewportHeight,
      viewportWidth: input.viewportWidth,
    });
  }

  const { bottom, top, width, x } = input.column;
  const bandHeight = input.band.bottom - input.band.top;

  return {
    x: input.viewportWidth / 2 - input.openingZoom * (x + width / 2),
    y:
      input.band.top +
      bandHeight / 2 -
      input.openingZoom * ((top + bottom) / 2),
    zoom: input.openingZoom,
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

/** Peças da altura do card, em pt de GRAFO (p-3 = 12, gap-3 = 12, chip md 28,
 * divisória 1, `h-11` = 44 e `size-7.5` = 30):
 * - fixo: padding (24) + 3 gaps (36) + linha do topo (28) + divisória (1);
 * - pontas: a dupla empilha DOIS avatares (44 por lado) contra um (30);
 * - pé: gap (12) + chip (28) — só existe com dia E quadra RESOLVIDA. */
const CARD_CHROME_HEIGHT = 89;
const CARD_FOOTER_HEIGHT = 40;
const CARD_ROWS_HEIGHT = { doubles: 88, singles: 60 } as const;

export type BracketCardSchedule = {
  /** Nome da quadra JÁ resolvido: é o mesmo valor que vai pro card. */
  courtName: null | string;
  matchDate: null | string;
};

/** O chip do pé é o MESMO critério do card (`matchDate && courtName`): sem a
 * quadra resolvida o card não desenha o chip e a altura não pode contá-lo. */
export function bracketMatchHasScheduleFooter(
  schedule: BracketCardSchedule
): boolean {
  return schedule.matchDate !== null && schedule.courtName !== null;
}

/** Estimativa da altura do card de UMA partida, em pt de GRAFO: é o que o
 * layout usa até a medida do device. A soma é a do card DESENHADO, e a linha do
 * topo entra com os 28 dela: um filho com flex-basis 0 numa coluna de altura
 * automática contribui ZERO pra altura intrínseca, e aí o card se mede 28 menor
 * e o flex zera a própria linha (os chips, com `overflow: hidden`, perdem o
 * rótulo). */
export function bracketMatchEstimatedHeight(
  input: BracketCardSchedule & { modality: string }
): number {
  return (
    CARD_CHROME_HEIGHT +
    CARD_ROWS_HEIGHT[input.modality === "doubles" ? "doubles" : "singles"] +
    (bracketMatchHasScheduleFooter(input) ? CARD_FOOTER_HEIGHT : 0)
  );
}

/** Altura do card de BYE, card VAZIO fixado nesta mesma altura pelo componente:
 * o retângulo do layout casa com o render por construção e a medida nunca
 * commita; mexer no valor desalinha a âncora dos conectores. */
export const BRACKET_BYE_CARD_HEIGHT = 52;

/** Altura medida por match; ausente = ainda não medida (vale a estimativa). */
export type BracketCardHeights = Record<string, number>;

/** Compara com a altura EFETIVA, nunca com a constante: medida igual não entra
 * no state (chave de 64 monta sem commit), mas um card que volta ao valor
 * estimado PRECISA commitar, senão o conector nasce fora do eixo. Medida ABAIXO
 * da estimativa é card COMPRIMIDO, não card mais baixo: gravar aquele número
 * fecharia o loop medida -> nó curto -> medida. */
export function commitCardHeight(input: {
  estimatedHeight: number;
  heights: BracketCardHeights;
  matchId: string;
  measured: number;
}): BracketCardHeights {
  const measured = Math.max(input.measured, input.estimatedHeight);
  const current = input.heights[input.matchId] ?? input.estimatedHeight;

  return current === measured
    ? input.heights
    : { ...input.heights, [input.matchId]: measured };
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
  categoriesById: Record<string, { id: string; name?: string }> = {}
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
      label: categoriesById[categoryId]?.name ?? categoryId,
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
