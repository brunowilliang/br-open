import { describe, expect, test } from "bun:test";

import { isByeMatch, type TournamentMatchWithSides } from "./bracket-view";
import {
  BRACKET_BYE_CARD_HEIGHT,
  BRACKET_CARD_ESTIMATED_HEIGHT,
  commitCardHeight,
  bracketFitTransform,
  bracketFitZoom,
  buildBracketCategoryTrees,
  clampPanToViewport,
  layoutBracketCategoryTree,
  PAN_VISIBILITY_BAND,
  pinchFollowTransform,
} from "./bracket-tree";

function buildMatch(
  id: string,
  categoryId: string,
  round: number,
  slotInRound: number
): TournamentMatchWithSides {
  return {
    categoryId,
    entryA: null,
    entryAId: null,
    entryB: null,
    entryBId: null,
    id,
    round,
    score: null,
    slotInRound,
    status: "scheduled",
    winnerEntryId: null,
  } as TournamentMatchWithSides;
}

const SIZING = {
  cardHeightOf: () => 100,
  cardWidth: 256,
  connectorWidth: 32,
  gapY: 12,
};

describe("buildBracketCategoryTrees", () => {
  test("splits matches per category with rounds ascending by slot", () => {
    const trees = buildBracketCategoryTrees(
      [
        buildMatch("f2", "catB", 1, 1),
        buildMatch("f1", "catB", 1, 0),
        buildMatch("a2", "catA", 1, 1),
        buildMatch("final", "catA", 2, 0),
        buildMatch("a1", "catA", 1, 0),
      ],
      { catA: { displayName: "Duplas masculinas", id: "catA" } }
    );

    expect(trees).toHaveLength(2);
    const catA = trees.find((tree) => tree.id === "catA");
    expect(catA?.label).toBe("Duplas masculinas");
    expect(catA?.columns).toHaveLength(2);
    expect(catA?.columns[0].map((match) => match.id)).toEqual(["a1", "a2"]);
    expect(catA?.columns[1].map((match) => match.id)).toEqual(["final"]);
    expect(trees.find((tree) => tree.id === "catB")?.columns).toHaveLength(1);
  });
});

describe("layoutBracketCategoryTree", () => {
  test("stacks round 1 and centers later rounds on children midpoint", () => {
    // 4-slot bracket: R1 has 2 matches, R2 (final) has 1.
    const layout = layoutBracketCategoryTree(
      [
        [buildMatch("m1", "c", 1, 0), buildMatch("m2", "c", 1, 1)],
        [buildMatch("mf", "c", 2, 0)],
      ],
      SIZING
    );

    const m1 = layout.cards.find((card) => card.match.id === "m1")?.layout;
    const m2 = layout.cards.find((card) => card.match.id === "m2")?.layout;
    const mf = layout.cards.find((card) => card.match.id === "mf")?.layout;

    // Round 1 stacked: m1 at y=0, m2 at y=100+12.
    expect(m1?.y).toBe(0);
    expect(m2?.y).toBe(112);

    // Final centered between m1/m2 centers (50 and 162): center 106, y 56.
    expect(mf?.y).toBe(56);

    // Columns advance by cardWidth + connectorWidth.
    expect(m1?.x).toBe(0);
    expect(mf?.x).toBe(256 + 32);

    // Links: 2 children -> 1 final.
    expect(layout.links).toHaveLength(2);
    expect(layout.links[0].from).toBe("m1");
    expect(layout.links[0].to).toBe("mf");
    expect(layout.links[1].from).toBe("m2");
    expect(layout.links[1].to).toBe("mf");
    expect(layout.width).toBe(288 + 256);
    expect(layout.height).toBe(212);
  });

  test("8-slot bracket produces one link per non-first-round edge", () => {
    const layout = layoutBracketCategoryTree(
      [
        [0, 1, 2, 3].map((slot) => buildMatch(`r1-${slot}`, "c", 1, slot)),
        [0, 1].map((slot) => buildMatch(`r2-${slot}`, "c", 2, slot)),
        [buildMatch("r3-0", "c", 3, 0)],
      ],
      SIZING
    );

    // 4 + 2 matches feed forward: 6 child->parent edges.
    expect(layout.cards).toHaveLength(7);
    expect(layout.links).toHaveLength(6);
  });

  test("3-slot draw (bye): absent sibling slot yields exactly one link", () => {
    // Seed 1 byes to the final; only the 2v3 match exists in round 1, so the
    // final's second child slot is empty and must not produce a link.
    const layout = layoutBracketCategoryTree(
      [[buildMatch("r1-0", "c", 1, 0)], [buildMatch("mf", "c", 2, 0)]],
      SIZING
    );

    expect(layout.cards).toHaveLength(2);
    expect(layout.links).toHaveLength(1);
    expect(layout.links[0]).toEqual({ from: "r1-0", to: "mf" });
  });

  test("clamps a later-round card below the previous one when heights diverge", () => {
    const layout = layoutBracketCategoryTree(
      [
        [
          buildMatch("t1", "c", 1, 0),
          buildMatch("t2", "c", 1, 1),
          buildMatch("t3", "c", 1, 2),
          buildMatch("t4", "c", 1, 3),
        ],
        [buildMatch("s1", "c", 2, 0), buildMatch("s2", "c", 2, 1)],
      ],
      {
        ...SIZING,
        cardHeightOf: (match) => (match.round === 2 ? 220 : 100),
      }
    );

    const s1 = layout.cards.find((card) => card.match.id === "s1")?.layout;
    const s2 = layout.cards.find((card) => card.match.id === "s2")?.layout;

    // s2 midpoint (312) minus half height (110) would overlap s1 bottom;
    // it must be clamped below s1 (0 + 220 + 12).
    expect(s2?.y).toBe(232);
    expect((s2?.y ?? 0) - (s1?.y ?? 0)).toBeGreaterThanOrEqual(220 + 12);
  });

  test("empty tree yields empty layout", () => {
    expect(layoutBracketCategoryTree([], SIZING)).toEqual({
      cards: [],
      height: 0,
      links: [],
      width: 0,
    });
  });
});

