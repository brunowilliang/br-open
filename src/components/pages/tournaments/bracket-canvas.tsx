import { memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useCSSVariable } from "uniwind";

import {
  bracketEdgeParts,
  type BracketEdgePart,
} from "@/lib/tournaments/bracket-edges";
import {
  bracketFitZoom,
  clampPanToViewport,
  pinchFollowTransform,
  type BracketTreeLayout,
} from "@/lib/tournaments/bracket-tree";

/** Distance a finger travels before the pan takes over (taps reach cards). */
const PAN_ACTIVATION_DISTANCE = 12;
/** Connector stroke in GRAPH points: constant like everything else in the
 * graph, so it scales with the content (stage C verdict — end-of-gesture
 * stroke compensation snapped and read as "the line thickens"). */
const EDGE_STROKE_GRAPH = 1.5;

const ZOOM_TIMING = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
} as const;

type BracketCanvasCard = BracketTreeLayout["cards"][number];

type BracketCanvasProps = {
  layout: BracketTreeLayout;
  renderCard: (card: BracketCanvasCard) => ReactNode;
};

function EdgePartView({ part, tint }: { part: BracketEdgePart; tint: string }) {
  return (
    <View
      style={{
        backgroundColor: tint,
        height: part.height,
        left: part.x,
        position: "absolute",
        top: part.y,
        width: part.width,
      }}
    />
  );
}

/**
 * The connectors, one absolute View tree inside the transformed layer.
 * Static in graph coordinates with a constant graph-space stroke: the parent
 * transform carries them and the stroke scales with the content, exactly
 * like the cards (stage C verdict — end-of-gesture stroke compensation
 * snapped and was removed).
 */
const BracketEdges = memo(function BracketEdges({
  cards,
  links,
  thickness,
  tint,
}: {
  cards: BracketTreeLayout["cards"];
  links: BracketTreeLayout["links"];
  thickness: number;
  tint: string;
}) {
  const parts = useMemo(() => {
    const cardsById = new Map(cards.map((card) => [card.match.id, card]));
    const edges: Array<{ key: string; part: BracketEdgePart }> = [];

    for (const link of links) {
      const from = cardsById.get(link.from);
      const to = cardsById.get(link.to);
      if (!(from && to)) {
        continue;
      }
      for (const part of bracketEdgeParts({
        from: from.layout,
        thickness,
        to: to.layout,
      })) {
        edges.push({ key: `${link.from}>${link.to}:${edges.length}`, part });
      }
    }

    return edges;
  }, [cards, links, thickness]);

  return (
    <View pointerEvents="none" style={{ height: 0, width: 0 }}>
      {parts.map(({ key, part }) => (
        <EdgePartView key={key} part={part} tint={tint} />
      ))}
    </View>
  );
});

/**
 * PLN-0002 bracket canvas: pan + pinch + double-tap over ONE transformed
 * layer. Everything that moves together (cards and connector Views) lives
 * inside the single Animated.View that owns the transform; there is no
 * second coordinate system, so layers cannot drift apart by construction.
 *
 * Engine: RNGH gestures drive three shared values on the UI thread; no
 * React state changes during or after a gesture (the stroke is constant
 * graph-space). Pinch activates manually on the second finger, pan stays
 * single-finger, double-tap toggles fit <-> native zoom (QA R15/R18: the
 * zoom clamps to [fitZoom, 1] — the whole bracket visible at rest, never an
 * upscale).
 */
