/**
 * Edge geometry for the bracket canvas (PLN-0002, stage B): the classic
 * orthogonal connector — straight out of the child card, one straight run
 * down the corridor, straight into the parent card, sharp corners. No
 * smoothstep, no arcs, no elbows: the user's verdict on rounded corners was
 * "make them straight, it's that simple" (challonge/start.gg look).
 *
 * Everything is computed once per React render in graph coordinates; the
 * canvas transform carries the parts during gestures.
 */

/** A box in graph coordinates (a card's laid-out rect). */
export type BracketRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type BracketPoint = { x: number; y: number };

/** One drawable piece of a connector: an axis-aligned bar. */
export type BracketEdgePart = {
  height: number;
  kind: "bar";
  width: number;
  x: number;
  y: number;
};

/** The center of a card's right face — where a child connector departs. */
function rightFaceCenter(rect: BracketRect): BracketPoint {
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

/** The center of a card's left face — where a parent connector arrives. */
function leftFaceCenter(rect: BracketRect): BracketPoint {
  return { x: rect.x, y: rect.y + rect.height / 2 };
}

/**
 * The classic bracket route: straight out of the child, one vertical run in
 * the middle of the corridor, straight into the parent. Both children of a
 * parent share the corridor (same column edges), so their verticals land on
 * the same x and read as the classic fork/join. Aligned centers collapse to
 * a single horizontal run.
 */
export function bracketEdgeRoute(
  from: BracketRect,
  to: BracketRect
): BracketPoint[] {
  const a = rightFaceCenter(from);
  const b = leftFaceCenter(to);

  if (a.y === b.y) {
    return [a, b];
  }

  const corridorX = (from.x + from.width + to.x) / 2;
  return [a, { x: corridorX, y: a.y }, { x: corridorX, y: b.y }, b];
}

/**
 * Splits an axis-aligned route into bars. Each bar extends half the
 * thickness beyond both of its endpoints: terminal overlap anchors the
 * connector half a stroke INSIDE the cards (cards render on top, so the
 * visible tip lands exactly on the border — attachment by construction),
 * and interior overlap welds the sharp corners seam-free.
 */
export function decomposeEdgeRoute(
  route: BracketPoint[],
  thickness: number
): BracketEdgePart[] {
  const half = thickness / 2;

  // Collapse collinear waypoints: the route keeps them, but a merged run is
  // one bar instead of three.
  const waypoints: BracketPoint[] = [];
  for (const point of route) {
    const a = waypoints.at(-2);
    const b = waypoints.at(-1);
    if (
      a &&
      b &&
      ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))
    ) {
      waypoints.pop();
    }
    waypoints.push(point);
  }

  const parts: BracketEdgePart[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const p = waypoints[i]!;
    const q = waypoints[i + 1]!;

    if (p.x === q.x) {
      parts.push({
        height: Math.abs(q.y - p.y) + thickness,
        kind: "bar",
        width: thickness,
        x: p.x - half,
        y: Math.min(p.y, q.y) - half,
      });
    } else if (p.y === q.y) {
      parts.push({
        height: thickness,
        kind: "bar",
        width: Math.abs(q.x - p.x) + thickness,
        x: Math.min(p.x, q.x) - half,
        y: p.y - half,
      });
    }
  }

  return parts;
}

/**
 * One child->parent connector as Views, in graph coordinates. Attachment is
 * by construction: the terminal bars overlap the card edges by half a
 * stroke (hidden under the cards), so the visible line ends exactly on the
 * border at any zoom.
 */
export function bracketEdgeParts(input: {
  from: BracketRect;
  thickness: number;
  to: BracketRect;
}): BracketEdgePart[] {
  return decomposeEdgeRoute(
    bracketEdgeRoute(input.from, input.to),
    input.thickness
  );
}