describe("bracketFitZoom", () => {
  test("returns the exact centered-fit zoom for a wide graph", () => {
    expect(
      bracketFitZoom({
        graphHeight: 400,
        graphWidth: 1000,
        viewportHeight: 700,
        viewportWidth: 390,
      })
    ).toBeCloseTo((390 - 48) / 1000);
  });

  test("caps at 1 because the canvas never upscales", () => {
    expect(
      bracketFitZoom({
        graphHeight: 100,
        graphWidth: 200,
        viewportHeight: 700,
        viewportWidth: 390,
      })
    ).toBe(1);
  });

  test("returns null before the graph or the viewport is measured", () => {
    expect(
      bracketFitZoom({
        graphHeight: 0,
        graphWidth: 0,
        viewportHeight: 700,
        viewportWidth: 390,
      })
    ).toBeNull();
    expect(
      bracketFitZoom({
        graphHeight: 400,
        graphWidth: 1000,
        viewportHeight: 0,
        viewportWidth: 390,
      })
    ).toBeNull();
  });
});

describe("clampPanToViewport", () => {
  const input = {
    graphHeight: 2000,
    graphWidth: 1000,
    viewportHeight: 800,
    viewportWidth: 400,
  };

  test("lets a centered fit sit untouched", () => {
    const zoom =
      (input.viewportHeight - PAN_VISIBILITY_BAND * 2) / input.graphHeight;
    const x = (input.viewportWidth - input.graphWidth * zoom) / 2;
    const y = (input.viewportHeight - input.graphHeight * zoom) / 2;

    const clamped = clampPanToViewport({ ...input, x, y, zoom });

    expect(clamped.x).toBeCloseTo(x, 6);
    expect(clamped.y).toBeCloseTo(y, 6);
  });

  test("keeps a 24pt band of the graph on screen at the drag limits", () => {
    // Dragged far past both edges: the graph's right/bottom edges land 24pt
    // inside the screen (screen = translate + zoom * graph edge).
    const clamped = clampPanToViewport({
      ...input,
      x: -50_000,
      y: 50_000,
      zoom: 1,
    });

    expect(clamped.x).toBe(PAN_VISIBILITY_BAND - input.graphWidth);
    expect(clamped.y).toBe(input.viewportHeight - PAN_VISIBILITY_BAND);
  });

  test("clamps both axes at native zoom", () => {
    const clamped = clampPanToViewport({
      ...input,
      x: 500,
      y: -5000,
      zoom: 1,
    });

    expect(clamped.x).toBe(input.viewportWidth - PAN_VISIBILITY_BAND);
    expect(clamped.y).toBe(PAN_VISIBILITY_BAND - input.graphHeight);
  });

  test("keeps every intermediate zoom inside the band", () => {
    for (const zoom of [0.16, 0.34, 0.55, 0.8, 1]) {
      for (const [x, y] of [
        [-9000, -9000],
        [9000, 9000],
        [-9000, 9000],
        [123, -321],
      ]) {
        const clamped = clampPanToViewport({ ...input, x, y, zoom });
        expect(clamped.x).toBeGreaterThanOrEqual(
          PAN_VISIBILITY_BAND - input.graphWidth * zoom
        );
        expect(clamped.x).toBeLessThanOrEqual(
          input.viewportWidth - PAN_VISIBILITY_BAND
        );
        expect(clamped.y).toBeGreaterThanOrEqual(
          PAN_VISIBILITY_BAND - input.graphHeight * zoom
        );
        expect(clamped.y).toBeLessThanOrEqual(
          input.viewportHeight - PAN_VISIBILITY_BAND
        );
      }
    }
  });
});

