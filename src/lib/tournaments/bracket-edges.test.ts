import { describe, expect, test } from "bun:test";

import {
  bracketEdgeParts,
  bracketEdgeRoute,
  decomposeEdgeRoute,
  type BracketPoint,
  type BracketRect,
} from "./bracket-edges";

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
