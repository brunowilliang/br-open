import { Alert, Button, Card, PressableFeedback } from "heroui-native";
import { useRef } from "react";
import { type GestureResponderEvent, View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { Text } from "@/components/core/text";
import { EyeOffIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "./huge-icons";

/** Só as props `{nome}ClassName` chegam ao `Swipeable` (ele sobrescreve `style`). */
const StyledSwipeable = withUniwind(Swipeable);

/** Entrada da ação revelada (px): só pintura, não entra na medida do `rightWidth`. */
const SWIPE_ACTION_ENTER_PX = 16;

const ACTION_WIDTH_PX = 120; // w-30

type WidgetAlertAction = {
  isDisabled?: boolean;
  label: string;
  /** Quem aninha o alerta num touchable usa para parar a propagação. */
  onPress: (event: GestureResponderEvent) => void;
};

/** Ação revelada ("Esconder") com handler de verdade; sem ela a ação é só pintura. */
type WidgetAlertDismissAction = {
  isDisabled?: boolean;
  onPress: () => void;
};

export type WidgetAlertDescriptionPart = {
  isHighlighted?: boolean;
  text: string;
};

export type WidgetAlertDescriptionLine = {
  parts: WidgetAlertDescriptionPart[];
};

/** Sangramento do gesto por classe: par espelhado do gutter do pai + inset da ação. */
export type WidgetAlertSwipeClassNames = {
  /** → ação revelada (ex.: `pr-4`): padding/width entram na medida do `rightWidth`. */
  action: string;
  /** → `childrenContainerClassName`: o nó do conteúdo, que carrega o deslize. */
  childrenContainer: string;
  /** → `containerClassName`: a caixa do gesto (é ela que clipa). */
  container: string;
};

type WidgetAlertProps = {
  action?: WidgetAlertAction;
  /** Faixa livre para um gatilho absoluto no canto do cartão (`pr-*`). */
  contentClassName?: string;
  /** Frase simples OU linhas com trechos destacados. */
  description?: WidgetAlertDescriptionLine[] | string;
  /** Corte do `numberOfLines`; no caminho de LINHAS vale por LINHA. */
  descriptionNumberOfLines?: number;
  /** Esconde o item desta superfície: liga o TOQUE da ação revelada.
   * Ausente = ação revelada só de pintura. */
  dismissAction?: WidgetAlertDismissAction;
  /**
   * Omite o `Alert.Indicator` (é parte composta — não há prop que o esconda);
   * o layout se mantém porque `flex: 1` é do `alert__content`.
   */
  isIndicatorHidden?: boolean;
  /**
   * Liga o swipe inteiro (gesto, ação revelada, sangramento por classe e toque
   * do card que abre/fecha). Ausente = cartão puro, sem `Swipeable`, sem
   * Pressable e com `swipeClassNames` ignorado.
   */
  isSwipeEnabled?: boolean;
  secondaryAction?: WidgetAlertAction;
  status?: "accent" | "danger" | "default" | "success" | "warning";
  /** Sangramento do gesto por classe: par espelhado do gutter do pai + inset da ação.
   * Ausente = caixa do cartão, sem classe nenhuma (comportamento de sempre). */
  swipeClassNames?: WidgetAlertSwipeClassNames;
  title: string;
  /** Corte do título em N linhas (`numberOfLines` do texto). */
  titleNumberOfLines?: number;
};

/** Ação do alerta: `Button size="sm"`, `variant="danger"` quando o status é danger
 * (padrão do HeroUI Native; o componente não tem slot de ação). */
function WidgetAlertButton(props: {
  action: WidgetAlertAction;
  variant: "danger" | "primary" | "secondary";
}) {
  // Não deixa o toque vazar para o swipe de quem aninha o alerta.
  function handlePress(event: GestureResponderEvent) {
    event.stopPropagation();
    props.action.onPress(event);
  }

  return (
    <Button
      isDisabled={props.action.isDisabled}
      onPress={handlePress}
      size="sm"
      variant={props.variant}
    >
      <Button.Label>{props.action.label}</Button.Label>
    </Button>
  );
}

function WidgetAlertSwipeAction({
  actionClassName,
  dismissAction,
  progress,
  translation,
}: {
  actionClassName?: string;
  dismissAction?: WidgetAlertDismissAction;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;

    return {
      opacity: value,
      transform: [
        {
          translateX: interpolate(
            value,
            [0, 1],
            [SWIPE_ACTION_ENTER_PX, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(value, [0, 1], [0.7, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  // Passado o ponto de abrir, a caixa cresce 1:1 com o dedo (`rightWidth` = `-translation / progress`).
  const widthStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const overflow = value > 1 ? -translation.value * ((value - 1) / value) : 0;

    return { width: ACTION_WIDTH_PX + overflow };
  });

  return (
    <Animated.View className={actionClassName} style={animatedStyle}>
      <Animated.View className="h-full" style={widthStyle}>
        <PressableFeedback
          className="h-full w-full"
          isDisabled={dismissAction?.isDisabled}
          onPress={dismissAction?.onPress}
        >
          <Card className="centered h-full w-full gap-1">
            <HugeIcons className="size-4" icon={EyeOffIcon} />
            <Text size="sm" weight="semibold">
              Esconder
            </Text>
            <PressableFeedback.Highlight />
          </Card>
        </PressableFeedback>
      </Animated.View>
    </Animated.View>
  );
}

export function WidgetAlert(props: WidgetAlertProps) {
  const primaryVariant = props.status === "danger" ? "danger" : "primary";
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  /** Só "garanta ABERTO": fechar é do tap interno do `Swipeable`. */
  function openSwipe() {
    swipeableRef.current?.openRight();
  }

  const card = (
    <Alert status={props.status}>
      {props.isIndicatorHidden ? null : <Alert.Indicator />}
      <Alert.Content className={props.contentClassName}>
        <Alert.Title numberOfLines={props.titleNumberOfLines}>
          {props.title}
        </Alert.Title>
        {typeof props.description === "string" ? (
          <Alert.Description numberOfLines={props.descriptionNumberOfLines}>
            {props.description}
          </Alert.Description>
        ) : null}
        {Array.isArray(props.description) ? (
          <View className="gap-0.5">
            {props.description.map((line, lineIndex) => (
              <Text
                color="muted"
                key={lineIndex}
                numberOfLines={props.descriptionNumberOfLines}
                variant="description"
              >
                {line.parts.map((part, partIndex) =>
                  part.isHighlighted ? (
                    <Text
                      color="muted"
                      key={partIndex}
                      variant="description"
                      weight="bold"
                    >
                      {part.text}
                    </Text>
                  ) : (
                    part.text
                  )
                )}
              </Text>
            ))}
          </View>
        ) : null}
        {props.secondaryAction ? (
          <View className="mt-1.5 flex-row items-center gap-2 self-end">
            <WidgetAlertButton
              action={props.secondaryAction}
              variant="secondary"
            />
            {props.action ? (
              <WidgetAlertButton
                action={props.action}
                variant={primaryVariant}
              />
            ) : null}
          </View>
        ) : null}
      </Alert.Content>
      {props.action && !props.secondaryAction ? (
        <WidgetAlertButton action={props.action} variant={primaryVariant} />
      ) : null}
    </Alert>
  );

  // Sem o opt-in, cartão puro: nenhuma caixa de gesto, nenhum Pressable e
  // nenhuma classe de sangramento (o resto do app não desliza).
  if (!props.isSwipeEnabled) {
    return card;
  }

  return (
    <StyledSwipeable
      childrenContainerClassName={props.swipeClassNames?.childrenContainer}
      containerClassName={props.swipeClassNames?.container}
      enableTrackpadTwoFingerGesture
      ref={swipeableRef}
      renderRightActions={(progress, translation) => (
        <WidgetAlertSwipeAction
          actionClassName={props.swipeClassNames?.action}
          dismissAction={props.dismissAction}
          progress={progress}
          translation={translation}
        />
      )}
    >
      <PressableFeedback onPress={openSwipe}>{card}</PressableFeedback>
    </StyledSwipeable>
  );
}
