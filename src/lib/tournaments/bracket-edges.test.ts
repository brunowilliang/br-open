import { describe, expect, test } from "bun:test";

import {
  bracketEdgeParts,
  bracketEdgeRoute,
  decomposeEdgeRoute,
  type BracketEdgePart,
  type BracketPoint,
  type BracketRect,
} from "./bracket-edges";
import {
  BRACKET_BYE_CARD_HEIGHT,
  BRACKET_CARD_ESTIMATED_HEIGHT,
  layoutBracketCategoryTree,
  type BracketTreeLayout,
} from "./bracket-tree";
import { isByeMatch, type TournamentMatchWithSides } from "./bracket-view";

const CHILD: BracketRect = { height: 136, width: 256, x: 0, y: 0 };
const PARENT_BELOW: BracketRect = { height: 136, width: 256, x: 288, y: 300 };
const PARENT_ALIGNED: BracketRect = { height: 136, width: 256, x: 288, y: 0 };
const THICKNESS = 1.5;

describe("bracketEdgeRoute", () => {
  test("starts at the child's right-face center and ends at the parent's left-face center", () => {
    const route = bracketEdgeRoute(CHILD, PARENT_BELOW);

    expect(route.at(0)).toEqual({ x: 256, y: 68 });
    expect(route.at(-1)).toEqual({ x: 288, y: 368 });
  });

  test("runs its vertical straight down the middle of the corridor", () => {
    const route = bracketEdgeRoute(CHILD, PARENT_BELOW);
    const corridorX = (256 + 288) / 2;

    expect(route).toEqual([
      { x: 256, y: 68 },
      { x: corridorX, y: 68 },
      { x: corridorX, y: 368 },
      { x: 288, y: 368 },
    ]);
  });

  test("collapses to one horizontal run when the centers align", () => {
    expect(bracketEdgeRoute(CHILD, PARENT_ALIGNED)).toEqual([
      { x: 256, y: 68 },
      { x: 288, y: 68 },
    ]);
  });

  test("siblings share the corridor vertical (classic fork/join)", () => {
    // The two children of one parent sit in the same column, so both routes
    // must land their verticals on the same x — they read as one trunk.
    const childB: BracketRect = { ...CHILD, y: 200 };
    const corridorX = (256 + 288) / 2;
    const routeA = bracketEdgeRoute(CHILD, PARENT_BELOW);
    const routeB = bracketEdgeRoute(childB, PARENT_BELOW);

    expect(routeA.filter((p) => p.x === corridorX)).toHaveLength(2);
    expect(routeB.filter((p) => p.x === corridorX)).toHaveLength(2);
  });
});

describe("decomposeEdgeRoute", () => {
  test("terminal bars overlap both card edges by half a stroke", () => {
    const parts = bracketEdgeParts({
      from: CHILD,
      thickness: THICKNESS,
      to: PARENT_BELOW,
    });
    const horizontal = parts.filter((p) => p.width > p.height);
    const first = horizontal.at(0);
    const last = horizontal.at(-1);

    // The first bar starts half a stroke inside the child, the last ends
    // half a stroke inside the parent: attachment to the card border is by
    // construction, not by luck.
    expect(first?.x).toBeCloseTo(256 - THICKNESS / 2, 6);
    expect(last ? last.x + last.width : 0).toBeCloseTo(288 + THICKNESS / 2, 6);
  });

  test("every segment is one bar; bars overlap half a stroke at sharp corners", () => {
    const route = bracketEdgeRoute(CHILD, PARENT_BELOW);
    const parts = decomposeEdgeRoute(route, THICKNESS);

    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.kind === "bar")).toBe(true);

    // The horizontal into the corner extends half a stroke PAST the corner
    // x, and the vertical extends half a stroke ABOVE the corner y — the
    // overlap welds the sharp corner with no seam and no rounding.
    const corridorX = (256 + 288) / 2;
    const intoCorner = parts.find(
      (p) => p.width > p.height && p.x + p.width > corridorX
    );
    expect(intoCorner ? intoCorner.x + intoCorner.width : 0).toBeCloseTo(
      corridorX + THICKNESS / 2,
      6
    );
  });

  test("a straight run is a single bar spanning both cards", () => {
    const parts = bracketEdgeParts({
      from: CHILD,
      thickness: THICKNESS,
      to: PARENT_ALIGNED,
    });

    expect(parts).toHaveLength(1);
    expect(parts[0]?.width).toBeCloseTo(32 + THICKNESS, 6);
  });

  test("collinear waypoints merge into one bar", () => {
    const parts = decomposeEdgeRoute(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 30, y: 0 },
      ],
      THICKNESS
    );

    expect(parts).toHaveLength(1);
  });

  test("every piece lands inside the route's bounding box plus one stroke", () => {
    const route: BracketPoint[] = [
      { x: 256, y: 68 },
      { x: 262, y: 68 },
      { x: 272, y: 68 },
      { x: 272, y: 368 },
      { x: 282, y: 368 },
      { x: 288, y: 368 },
    ];
    const parts = decomposeEdgeRoute(route, THICKNESS);

    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(part.x).toBeGreaterThanOrEqual(256 - THICKNESS);
      expect(part.x + part.width).toBeLessThanOrEqual(288 + THICKNESS);
      expect(part.y).toBeGreaterThanOrEqual(68 - THICKNESS);
      expect(part.y + part.height).toBeLessThanOrEqual(368 + THICKNESS);
    }
  });
});

