// Edge geometry for the bracket canvas, in graph coordinates: every part is
// pure geometry between two laid-out cards — no coordinate or edge exists
// outside the assembled bracket (the canvas transform, and any offset measured
// on screen, is layout, not computed here).

export type BracketRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type BracketPoint = { x: number; y: number };

export type BracketEdgePart = {
  height: number;
  kind: "bar";
  width: number;
  x: number;
  y: number;
};

function rightFaceCenter(rect: BracketRect): BracketPoint {
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

function leftFaceCenter(rect: BracketRect): BracketPoint {
  return { x: rect.x, y: rect.y + rect.height / 2 };
}

// Both children of a parent share the corridor (same column edges), so their
// verticals land on the same x and read as one trunk; aligned centers collapse
// to a single horizontal run.
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

// Every bar extends half the thickness past both endpoints: the terminals
// anchor the connector half a stroke INSIDE the cards (they render on top, so
// the visible tip lands exactly on the border) and interior overlap welds the
// sharp corners seam-free.
export function decomposeEdgeRoute(
  route: BracketPoint[],
  thickness: number
): BracketEdgePart[] {
  const half = thickness / 2;

  // Collinear waypoints merge into one bar.
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