describe("pinchFollowTransform (zoom-around-point invariant)", () => {
  const viewport = { height: 800, width: 400 };
  const graph = { height: 2000, width: 1000 };

  test("the graph point grabbed at gesture start stays under the fingers", () => {
    const focals = [0, 40, 200, 360, 400];
    const starts = [
      { k: 0.2, x: 30, y: 50 },
      { k: 0.5, x: -120, y: 200 },
      { k: 1, x: -600, y: -700 },
    ];
    const targets = [0.2, 0.34, 0.5, 0.8, 1];

    for (const from of starts) {
      for (const to of targets) {
        for (const f0x of focals) {
          for (const f0y of focals) {
            for (const dx of [0, 30, -60]) {
              const f1x = f0x + dx;
              const next = pinchFollowTransform({
                focalX: f1x,
                focalY: f0y,
                fromScale: from.k,
                fromX: from.x,
                fromY: from.y,
                startFocalX: f0x,
                startFocalY: f0y,
                toScale: to,
              });
              // The graph point under the START focal must land exactly
              // under the CURRENT focal: t1 + k1 * (f0 - t0)/k0 === f1.
              const gx = (f0x - from.x) / from.k;
              const gy = (f0y - from.y) / from.k;
              expect(next.x + to * gx).toBeCloseTo(f1x, 9);
              expect(next.y + to * gy).toBeCloseTo(f0y, 9);
            }
          }
        }
      }
    }
  });

  test("a pure zoom keeps the start focal fixed on screen", () => {
    const next = pinchFollowTransform({
      focalX: 200,
      focalY: 400,
      fromScale: 0.5,
      fromX: -100,
      fromY: 300,
      startFocalX: 200,
      startFocalY: 400,
      toScale: 1,
    });

    // t1 = f - (f - t0)*ratio: (-100..) with ratio 2 -> 200 - 600 = -400.
    expect(next.x).toBeCloseTo(200 - (200 - -100) * 2, 9);
    expect(next.y).toBeCloseTo(400 - (400 - 300) * 2, 9);
  });

  test("a moving focal with unchanged zoom translates by the focal delta", () => {
    const next = pinchFollowTransform({
      focalX: 230,
      focalY: 380,
      fromScale: 0.5,
      fromX: -100,
      fromY: 300,
      startFocalX: 200,
      startFocalY: 400,
      toScale: 0.5,
    });

    expect(next.x).toBeCloseTo(-100 + 30, 9);
    expect(next.y).toBeCloseTo(300 - 20, 9);
  });

  test("clamped results stay inside the pan bounds (best-effort invariant)", () => {
    for (const to of [0.2, 0.5, 1]) {
      const follow = pinchFollowTransform({
        focalX: 200,
        focalY: 400,
        fromScale: 0.2,
        fromX: 0,
        fromY: 0,
        startFocalX: 200,
        startFocalY: 400,
        toScale: to,
      });
      const clamped = clampPanToViewport({
        graphHeight: graph.height,
        graphWidth: graph.width,
        viewportHeight: viewport.height,
        viewportWidth: viewport.width,
        x: follow.x,
        y: follow.y,
        zoom: to,
      });
      if (clamped.x === follow.x && clamped.y === follow.y) {
        const gx = (200 - 0) / 0.2;
        expect(clamped.x + to * gx).toBeCloseTo(200, 9);
      }
      expect(clamped.x).toBeGreaterThanOrEqual(
        PAN_VISIBILITY_BAND - graph.width * to
      );
      expect(clamped.x).toBeLessThanOrEqual(
        viewport.width - PAN_VISIBILITY_BAND
      );
    }
  });
});

