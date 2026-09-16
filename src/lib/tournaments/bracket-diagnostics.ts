/**
 * TEMPORARY (BUG-0033): dev-only probes over the bracket render path.
 *
 * O diagnóstico das linhas do chaveamento precisa de NÚMEROS do device:
 * retângulo e âncora por card, a origem da altura (estimativa vs medida),
 * o commit que o layout aplicou (ou deixou de aplicar), o fit/espessura
 * do traço e o estado do bucket do torneio. Cada probe imprime UMA linha
 * por assinatura (dedupe) — nunca por frame de gesto/render.
 *
 * Remover este arquivo e os call sites quando o BUG-0033 fechar.
 */

const logged = new Set<string>();
let tick = 0;

function emit(event: string, signature: string, payload: unknown) {
  if (!__DEV__ || logged.has(signature)) {
    return;
  }
  logged.add(signature);
  tick += 1;
  console.log(
    `[bracket-dbg] #${tick} t=${Date.now()} ${event} ${JSON.stringify(payload)}`
  );
}

/** Resumo do layout ativo: tamanho do grafo, cards/links e a origem das alturas. */
export function logBracketLayout(input: {
  estimated: number;
  focusSeed: number;
  graphHeight: number;
  graphWidth: number;
  links: number;
  measured: number;
  tournamentId: string;
  treeId: string;
}) {
  emit(
    "layout",
    `layout:${input.treeId}:${input.focusSeed}:${input.graphWidth}x${input.graphHeight}:${input.measured}/${input.estimated}`,
    input
  );
}

/**
 * Retângulo de cada card do grafo + a âncora y que os conectores usam
 * (centro da face = y + h/2) + a ORIGEM da altura: "measured" é o valor
 * medido no card, "estimate" é o fallback (nunca medido).
 *
 * UMA tabela por montagem do canvas (o estado de ORIGEM, logo depois do
 * mount, com as alturas estimadas): o estado assentado se reconstrói das
 * linhas HEIGHT-MISMATCH + dos resumos de layout, e uma tabela por commit
 * (até 63 na chave de 64) afogaria o log.
 */
export function logBracketRects(input: {
  cards: Array<{
    anchorY: number;
    height: number;
    id: string;
    round: number;
    source: "estimate" | "measured";
    x: number;
    y: number;
  }>;
  focusSeed: number;
  treeId: string;
}) {
  emit(
    "rects",
    `rects:${input.treeId}:${input.focusSeed}`,
    input.cards.map((card) => ({
      a: card.anchorY,
      h: card.height,
      id: card.id,
      r: card.round,
      s: card.source,
      x: card.x,
      y: card.y,
    }))
  );
}

/**
 * A linha decisiva: o card mediu uma altura que NÃO é a que o layout está
 * usando. Com o guard antigo do IBX-0022 (comparação com a constante) a
 * medida 136 era descartada e o retângulo ficava congelado — é este evento
 * que prova a causa raiz no device.
 */
export function logBracketHeightMismatch(input: {
  layoutHeight: number;
  matchId: string;
  measured: number;
  oldGuardWouldDrop: boolean;
  round: number;
  treeId: string;
}) {
  emit(
    "HEIGHT-MISMATCH",
    `mismatch:${input.treeId}:${input.matchId}:${input.layoutHeight}->${input.measured}`,
    input
  );
}

/** Fit do enquadramento e a espessura do traço em pt de grafo e em pixel de tela. */
export function logBracketViewport(input: {
  fitZoom: number;
  graphHeight: number;
  graphWidth: number;
  strokeGraph: number;
  viewportHeight: number;
  viewportWidth: number;
}) {
  const strokePt = input.strokeGraph * input.fitZoom;
  emit(
    "viewport",
    `viewport:${input.graphWidth}x${input.graphHeight}:${input.fitZoom}:${input.viewportWidth}x${input.viewportHeight}`,
    {
      ...input,
      strokeDevicePx: Number((strokePt * 3).toFixed(2)),
      strokePt: Number(strokePt.toFixed(3)),
      subPixel: strokePt * 3 < 1,
    }
  );
}
