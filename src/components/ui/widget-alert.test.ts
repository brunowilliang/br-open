import { describe, expect, it, mock } from "bun:test";

// O repo não tem harness de render (nem `react-test-renderer`) e `react-native`
// não parseia sob bun (Flow): só a fórmula da largura é exercitada, com os
// módulos de boundary mockados antes do import — mesmo molde de
// `match-card.test.tsx`. O `await import` abaixo é obrigatório: um import
// estático seria içado antes dos `mock.module` e pegaria o módulo real.

mock.module("react-native", () => ({ View: () => null }));
mock.module("react-native-reanimated", () => ({
  default: { View: () => null },
  Extrapolation: { CLAMP: "clamp" },
  interpolate: () => 0,
  useAnimatedStyle: () => ({}),
}));
mock.module("react-native-gesture-handler/ReanimatedSwipeable", () => ({
  default: () => null,
}));
mock.module("heroui-native", () => ({
  Alert: () => null,
  Button: () => null,
  Card: () => null,
  PressableFeedback: () => null,
}));
mock.module("uniwind", () => ({
  withUniwind: (component: unknown) => component,
}));
mock.module("@/components/core/text", () => ({ Text: () => null }));
mock.module("./huge-icons", () => ({ HugeIcons: () => null }));
mock.module("@hugeicons/core-free-icons", () => ({ EyeOffIcon: "eye-off" }));

const { getSwipeActionWidth } = await import("@/components/ui/widget-alert");

// `rightWidth` = `-translation / progress`, com rightWidth = a largura base:
// até o ponto de abrir o dedo só revela a caixa; depois dela a caixa acompanha.
describe("getSwipeActionWidth", () => {
  it("keeps the base width in rest and up to the open point", () => {
    expect(getSwipeActionWidth(0, 0)).toBe(120);
    expect(getSwipeActionWidth(0.5, -60)).toBe(120);
    expect(getSwipeActionWidth(1, -120)).toBe(120);
  });

  it("grows 1:1 with the finger past the open point", () => {
    expect(getSwipeActionWidth(1.5, -180)).toBe(180);
    expect(getSwipeActionWidth(2, -240)).toBe(240);
  });
});
