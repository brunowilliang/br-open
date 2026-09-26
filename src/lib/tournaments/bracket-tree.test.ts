import { describe, expect, test } from "bun:test";

import { isByeMatch, type TournamentMatchWithSides } from "./bracket-view";
import {
  BRACKET_BYE_CARD_HEIGHT,
  bracketMatchEstimatedHeight,
  bracketMatchHasScheduleFooter,
  commitCardHeight,
  bracketFitTransform,
  bracketFitZoom,
  bracketOpeningColumn,
  bracketOpeningTransform,
  bracketOpeningZoom,
  buildBracketCategoryTrees,
  BRACKET_FIT_VIEW_PADDING,
  clampPanToViewport,
  layoutBracketCategoryTree,
  PAN_VISIBILITY_BAND,
  pinchFollowTransform,
  type BracketTreeLayout,
} from "./bracket-tree";

function buildMatch(
  id: string,
  categoryId: string,
  round: number,
  slotInRound: number,
  status = "scheduled"
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
    status,
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

describe("bracketOpeningZoom", () => {
  const COLUMN = { cardWidth: 320, connectorWidth: 32 };

  test("enquadra UMA coluna e nunca upscala", () => {
    expect(
      bracketOpeningZoom({ ...COLUMN, fitZoom: 0.51, viewportWidth: 393 })
    ).toBeCloseTo((393 - 48) / 352);
    expect(
      bracketOpeningZoom({ ...COLUMN, fitZoom: 0.2, viewportWidth: 2000 })
    ).toBe(1);
  });

  test("nunca fica abaixo do fit do grafo: a pinca continua afastando ate ele", () => {
    // Grafo de UMA coluna: o fit do grafo é maior que o enquadramento de uma
    // coluna, e mesmo assim a abertura não pode afastar mais que ele.
    expect(
      bracketOpeningZoom({ ...COLUMN, fitZoom: 1, viewportWidth: 393 })
    ).toBe(1);
  });
});

describe("bracketFitTransform", () => {
  test("no fit do grafo inteiro o conteudo segue centrado", () => {
    // Grafo alto e estreito: quem limita e a ALTURA, entao sobra margem em x.
    const zoom = (800 - BRACKET_FIT_VIEW_PADDING * 2) / 2000;
    const transform = bracketFitTransform({
      fitZoom: zoom,
      graphHeight: 2000,
      graphWidth: 200,
      viewportHeight: 800,
      viewportWidth: 400,
    });

    expect(transform.x).toBeCloseTo((400 - 200 * zoom) / 2);
    expect(transform.y).toBe(BRACKET_FIT_VIEW_PADDING);
  });

  test("com o zoom de abertura a borda para na margem, sem mostrar o meio", () => {
    const transform = bracketFitTransform({
      fitZoom: 0.98,
      graphHeight: 252,
      graphWidth: 672,
      viewportHeight: 700,
      viewportWidth: 393,
    });

    // O eixo que ESTOURA ancora na margem; o que cabe segue centrado.
    expect(transform.x).toBe(BRACKET_FIT_VIEW_PADDING);
    expect(transform.y).toBeCloseTo((700 - 252 * 0.98) / 2, 6);
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
  /** Estimativa do card de simples sem agendamento (o piso do card). */
  const ESTIMATE = bracketMatchEstimatedHeight({
    courtName: null,
    matchDate: null,
    modality: "singles",
  });

  test("medida igual à altura EFETIVA não commita (chave de 64 monta sem cascata)", () => {
    const heights = {};
    expect(
      commitCardHeight({
        estimatedHeight: ESTIMATE,
        heights,
        matchId: "m1",
        measured: ESTIMATE,
      })
    ).toBe(heights);

    const measured = { m1: 154 };
    expect(
      commitCardHeight({
        estimatedHeight: ESTIMATE,
        heights: measured,
        matchId: "m1",
        measured: 154,
      })
    ).toBe(measured);
  });

  test("medida igual à estimativa commita quando a altura efetiva era outra (o guard do IBX-0022 dropava)", () => {
    const next = commitCardHeight({
      estimatedHeight: ESTIMATE,
      heights: { m1: 154 },
      matchId: "m1",
      measured: ESTIMATE,
    });

    expect(next.m1).toBe(ESTIMATE);
  });

  test("a última medida vence nas duas direções (as duas acima do piso)", () => {
    const shrunk = commitCardHeight({
      estimatedHeight: ESTIMATE,
      heights: { m1: 200 },
      matchId: "m1",
      measured: 160,
    });
    expect(shrunk.m1).toBe(160);

    const grown = commitCardHeight({
      estimatedHeight: ESTIMATE,
      heights: shrunk,
      matchId: "m1",
      measured: 200,
    });
    expect(grown.m1).toBe(200);
    expect(grown).not.toBe(shrunk);
  });

  test("medida abaixo da estimativa resolve para a estimativa: card comprimido não rebaixa o nó", () => {
    const heights = { m1: 200 };

    // Medida menor que a conta do card é o container apertando o card, não um
    // card mais baixo: o piso resolve para a estimativa e é isso que devolve o
    // conector ao eixo; gravar o número comprimido fecharia o loop medida ->
    // nó curto -> medida.
    expect(
      commitCardHeight({
        estimatedHeight: ESTIMATE,
        heights,
        matchId: "m1",
        measured: ESTIMATE - 28,
      })
    ).toEqual({ m1: ESTIMATE });

    // E o piso também não é gravado em card ainda sem medida.
    const fresh = {};
    expect(
      commitCardHeight({
        estimatedHeight: ESTIMATE,
        heights: fresh,
        matchId: "m2",
        measured: 0,
      })
    ).toBe(fresh);
  });

  test("commita só o card medido, preservando a identidade dos outros", () => {
    const heights = { other: 120 };
    const next = commitCardHeight({
      estimatedHeight: ESTIMATE,
      heights,
      matchId: "m1",
      measured: 150,
    });

    expect(next).toEqual({ m1: 150, other: 120 });
    expect(next).not.toBe(heights);
  });
});

// A altura do card no grafo: a ESTIMATIVA é a conta do card (p-3 + gaps + chip
// do topo + pontas + divisória + chip do pé) e é ela que o layout do primeiro
// frame usa. Estimativa que não casa com o card = malha errada, e malha errada
// é re-layout e re-enquadro depois de medir.
describe("bracketMatchEstimatedHeight: a altura que o grafo usa", () => {
  const SCHEDULED = { courtName: "Quadra 2", matchDate: "2026-09-23" };
  const UNSCHEDULED = { courtName: null, matchDate: null };

  test("duplas: 217 com agendamento e 177 sem (as duas pontas empilham)", () => {
    expect(
      bracketMatchEstimatedHeight({ ...SCHEDULED, modality: "doubles" })
    ).toBe(217);
    expect(
      bracketMatchEstimatedHeight({ ...UNSCHEDULED, modality: "doubles" })
    ).toBe(177);
  });

  test("simples: 189 com agendamento e 149 sem (um avatar por ponta)", () => {
    expect(
      bracketMatchEstimatedHeight({ ...SCHEDULED, modality: "singles" })
    ).toBe(189);
    expect(
      bracketMatchEstimatedHeight({ ...UNSCHEDULED, modality: "singles" })
    ).toBe(149);
  });

  test("o pé só conta com dia E quadra, o mesmo critério do card", () => {
    expect(bracketMatchHasScheduleFooter(SCHEDULED)).toBeTrue();
    expect(
      bracketMatchHasScheduleFooter({
        courtName: null,
        matchDate: "2026-09-23",
      })
    ).toBeFalse();
    expect(
      bracketMatchHasScheduleFooter({ courtName: "Quadra 2", matchDate: null })
    ).toBeFalse();
  });

  test("contraprova: estimativa menor que o card re-layouta a malha inteira", () => {
    const BYE_SLOTS = [0, 2, 3, 4, 6];
    const SHAPE = [8, 4, 2, 1].map(
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
    const buildWith = (
      cardHeightOf: (match: TournamentMatchWithSides) => number
    ) =>
      layoutBracketCategoryTree(SHAPE, {
        cardHeightOf,
        cardWidth: 256,
        connectorWidth: 32,
        gapY: 12,
      });
    const estimate = bracketMatchEstimatedHeight({
      ...UNSCHEDULED,
      modality: "singles",
    });
    const card = (match: TournamentMatchWithSides) =>
      isByeMatch(match) ? BRACKET_BYE_CARD_HEIGHT : estimate;

    // A conta do card e uma suposição 13 pt menor (a estimativa antiga do nó).
    const settled = buildWith(card);
    const guessed = buildWith((match) =>
      isByeMatch(match) ? BRACKET_BYE_CARD_HEIGHT : estimate - 13
    );

    expect(guessed.height).toBeLessThan(settled.height);
    expect(settled.height - guessed.height).toBeGreaterThan(24);
  });
});

// bracketFitTransform: o estado INICIAL do transform do canvas e o valor
// re-aplicado a cada re-enquadramento saem da MESMA função, então o primeiro
// frame nativo do conteúdo já nasce no fit (sem pintar em 1x e saltar).
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

  test("grafo maior que o viewport ancora na borda de cima/esquerda (pan inicial)", () => {
    const cramped = { viewportHeight: 400, viewportWidth: 300 };
    const transform = bracketFitTransform({
      fitZoom: 1,
      graphHeight: GRAPH.graphHeight,
      graphWidth: GRAPH.graphWidth,
      ...cramped,
    });

    // Com zoom ACIMA do fit o conteúdo é maior que o viewport: centrar (margem
    // negativa) mostraria o MEIO do grafo, então a borda para na margem.
    expect(transform.x).toBe(BRACKET_FIT_VIEW_PADDING);
    expect(transform.y).toBe(BRACKET_FIT_VIEW_PADDING);
  });
});

// bracketOpeningColumn: a rodada do enquadramento de abertura é a MENOS
// avançada que ainda tem partida sem resultado.
describe("bracketOpeningColumn", () => {
  const buildLayout = (rounds: string[][]) =>
    layoutBracketCategoryTree(
      rounds.map((round, index) =>
        round.map((status, slot) =>
          buildMatch(`r${index + 1}-${slot}`, "c", index + 1, slot, status)
        )
      ),
      SIZING
    );

  test("sem nada lançado enquadra a primeira rodada", () => {
    expect(
      bracketOpeningColumn(
        buildLayout([["scheduled", "scheduled"], ["scheduled"]])
      )
    ).toEqual({ bottom: 212, top: 0, x: 0 });
  });

  test("com a rodada 1 decidida enquadra a rodada aberta seguinte", () => {
    expect(
      bracketOpeningColumn(buildLayout([["finished", "finished"], ["pending"]]))
    ).toEqual({ bottom: 156, top: 56, x: 288 });
  });

  test("bye e vaga morta não seguram a rodada aberta", () => {
    expect(
      bracketOpeningColumn(buildLayout([["walkover", "vacant"], ["scheduled"]]))
    ).toEqual({ bottom: 156, top: 56, x: 288 });
  });

  test("tudo decidido cai na última rodada (a final)", () => {
    expect(
      bracketOpeningColumn(
        buildLayout([
          ["finished", "finished", "finished", "finished"],
          ["finished", "finished"],
          ["finished"],
        ])
      )
    ).toEqual({ bottom: 268, top: 168, x: 576 });
  });

  test("layout vazio não tem coluna", () => {
    expect(
      bracketOpeningColumn(layoutBracketCategoryTree([], SIZING))
    ).toBeNull();
  });
});

describe("bracketOpeningTransform", () => {
  const VIEWPORT = { viewportHeight: 956, viewportWidth: 440 };

  const buildLayout = (rounds: string[][]) =>
    layoutBracketCategoryTree(
      rounds.map((round, index) =>
        round.map((status, slot) =>
          buildMatch(`r${index + 1}-${slot}`, "c", index + 1, slot, status)
        )
      ),
      SIZING
    );

  const zoomFor = (layout: BracketTreeLayout) => {
    const fitZoom =
      bracketFitZoom({
        graphHeight: layout.height,
        graphWidth: layout.width,
        ...VIEWPORT,
      }) ?? 1;

    return {
      fitZoom,
      openingZoom: bracketOpeningZoom({
        cardWidth: SIZING.cardWidth,
        connectorWidth: SIZING.connectorWidth,
        fitZoom,
        viewportWidth: VIEWPORT.viewportWidth,
      }),
    };
  };

  test("enquadra a rodada aberta na margem e tira a rodada 1 da tela", () => {
    const layout = buildLayout([
      Array.from({ length: 16 }, () => "finished"),
      Array.from({ length: 8 }, () => "scheduled"),
      Array.from({ length: 4 }, () => "scheduled"),
      Array.from({ length: 2 }, () => "scheduled"),
      ["scheduled"],
    ]);
    const column = bracketOpeningColumn(layout) ?? { bottom: 0, top: 0, x: 0 };
    const transform = bracketOpeningTransform({
      column,
      ...zoomFor(layout),
      graphHeight: layout.height,
      graphWidth: layout.width,
      ...VIEWPORT,
    });

    // Zoom de UMA coluna: a rodada aberta encosta na margem de cima e da
    // esquerda, o card inteiro cabe na largura e a coluna da esquerda sai da
    // tela.
    expect(transform.zoom).toBe(1);
    expect(transform.x).toBe(-264);
    expect(transform.y).toBe(-32);
    expect(transform.x + transform.zoom * column.x).toBe(
      BRACKET_FIT_VIEW_PADDING
    );
    expect(
      transform.x + transform.zoom * (column.x + SIZING.cardWidth)
    ).toBeLessThanOrEqual(VIEWPORT.viewportWidth);
    expect(transform.x + transform.zoom * 0).toBeLessThan(0);
  });

  test("com tudo decidido centra a final na tela", () => {
    const layout = buildLayout([
      Array.from({ length: 4 }, () => "finished"),
      Array.from({ length: 2 }, () => "finished"),
      ["finished"],
    ]);
    const column = bracketOpeningColumn(layout) ?? { bottom: 0, top: 0, x: 0 };
    const transform = bracketOpeningTransform({
      column,
      ...zoomFor(layout),
      graphHeight: layout.height,
      graphWidth: layout.width,
      ...VIEWPORT,
    });

    expect(transform.x).toBe(-552);
    expect(transform.zoom).toBe(1);
    // Coluna mais baixa que a tela: o centro dela cai no centro do viewport.
    expect(
      transform.y + transform.zoom * ((column.top + column.bottom) / 2)
    ).toBeCloseTo(VIEWPORT.viewportHeight / 2, 6);
  });

  test("na 1ª rodada o enquadramento é o mesmo de antes", () => {
    const layout = buildLayout([
      Array.from({ length: 16 }, () => "scheduled"),
      Array.from({ length: 8 }, () => "scheduled"),
      Array.from({ length: 4 }, () => "scheduled"),
      Array.from({ length: 2 }, () => "scheduled"),
      ["scheduled"],
    ]);
    const { fitZoom, openingZoom } = zoomFor(layout);

    expect(
      bracketOpeningTransform({
        column: bracketOpeningColumn(layout),
        fitZoom,
        graphHeight: layout.height,
        graphWidth: layout.width,
        openingZoom,
        ...VIEWPORT,
      })
    ).toEqual(
      bracketFitTransform({
        fitZoom: openingZoom,
        graphHeight: layout.height,
        graphWidth: layout.width,
        ...VIEWPORT,
      })
    );
  });

  test("grafo inteiro já no zoom de abertura: nada de deslocar", () => {
    const layout = buildLayout([["finished", "finished"], ["scheduled"]]);
    const wideViewport = { viewportHeight: 2000, viewportWidth: 2000 };
    const fitZoom =
      bracketFitZoom({
        graphHeight: layout.height,
        graphWidth: layout.width,
        ...wideViewport,
      }) ?? 1;
    const openingZoom = bracketOpeningZoom({
      cardWidth: SIZING.cardWidth,
      connectorWidth: SIZING.connectorWidth,
      fitZoom,
      viewportWidth: wideViewport.viewportWidth,
    });

    expect(
      bracketOpeningTransform({
        column: bracketOpeningColumn(layout),
        fitZoom,
        graphHeight: layout.height,
        graphWidth: layout.width,
        openingZoom,
        ...wideViewport,
      })
    ).toEqual(
      bracketFitTransform({
        fitZoom: openingZoom,
        graphHeight: layout.height,
        graphWidth: layout.width,
        ...wideViewport,
      })
    );
  });

  test("sem coluna cai no fit do grafo", () => {
    const layout = layoutBracketCategoryTree([], SIZING);

    expect(
      bracketOpeningTransform({
        column: null,
        fitZoom: 0.5,
        graphHeight: 0,
        graphWidth: 0,
        openingZoom: 1,
        ...VIEWPORT,
      })
    ).toEqual(
      bracketFitTransform({
        fitZoom: 1,
        graphHeight: 0,
        graphWidth: 0,
        ...VIEWPORT,
      })
    );
    expect(layout.cards).toHaveLength(0);
  });
});