describe("commitCardHeight (altura medida do card)", () => {
  test("medida igual à altura EFETIVA não commita (chave de 64 monta sem cascata)", () => {
    const heights = {};
    expect(
      commitCardHeight({
        heights,
        matchId: "m1",
        measured: BRACKET_CARD_ESTIMATED_HEIGHT,
      })
    ).toBe(heights);

    const measured = { m1: 154 };
    expect(
      commitCardHeight({
        heights: measured,
        matchId: "m1",
        measured: 154,
      })
    ).toBe(measured);
  });

  test("medida igual à estimativa commita quando a altura efetiva era outra (o guard do IBX-0022 dropava)", () => {
    const next = commitCardHeight({
      heights: { m1: 154 },
      matchId: "m1",
      measured: BRACKET_CARD_ESTIMATED_HEIGHT,
    });

    expect(next.m1).toBe(BRACKET_CARD_ESTIMATED_HEIGHT);
  });

  test("a última medida vence nas duas direções", () => {
    const shrunk = commitCardHeight({
      heights: { m1: 154 },
      matchId: "m1",
      measured: 120,
    });
    expect(shrunk.m1).toBe(120);

    const grown = commitCardHeight({
      heights: shrunk,
      matchId: "m1",
      measured: 154,
    });
    expect(grown.m1).toBe(154);
    expect(grown).not.toBe(shrunk);
  });

  test("commita só o card medido, preservando a identidade dos outros", () => {
    const heights = { other: 120 };
    const next = commitCardHeight({ heights, matchId: "m1", measured: 150 });

    expect(next).toEqual({ m1: 150, other: 120 });
    expect(next).not.toBe(heights);
  });
});

// ---------------------------------------------------------------------------
// Estabilidade do PRIMEIRO layout (a "piscada" da entrada — BUG-0033): a malha
// montada com a ESTIMATIVA precisa fechar o MESMO grafo que a malha assentada
// (alturas medidas); se a estimativa estiver longe, o grafo inteiro re-layouta
// e re-enquadra no primeiro frame depois de medir => salto visível.
// Forma real do repro: 16 slots, 11 inscritos, 5 byes (slots 0, 2, 3, 4 e 6).
// ---------------------------------------------------------------------------
describe("BRACKET_CARD_ESTIMATED_HEIGHT: estabilidade do primeiro layout", () => {
  const BYE_SLOTS = [0, 2, 3, 4, 6];
  /** Altura medida no device: cards da 1ª rodada 120, rodadas fundas 112. */
  const FIRST_ROUND_MEASURED = 120;
  const DEEP_ROUND_MEASURED = 112;
  /** Estimativa antiga (suposição), para a contraprova. */
  const OLD_ESTIMATE = 136;

  function buildShape() {
    const sizes = [8, 4, 2, 1];

    return sizes.map(
      (count, index) =>
        Array.from({ length: count }, (_, slot) => ({
          categoryId: "c1",
          entryA: null,
          entryAId: null,
          entryB: null,
          entryBId: null,
          id: `r${index + 1}-${slot}`,
          round: index + 1,
          score: null,
          slotInRound: slot,
          status:
            index === 0 && BYE_SLOTS.includes(slot) ? "walkover" : "scheduled",
          winnerEntryId: null,
        })) as TournamentMatchWithSides[]
    );
  }

  const SHAPE = buildShape();

  function buildWith(
    cardHeightOf: (match: TournamentMatchWithSides) => number
  ) {
    return layoutBracketCategoryTree(SHAPE, {
      cardHeightOf,
      cardWidth: 256,
      connectorWidth: 32,
      gapY: 12,
    });
  }

  const estimated = buildWith((match) =>
    isByeMatch(match) ? BRACKET_BYE_CARD_HEIGHT : BRACKET_CARD_ESTIMATED_HEIGHT
  );
  const settled = buildWith((match) =>
    isByeMatch(match)
      ? BRACKET_BYE_CARD_HEIGHT
      : match.round === 1
        ? FIRST_ROUND_MEASURED
        : DEEP_ROUND_MEASURED
  );

  test("a malha estimada já fecha o grafo assentado (sem reflow na entrada)", () => {
    expect(estimated.height).toBe(settled.height);
    expect(estimated.width).toBe(settled.width);
  });

  test("o deslocamento por card ao assentar é mínimo (sem re-layout visível)", () => {
    const settledById = new Map(
      settled.cards.map((card) => [card.match.id, card.layout])
    );
    let maxDrop = 0;

    for (const card of estimated.cards) {
      const target = settledById.get(card.match.id);

      if (!target) {
        throw new Error(`card ${card.match.id} missing in the settled layout`);
      }

      maxDrop = Math.max(maxDrop, Math.abs(card.layout.y - target.y));
    }

    expect(maxDrop).toBeLessThanOrEqual(8);
  });

  test("contraprova: com a estimativa antiga (136) a malha não fechava", () => {
    const withOldEstimate = buildWith((match) =>
      isByeMatch(match) ? BRACKET_BYE_CARD_HEIGHT : OLD_ESTIMATE
    );

    expect(withOldEstimate.height).not.toBe(settled.height);
    expect(withOldEstimate.height - settled.height).toBeGreaterThan(24);
  });
});

