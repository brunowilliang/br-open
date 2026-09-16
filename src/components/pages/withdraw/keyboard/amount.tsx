import { cn } from "better-styled";
import { View } from "react-native";
import Animated, { Keyframe, LinearTransition } from "react-native-reanimated";

import { Text } from "@/components/core/text";
import type { Digit } from "./use-amount-input-controller";

// Casas de REAL: entram com fade + scale in; saem com fade + scale out.
const DigitEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.7 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(200);

const DigitExit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.7 }] },
}).duration(150);

// Centavos: só fade (sem scale) — trocam de valor a cada toque.
const FadeIn = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1 },
}).duration(150);

const FadeOut = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0 },
}).duration(120);

// Erro: fade in/out (não aparece/desaparece "seco").
const ErrorIn = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1 },
}).duration(180);

const ErrorOut = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0 },
}).duration(120);

const motion = LinearTransition.duration(200);

type AmountProps = {
  integer: Digit[];
  decimal: Digit[];
  isEmpty?: boolean;
  error?: boolean;
  errorMessage?: string | null;
};

export function Amount({
  integer,
  decimal,
  isEmpty = false,
  error = false,
  errorMessage = null,
}: AmountProps) {
  // No placeholder, só o ÚLTIMO dígito (último centavo) fica ativo
  // (foreground) — é onde o próximo dígito entra (centavos acumulado).
  // R$, integer, vírgula e os demais centavos ficam muted via COR (não
  // opacity — opacity conflitaria com a animação `entering`).

  return (
    <View className="items-center gap-1">
      {/*
        Todos os caracteres são irmãos diretos num único flex-row (sem
        wrappers) e SEM overflow-hidden: assim a vírgula (key fixa "comma")
        desliza de verdade quando os reais crescem, e nada é cortado.
      */}
      <Animated.View className="flex-row items-baseline" layout={motion}>
        <Text
          className={cn(
            "mr-2 font-semibold text-3xl",
            error ? "text-danger" : isEmpty ? "text-muted" : "text-foreground"
          )}
          key="symbol"
        >
          {"R$"}
        </Text>

        {integer.map((digit) => (
          <Animated.Text
            className={cn(
              "font-semibold text-5xl",
              error ? "text-danger" : isEmpty ? "text-muted" : "text-foreground"
            )}
            entering={DigitEnter}
            exiting={DigitExit}
            key={`${digit.id}-${digit.value}`}
            layout={motion}
          >
            {digit.value}
          </Animated.Text>
        ))}

        {/* Vírgula decimal: identidade fixa → desliza ao reposicionar */}
        <Animated.Text
          className={cn(
            "font-semibold text-5xl",
            error ? "text-danger" : isEmpty ? "text-muted" : "text-foreground"
          )}
          key="comma"
          layout={motion}
        >
          {","}
        </Animated.Text>

        {decimal.map((digit, index) => {
          const isLast = index === decimal.length - 1;
          return (
            <Animated.Text
              className={cn(
                "font-semibold text-5xl",
                error
                  ? "text-danger"
                  : isEmpty && !isLast
                    ? "text-muted"
                    : "text-foreground"
              )}
              entering={FadeIn}
              exiting={FadeOut}
              key={`${digit.id}-${digit.value}`}
              layout={motion}
            >
              {digit.value}
            </Animated.Text>
          );
        })}
      </Animated.View>

      {error && errorMessage ? (
        <Animated.Text
          className="text-center text-danger text-sm"
          entering={ErrorIn}
          exiting={ErrorOut}
          key="error"
        >
          {errorMessage}
        </Animated.Text>
      ) : null}
    </View>
  );
}