// ---------------------------------------------------------------------------
// Ancoragem na forma REAL da chave: os prints do repro do BUG-0033 (Copa
// Dracena 8 Dev: 16 slots, 11 inscritos, 5 byes) fixam o contrato observável
// do desenho — todo conector encosta nas faces dos DOIS cards que liga e a
// geometria não sai do retângulo dos cards. Cobertura da lib pura: o
// deslocamento visto na tela NÃO é reproduzível aqui (ele não é produzido por
// estas funções — o gatilho segue em aberto, ver a spec).
// ---------------------------------------------------------------------------

/** Mesmas constantes do canvas (bracket.tsx). */
const CANVAS_CARD_WIDTH = 256;
const CANVAS_CONNECTOR_WIDTH = 32;
const CANVAS_GAP_Y = 12;
/** EDGE_STROKE_GRAPH do canvas. */
const CANVAS_STROKE = 1.5;
/**
 * Altura do card comum na chave assentada — MEDIÇÃO DE DEVICE (onLayout): 120
 * na 1ª rodada e 112 nas rodadas fundas; é o valor que o layout usa. A leitura
 * da imagem do print (~120,4) é estimativa de pixel, não medição (ver spec,
 * BUG-0033/M1).
 */
const MEASURED_CARD_HEIGHT = 120;
/** Byes do sorteio na 1ª rodada da chave do repro. */
const BYE_SLOTS = [0, 2, 3, 4, 6];

function buildScheduledMatch(
  id: string,
  round: number,
  slotInRound: number,
  status = "scheduled"
): TournamentMatchWithSides {
  return {
    categoryId: "c1",
    entryA: null,
    entryAId: null,
    entryB: null,
    entryBId: null,
    id,
    round,
    score: null,
    slotInRound,
    status,
    winnerEntryId: null,
  } as TournamentMatchWithSides;
}

function buildDracenaTree() {
  const roundOne = Array.from({ length: 8 }, (_, slot) =>
    buildScheduledMatch(
      `r1-${slot}`,
      1,
      slot,
      BYE_SLOTS.includes(slot) ? "walkover" : "scheduled"
    )
  );
  const roundTwo = Array.from({ length: 4 }, (_, slot) =>
    buildScheduledMatch(`r2-${slot}`, 2, slot)
  );
  const roundThree = Array.from({ length: 2 }, (_, slot) =>
    buildScheduledMatch(`r3-${slot}`, 3, slot)
  );

  return [roundOne, roundTwo, roundThree, [buildScheduledMatch("r4-0", 4, 0)]];
}

/** O layout como a rota o monta: altura medida quando existe, senão a estimativa. */
function buildDracenaLayout(measuredCardIds: string[] = []): BracketTreeLayout {
  const measured = new Set(measuredCardIds);

  return layoutBracketCategoryTree(buildDracenaTree(), {
    cardHeightOf: (match) => {
      if (isByeMatch(match)) {
        return BRACKET_BYE_CARD_HEIGHT;
      }

      return measured.has(match.id)
        ? MEASURED_CARD_HEIGHT
        : BRACKET_CARD_ESTIMATED_HEIGHT;
    },
    cardWidth: CANVAS_CARD_WIDTH,
    connectorWidth: CANVAS_CONNECTOR_WIDTH,
    gapY: CANVAS_GAP_Y,
  });
}

