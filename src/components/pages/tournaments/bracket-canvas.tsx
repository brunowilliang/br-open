import type { ReactNode } from "react";
import { memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
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

import {
  bracketEdgeParts,
  type BracketEdgePart,
} from "@/lib/tournaments/bracket-edges";
import {
  bracketFitZoom,
  bracketOpeningColumn,
  bracketOpeningTransform,
  bracketOpeningZoom,
  clampPanToViewport,
  pinchFollowTransform,
  type BracketOpeningColumn,
  type BracketTreeLayout,
} from "@/lib/tournaments/bracket-tree";
import { useThemeColor } from "heroui-native";

/** Distance a finger travels before the pan takes over (taps reach cards). */
const PAN_ACTIVATION_DISTANCE = 12;
/** Connector stroke em pt de GRAFO: constante como o resto do grafo, escala com
 * o conteúdo (compensar a espessura no fim do gesto "engrossava" a linha). */
const EDGE_STROKE_GRAPH = 1.5;

const ZOOM_TIMING = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
} as const;

type BracketCanvasCard = BracketTreeLayout["cards"][number];

type BracketCanvasProps = {
  /** Largura do card e do cotovelo em pt de GRAFO: é o que define quantas
   * colunas cabem no enquadramento de abertura. */
  cardWidth: number;
  connectorWidth: number;
  /** Versão monotônica do foco: mudar (re-entrada na tela) re-enquadra a chave
   * no fit SEM remontar o canvas (o remount por foco piscava a tela). */
  focusSeed: number;
  layout: BracketTreeLayout;
  renderCard: (card: BracketCanvasCard) => ReactNode;
};

type FramedBracketContentProps = Omit<
  BracketCanvasProps,
  "cardWidth" | "connectorWidth"
> & {
  /** Já não-nulo: o filho só monta depois do viewport medido. */
  fitZoom: number;
  /** Coluna do enquadramento de abertura (a rodada ainda aberta). */
  openingColumn: BracketOpeningColumn | null;
  /** Zoom da ABERTURA (uma coluna): o transform inicial e o re-enquadramento da
   * re-entrada usam ele; `fitZoom` (a chave inteira) é o piso do gesto. */
  openingZoom: number;
  viewport: { height: number; width: number };
};

function EdgePartView({ part, tint }: { part: BracketEdgePart; tint: string }) {
  return (
    // Barras filhas DIRETAS do container dos cards (sem camada 0x0 no caminho):
    // cada uma carrega o próprio pointerEvents none.
    <View
      pointerEvents="none"
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

/** Conectores como Views ABSOLUTE em coordenadas de grafo, filhas DIRETAS do
 * mesmo container dos cards: sem view intermediária (superfície 0x0 no caminho
 * não recebe toque). A stroke é constante em pt de grafo, como os cards. */
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
    // Ordem conectores -> cards preservada no canvas: as barras terminais ficam
    // sob a borda dos cards.
    <>
      {parts.map(({ key, part }) => (
        <EdgePartView key={key} part={part} tint={tint} />
      ))}
    </>
  );
});

/** Conteúdo enquadrado: dono do transform (pan + pinch + double-tap numa ÚNICA
 * camada transformada — sem segundo sistema de coordenadas as camadas não podem
 * divergir) e dos cards/conectores. Monta só com o fit pronto porque
 * `useSharedValue` só aceita valor inicial na PRIMEIRA renderização: um seed
 * condicional nasceria em identidade e o primeiro frame nativo pintaria o grafo
 * gigante antes de saltar pro fit (a piscada da 1ª abertura). */