export function BracketCanvas({ layout, renderCard }: BracketCanvasProps) {
  const [viewport, setViewport] = useState({ height: 0, width: 0 });

  const tintToken = useCSSVariable("--color-muted-foreground");
  const tint = typeof tintToken === "string" ? tintToken : "#878787";

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinchStart = useSharedValue({
    fx: 0,
    fy: 0,
    x: 0,
    y: 0,
    zoom: 1,
  });
  const pinchActive = useSharedValue(false);
  /** Set the moment a second pointer lands; cleared by the next clean
   * single-pointer touch. While set, a double-tap "activation" is really
   * two fingers of a pinch landing fast — blocked. This is the clock-free
   * form of a multi-touch recency window: RNGH events carry no timestamp
   * the worklet can read, and it needs no tuning constant. */
  const multiTouchedSinceTap = useSharedValue(false);

  const fitZoom = useMemo(
    () =>
      bracketFitZoom({
        graphHeight: layout.height,
        graphWidth: layout.width,
        viewportHeight: viewport.height,
        viewportWidth: viewport.width,
      }),
    [layout.height, layout.width, viewport.height, viewport.width]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setViewport((current) =>
      current.height === height && current.width === width
        ? current
        : { height, width }
    );
  }, []);

  // The bracket starts framed and stays framed through every resize of the
  // graph itself (card heights settling, category tabs remount the canvas):
  // snap the transform to the centered fit before paint (QA R18).
  useLayoutEffect(() => {
    if (fitZoom === null) {
      return;
    }
    zoom.value = fitZoom;
    translateX.value = (viewport.width - layout.width * fitZoom) / 2;
    translateY.value = (viewport.height - layout.height * fitZoom) / 2;
  }, [
    fitZoom,
    layout.height,
    layout.width,
    translateX,
    translateY,
    viewport,
    zoom,
  ]);

  // Double-tap zoom animation, run from the RN thread: gesture worklets
  // cannot capture the cross-module `withTiming` import (ReferenceError on
  // the UI thread — the frozen-canvas bug class, caught live in Metro).
  // Writing shared values from RN is ordinary Reanimated.
  const animateTo = useCallback(
    (target: number, x: number, y: number) => {
      zoom.value = withTiming(target, ZOOM_TIMING);
      translateX.value = withTiming(x, ZOOM_TIMING);
      translateY.value = withTiming(y, ZOOM_TIMING);
    },
    [translateX, translateY, zoom]
  );

  const gesture = useMemo(() => {
    if (fitZoom === null) {
      return null;
    }
    const { height: vh, width: vw } = viewport;
    const gh = layout.height;
    const gw = layout.width;

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(PAN_ACTIVATION_DISTANCE)
      .averageTouches(true)
      .onBegin(() => {
        "worklet";
        panStart.value = { x: translateX.value, y: translateY.value };
      })
      // While the pinch is active it owns the translate entirely (the
      // focal-follow already carries two-finger panning): a simultaneous pan
      // adding its own translation on top is the classic double-apply that
      // makes a pinch zoom "the whole view" instead of the content under
      // the fingers (stage B symptom report).
      .onUpdate((event) => {
        "worklet";
        if (pinchActive.value) {
          return;
        }
        const next = clampPanToViewport({
          graphHeight: gh,
          graphWidth: gw,
          viewportHeight: vh,
          viewportWidth: vw,
          x: panStart.value.x + event.translationX,
          y: panStart.value.y + event.translationY,
          zoom: zoom.value,
        });
        translateX.value = next.x;
        translateY.value = next.y;
      })
      // A stream can deliver its whole travel in the single event that
      // activates the gesture (synthetic automation does); a finger streams
      // updates instead. Settling the final translation here makes the pan
      // correct under both, and is a no-op for a streamed finger.
      .onEnd((event) => {
        "worklet";
        if (pinchActive.value) {
          return;
        }
        const next = clampPanToViewport({
          graphHeight: gh,
          graphWidth: gw,
          viewportHeight: vh,
          viewportWidth: vw,
          x: panStart.value.x + event.translationX,
          y: panStart.value.y + event.translationY,
          zoom: zoom.value,
        });
        translateX.value = next.x;
        translateY.value = next.y;
      });

    // Manual activation (zoom-toolkit recipe): the pinch only comes alive on
    // the second finger and dies the moment one lifts, so it never races the
    // single-finger pan for the same touch.
    const pinch = Gesture.Pinch()
      .manualActivation(true)
      .onTouchesDown((event, stateManager) => {
        "worklet";
        if (event.numberOfTouches >= 2) {
          multiTouchedSinceTap.value = true;
        }
        if (event.numberOfTouches === 2) {
          stateManager.begin();
        }
      })
      .onTouchesMove((event, stateManager) => {
        "worklet";
        if (event.numberOfTouches !== 2) {
          return;
        }
        stateManager.activate();
      })
      .onTouchesUp((event, stateManager) => {
        "worklet";
        if (event.numberOfTouches !== 2) {
          stateManager.end();
        }
      })
      .onStart((event) => {
        "worklet";
        // Single writer: a double-tap animation still in flight would fight
        // the pinch for zoom/translate frame by frame (the stage C stutter).
        // It dies here, seeds read the values it left behind.
        cancelAnimation(zoom);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        pinchActive.value = true;
        // Seeds are read from the REAL fingers at activation: baseline
        // translate/zoom plus the focal they land on (no jump when the
        // second finger touches down).
        pinchStart.value = {
          fx: event.focalX,
          fy: event.focalY,
          x: translateX.value,
          y: translateY.value,
          zoom: zoom.value,
        };
      })
      .onFinalize(() => {
        "worklet";
        pinchActive.value = false;
      })
      .onUpdate((event) => {
        "worklet";
        // Focal-follow (zoom-toolkit core, unit-tested in bracket-tree):
        // seeds captured once at activation, the focal rides the fingers
        // every frame — the point under them never moves on screen, and a
        // two-finger drag pans because the focal itself moves.
        zoom.value = Math.min(
          Math.max(pinchStart.value.zoom * event.scale, fitZoom),
          1
        );
        const follow = pinchFollowTransform({
          focalX: event.focalX,
          focalY: event.focalY,
          fromScale: pinchStart.value.zoom,
          fromX: pinchStart.value.x,
          fromY: pinchStart.value.y,
          startFocalX: pinchStart.value.fx,
          startFocalY: pinchStart.value.fy,
          toScale: zoom.value,
        });
        const clamped = clampPanToViewport({
          graphHeight: gh,
          graphWidth: gw,
          viewportHeight: vh,
          viewportWidth: vw,
          x: follow.x,
          y: follow.y,
          zoom: zoom.value,
        });
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      // Same settle-at-end safety as the pan: streams that deliver the whole
      // scale in one event still land the final transform.
      .onEnd((event) => {
        "worklet";
        zoom.value = Math.min(
          Math.max(pinchStart.value.zoom * event.scale, fitZoom),
          1
        );
        const follow = pinchFollowTransform({
          focalX: event.focalX,
          focalY: event.focalY,
          fromScale: pinchStart.value.zoom,
          fromX: pinchStart.value.x,
          fromY: pinchStart.value.y,
          startFocalX: pinchStart.value.fx,
          startFocalY: pinchStart.value.fy,
          toScale: zoom.value,
        });
        const clamped = clampPanToViewport({
          graphHeight: gh,
          graphWidth: gw,
          viewportHeight: vh,
          viewportWidth: vw,
          x: follow.x,
          y: follow.y,
          zoom: zoom.value,
        });
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      // Hardened tap: the taps must be still (pinch fingers land far
      // apart, so their "two taps" fail the delta) and brisk.
      .maxDeltaX(10)
      .maxDeltaY(10)
      .maxDuration(250)
      .onTouchesDown((event) => {
        "worklet";
        // A clean single-pointer touch starts a fresh tap sequence; the
        // second finger of a pinch lands before any of its fingers lift,
        // so the flag is armed by the time a spurious activation could
        // fire.
        if (event.numberOfTouches === 1) {
          multiTouchedSinceTap.value = false;
        }
      })
      .onEnd((event) => {
        "worklet";
        // A live pinch owns the transform, and a recent multi-touch means
        // those "two taps" were fingers landing, not taps.
        if (pinchActive.value || multiTouchedSinceTap.value) {
          multiTouchedSinceTap.value = false;
          return;
        }
        const current = zoom.value;
        const toNative = current <= (fitZoom + 1) / 2;
        const target = toNative ? 1 : fitZoom;
        const nextX = toNative
          ? event.x - (event.x - translateX.value) / current
          : (vw - gw * target) / 2;
        const nextY = toNative
          ? event.y - (event.y - translateY.value) / current
          : (vh - gh * target) / 2;
        const clamped = clampPanToViewport({
          graphHeight: gh,
          graphWidth: gw,
          viewportHeight: vh,
          viewportWidth: vw,
          x: nextX,
          y: nextY,
          zoom: target,
        });
        // withTiming is a JS-module import: worklets cannot capture it (the
        // frozen-Canvas bug class — a ReferenceError on the UI thread, seen
        // live in Metro). Hand the target to the RN thread instead, the
        // reportViewport pattern the previous canvas already proved.
        scheduleOnRN(animateTo, target, clamped.x, clamped.y);
      });

    // The double-tap must NOT sit above the pan in an Exclusive: RNGH's
    // Exclusive vetoes lower-priority gestures the moment the tap begins
    // tracking (every touch begins a tap), so the pan would never receive a
    // single event — proven live with probes. Taps and pan are naturally
    // exclusive by threshold (tap maxDist vs PAN_ACTIVATION_DISTANCE), the
    // zoom-toolkit composition.
    // Tap and pan are naturally exclusive by threshold (tap maxDist vs
    // PAN_ACTIVATION_DISTANCE). The double-tap must NOT sit above the pan in
    // an Exclusive: RNGH's Exclusive vetoes lower-priority gestures the
    // moment the tap begins tracking (every touch begins a tap), so the pan
    // would never receive a single event — proven live with probes.
    return Gesture.Simultaneous(pan, pinch, doubleTap);
  }, [
    animateTo,
    fitZoom,
    layout.height,
    layout.width,
    multiTouchedSinceTap,
    panStart,
    pinchActive,
    pinchStart,
    translateX,
    translateY,
    viewport,
    zoom,
  ]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
  }));

  const cardsContent = useMemo(
    () =>
      layout.cards.map((card) => (
        <View
          key={card.match.id}
          style={{
            height: card.layout.height,
            left: card.layout.x,
            position: "absolute",
            top: card.layout.y,
            width: card.layout.width,
          }}
        >
          {renderCard(card)}
        </View>
      )),
    [layout.cards, renderCard]
  );

  const measured = fitZoom !== null && gesture;

  return (
    <View collapsable={false} onLayout={handleLayout} style={{ flex: 1 }}>
      {measured ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false} style={{ flex: 1, overflow: "hidden" }}>
            {/* The single transform owner (screen = translate + zoom * graph,
                origin at the graph's top-left). Cards render after the
                connectors so terminal bars land under the card borders. */}
            <Animated.View
              collapsable={false}
              style={[
                {
                  height: layout.height,
                  left: 0,
                  position: "absolute",
                  top: 0,
                  transformOrigin: [0, 0, 0],
                  width: layout.width,
                },
                contentStyle,
              ]}
            >
              <BracketEdges
                cards={layout.cards}
                links={layout.links}
                thickness={EDGE_STROKE_GRAPH}
                tint={tint}
              />
              {cardsContent}
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}