/** A mesma varredura do canvas: um grupo de parts por link, e os descartes. */
function emitDracenaParts(layout: BracketTreeLayout) {
  const cardsById = new Map(layout.cards.map((card) => [card.match.id, card]));
  const perLink: Array<{
    from: BracketTreeLayout["cards"][number];
    parts: BracketEdgePart[];
    to: BracketTreeLayout["cards"][number];
  }> = [];
  let dropped = 0;

  for (const link of layout.links) {
    const from = cardsById.get(link.from);
    const to = cardsById.get(link.to);

    if (!(from && to)) {
      dropped += 1;
      continue;
    }

    perLink.push({
      from,
      parts: bracketEdgeParts({
        from: from.layout,
        thickness: CANVAS_STROKE,
        to: to.layout,
      }),
      to,
    });
  }

  return { dropped, perLink };
}

function boxOfRects(rects: BracketRect[]) {
  return {
    maxX: Math.max(...rects.map((rect) => rect.x + rect.width)),
    maxY: Math.max(...rects.map((rect) => rect.y + rect.height)),
    minX: Math.min(...rects.map((rect) => rect.x)),
    minY: Math.min(...rects.map((rect) => rect.y)),
  };
}

/** O ponto da face está sobre o part (folga de um traço em cada eixo). */
function partCoversAnchor(input: {
  anchorX: number;
  anchorY: number;
  part: BracketEdgePart;
}) {
  const { part } = input;

  return (
    input.anchorX >= part.x - CANVAS_STROKE &&
    input.anchorX <= part.x + part.width + CANVAS_STROKE &&
    input.anchorY >= part.y - CANVAS_STROKE &&
    input.anchorY <= part.y + part.height + CANVAS_STROKE
  );
}

const DRACENA_MEASURED_IDS = buildDracenaLayout()
  .cards.filter((card) => !isByeMatch(card.match))
  .map((card) => card.match.id);
const SETTLED_DRACENA = buildDracenaLayout(DRACENA_MEASURED_IDS);

describe("bracket edges: attachment on the real bracket shape (BUG-0033)", () => {
  test("no link is dropped on the 16-slot bracket (15 matches, 5 byes)", () => {
    const { dropped, perLink } = emitDracenaParts(SETTLED_DRACENA);

    expect(dropped).toBe(0);
    expect(perLink).toHaveLength(SETTLED_DRACENA.links.length);
    expect(SETTLED_DRACENA.links.length).toBe(SETTLED_DRACENA.cards.length - 1);
  });

  test("every connector lands on both faces of the cards it links", () => {
    const { perLink } = emitDracenaParts(SETTLED_DRACENA);

    for (const link of perLink) {
      const departsRightFace = link.parts.some((part) =>
        partCoversAnchor({
          anchorX: link.from.layout.x + link.from.layout.width,
          anchorY: link.from.layout.y + link.from.layout.height / 2,
          part,
        })
      );
      const arrivesLeftFace = link.parts.some((part) =>
        partCoversAnchor({
          anchorX: link.to.layout.x,
          anchorY: link.to.layout.y + link.to.layout.height / 2,
          part,
        })
      );

      expect(departsRightFace).toBe(true);
      expect(arrivesLeftFace).toBe(true);
    }
  });

  test("parts stay inside the cards' box", () => {
    const { perLink } = emitDracenaParts(SETTLED_DRACENA);
    const parts = perLink.flatMap((link) => link.parts);
    const partsBox = boxOfRects(
      parts.map((part) => ({
        height: part.height,
        width: part.width,
        x: part.x,
        y: part.y,
      }))
    );
    const cardsBox = boxOfRects(
      SETTLED_DRACENA.cards.map((card) => card.layout)
    );

    // O traço invade meia espessura dentro do card e vive no corredor: a
    // geometria nunca passa do retângulo dos cards. Guarda de FORMA da lib
    // pura — não é o deslocamento do BUG-0033 (esse não sai destas funções).
    expect(partsBox.minX).toBeGreaterThanOrEqual(cardsBox.minX);
    expect(partsBox.minY).toBeGreaterThanOrEqual(cardsBox.minY);
    expect(partsBox.maxX).toBeLessThanOrEqual(cardsBox.maxX);
    expect(partsBox.maxY).toBeLessThanOrEqual(cardsBox.maxY);
  });
});