function FramedBracketContent({
  fitZoom,
  focusSeed,
  layout,
  openingColumn,
  openingZoom,
  renderCard,
  viewport,
}: FramedBracketContentProps) {
  const tint = useThemeColor("muted");

  const initialTransform = bracketOpeningTransform({
    column: openingColumn,
    fitZoom,
    graphHeight: layout.height,
    graphWidth: layout.width,
    openingZoom,
    viewportHeight: viewport.height,
    viewportWidth: viewport.width,
  });

  const translateX = useSharedValue(initialTransform.x);
  const translateY = useSharedValue(initialTransform.y);
  const zoom = useSharedValue(initialTransform.zoom);
  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinchStart = useSharedValue({
    fx: 0,
    fy: 0,
    x: 0,
    y: 0,
    zoom: 1,
  });
  const pinchActive = useSharedValue(false);
  /** Marcada quando o segundo dedo encosta e limpa no próximo toque de um dedo
   * só: um double-tap "ativado" por dois dedos de um pinch caindo rápido fica
   * bloqueado (RNGH não expõe timestamp pro worklet). */
  const multiTouchedSinceTap = useSharedValue(false);

  // Re-enquadra na abertura antes do paint a cada resize do grafo; `focusSeed`
  // nas deps é o gatilho INTENCIONAL da re-entrada na aba (inicial == aplicado).
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusSeed é o gatilho INTENCIONAL do re-enquadramento na re-entrada da aba (não é lido no corpo; o remount por foco piscava a tela)
  useLayoutEffect(() => {
    const next = bracketOpeningTransform({
      column: openingColumn,
      fitZoom,
      graphHeight: layout.height,
      graphWidth: layout.width,
      openingZoom,
      viewportHeight: viewport.height,
      viewportWidth: viewport.width,
    });

    zoom.value = next.zoom;
    translateX.value = next.x;
    translateY.value = next.y;
  }, [
    fitZoom,
    focusSeed,
    layout.height,
    layout.width,
    // A caixa da coluna entra por VALOR: o layout é recriado a cada medida de
    // card e a identidade do objeto dispararia re-enquadramento à toa (o pan do
    // usuário sendo resetado enquanto a chave se mede).
    openingColumn?.bottom,
    openingColumn?.top,
    openingColumn?.x,
    openingZoom,
    translateX,
    translateY,
    viewport,
    zoom,
  ]);

  // Roda da thread do RN: worklet não captura o import cross-module de
  // `withTiming` (ReferenceError na UI thread = canvas congelado).
  const animateTo = useCallback(
    (target: number, x: number, y: number) => {
      zoom.value = withTiming(target, ZOOM_TIMING);
      translateX.value = withTiming(x, ZOOM_TIMING);
      translateY.value = withTiming(y, ZOOM_TIMING);
    },
    [translateX, translateY, zoom]
  );

  const gesture = useMemo(() => {
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
      // Com o pinch ativo ele já é dono do translate (o focal-follow carrega o
      // pan de dois dedos): um pan somando translation em cima dá double-apply.
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
      // Um stream pode entregar todo o trajeto no único evento que ativa o
      // gesto; assentar o translate final aqui é no-op pro dedo.
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

    // Ativação manual: o pinch nasce no segundo dedo e morre quando um levanta,
    // então nunca disputa o mesmo toque com o pan.
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
        // Escritor único: uma animação de double-tap em voo brigaria com o
        // pinch quadro a quadro; os seeds leem o que ela deixou.
        cancelAnimation(zoom);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        pinchActive.value = true;
        // Seeds lidos dos dedos REAIS na ativação (baseline + focal): sem salto
        // quando o segundo dedo encosta.
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
        // Focal-follow (receita do zoom-toolkit, testada em bracket-tree): seeds
        // da ativação, o focal acompanha os dedos todo quadro — o ponto sob eles
        // não anda na tela, e um arrasto de dois dedos pan porque o focal anda.
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
      // Mesmo settle do pan: stream que entrega a escala inteira num evento.
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
      // Tap endurecido: os toques têm que ser parados (dedos de pinch caem
      // longe, então os "dois toques" falham no delta) e rápidos.
      .maxDeltaX(10)
      .maxDeltaY(10)
      .maxDuration(250)
      .onTouchesDown((event) => {
        "worklet";
        // Toque limpo de um dedo reinicia a sequência: o segundo dedo do pinch
        // cai antes de qualquer dedo levantar, então a flag já está armada.
        if (event.numberOfTouches === 1) {
          multiTouchedSinceTap.value = false;
        }
      })
      .onEnd((event) => {
        "worklet";
        // Pinch vivo é dono do transform, e multi-toque recente significa dedos
        // caindo, não toques.
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
        // `withTiming` é import de módulo JS e worklet não o captura: o alvo vai
        // pra thread do RN via `scheduleOnRN`.
        scheduleOnRN(animateTo, target, clamped.x, clamped.y);
      });

    // Tap e pan já são exclusivos por threshold (tap maxDist vs
    // PAN_ACTIVATION_DISTANCE), e o double-tap NÃO pode ficar acima do pan num
    // Exclusive: o Exclusive veta o pan desde o começo do tracking do tap.
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

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={{ flex: 1, overflow: "hidden" }}>
        {/* Dono único do transform (tela = translate + zoom * grafo, origem no
                topo-esquerdo). Cards depois dos conectores: barras sob a borda. */}
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
  );
}

/** Mede o viewport e monta o conteúdo JÁ enquadrado: o filho só monta com o
 * zoom de abertura pronto, então o primeiro frame nativo nasce nele, sem passar
 * por identidade. */
export function BracketCanvas({
  cardWidth,
  connectorWidth,
  focusSeed,
  layout,
  renderCard,
}: BracketCanvasProps) {
  const [viewport, setViewport] = useState({ height: 0, width: 0 });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setViewport((current) =>
      current.height === height && current.width === width
        ? current
        : { height, width }
    );
  }, []);

  // Piso do gesto: a chave INTEIRA (a pinça afasta até aqui).
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

  // Abertura: UMA coluna enquadrada, nunca abaixo do fit.
  const openingZoom = useMemo(
    () =>
      fitZoom === null
        ? null
        : bracketOpeningZoom({
            cardWidth,
            connectorWidth,
            fitZoom,
            viewportWidth: viewport.width,
          }),
    [cardWidth, connectorWidth, fitZoom, viewport.width]
  );

  // A coluna da abertura é a rodada ainda aberta da ÁRVORE ATIVA (a categoria
  // remonta o canvas por key, então o enquadramento é dela mesma).
  const openingColumn = useMemo(() => bracketOpeningColumn(layout), [layout]);

  return (
    <View collapsable={false} onLayout={handleLayout} style={{ flex: 1 }}>
      {openingZoom === null || fitZoom === null ? null : (
        <FramedBracketContent
          fitZoom={fitZoom}
          focusSeed={focusSeed}
          layout={layout}
          openingColumn={openingColumn}
          openingZoom={openingZoom}
          renderCard={renderCard}
          viewport={viewport}
        />
      )}
    </View>
  );
}