// ---------------------------------------------------------------------------
// bracketFitTransform: o estado INICIAL do transform do canvas e o valor
// re-aplicado a cada re-enquadramento saem da MESMA função — é o que garante
// que o primeiro frame nativo do conteúdo já nasça no fit (BUG-0033: o
// conteúdo pintava em identidade/1x por um frame e saltava).
// ---------------------------------------------------------------------------
describe("bracketFitTransform", () => {
  const VIEWPORT = { viewportHeight: 956, viewportWidth: 440 };
  const GRAPH = { graphHeight: 704, graphWidth: 1120 };

  test("centraliza o grafo escalado no viewport (margens iguais)", () => {
    const fitZoom = bracketFitZoom({ ...GRAPH, ...VIEWPORT });
    const transform = bracketFitTransform({
      fitZoom: fitZoom ?? 1,
      ...GRAPH,
      ...VIEWPORT,
    });

    expect(transform.zoom).toBe(fitZoom ?? 1);
    expect(transform.x).toBeCloseTo(
      (VIEWPORT.viewportWidth - GRAPH.graphWidth * transform.zoom) / 2,
      6
    );
    expect(transform.y).toBeCloseTo(
      (VIEWPORT.viewportHeight - GRAPH.graphHeight * transform.zoom) / 2,
      6
    );
  });

  test("não upscala (zoom do fit clamped em 1 pelo fitZoom) e mantém o grafo dentro do viewport", () => {
    const fitZoom = bracketFitZoom({ ...GRAPH, ...VIEWPORT }) ?? 1;
    const transform = bracketFitTransform({ fitZoom, ...GRAPH, ...VIEWPORT });

    const right = transform.x + GRAPH.graphWidth * transform.zoom;
    const bottom = transform.y + GRAPH.graphHeight * transform.zoom;

    expect(transform.x).toBeGreaterThanOrEqual(0);
    expect(transform.y).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(VIEWPORT.viewportWidth + 0.001);
    expect(bottom).toBeLessThanOrEqual(VIEWPORT.viewportHeight + 0.001);
  });

  test("grafo maior que o viewport centra com margem negativa simétrica (pan inicial)", () => {
    const cramped = { viewportHeight: 400, viewportWidth: 300 };
    const transform = bracketFitTransform({
      fitZoom: 1,
      graphHeight: GRAPH.graphHeight,
      graphWidth: GRAPH.graphWidth,
      ...cramped,
    });

    expect(transform.x).toBeCloseTo((300 - 1120) / 2, 6);
    expect(transform.y).toBeCloseTo((400 - 704) / 2, 6);
  });
});
