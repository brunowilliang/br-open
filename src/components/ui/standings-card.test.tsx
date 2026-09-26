import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";

// O repo não tem harness de render: o card é CHAMADO como função e a árvore
// devolvida é inspecionada, com os módulos de boundary mockados antes do import
// — mesmo molde de `match-card.test.tsx` (um import estático seria içado antes
// dos `mock.module` e pegaria o módulo real).

mock.module("react-native", () => ({ View: () => null }));
mock.module("heroui-native", () => ({ Card: (props: unknown) => props }));
mock.module("@/components/core/image", () => ({
  Image: (props: unknown) => props,
}));
mock.module("@/components/core/text", () => ({
  Text: (props: unknown) => props,
}));

const { StandingsCard } = await import("@/components/ui/standings-card");
const { Text } = await import("@/components/core/text");
const { View } = await import("react-native");

/** `StandingsCard` é `memo(...)`: a função pura da árvore é o `.type` do memo. */
const StandingsCardImpl = (
  StandingsCard as unknown as {
    type: (props: Record<string, unknown>) => unknown;
  }
).type;

type Node = { props?: Record<string, unknown>; type?: unknown };

function walk(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, out);
    }

    return out;
  }

  if (node === null || typeof node !== "object") {
    return out;
  }

  const element = node as { props?: { children?: unknown } };

  if (element.props === undefined) {
    return out;
  }

  out.push(node as Node);
  walk(element.props.children, out);

  return out;
}

const ITEM = {
  avatarUrl: null,
  id: "marina-costa",
  name: "Marina Costa",
  nickname: "marina.costa",
  position: 1,
};

function renderNodes(overrides: Record<string, unknown> = {}) {
  return walk(StandingsCardImpl({ item: ITEM, ...overrides }));
}

/** Todo texto desenhado, na ordem da árvore (item e slots). */
function renderLabels(overrides: Record<string, unknown> = {}) {
  return renderNodes(overrides)
    .filter((node) => node.type === Text)
    .map((node) => node.props?.children);
}

/** Casas da forma: o único `View` que nasce com o tamanho da bolinha. */
function renderFormSlots(overrides: Record<string, unknown> = {}) {
  return renderNodes(overrides)
    .filter((node) => node.type === View)
    .map((node) => node.props?.className)
    .filter(
      (className): className is string =>
        typeof className === "string" && className.startsWith("size-2.5")
    );
}

/** A mistura da amostra: ganha, ganha, perdida, perdida, ganha. */
const FORM = [
  { outcome: "win" },
  { outcome: "win" },
  { outcome: "loss" },
  { outcome: "loss" },
  { outcome: "win" },
];

describe("StandingsCard", () => {
  it("desenha posição, nome e nickname do item", () => {
    expect(renderLabels()).toEqual([1, "Marina Costa", "marina.costa"]);
  });

  it("desenha a alça antes do item e a ação da ponta depois", () => {
    expect(
      renderLabels({
        dragHandle: createElement(Text, null, "alça"),
        suffix: createElement(Text, null, "Desafiar"),
      })
    ).toEqual(["alça", 1, "Marina Costa", "marina.costa", "Desafiar"]);
  });

  it("desenha as cinco casas neutras sem dado de forma", () => {
    const slots = renderFormSlots();

    expect(slots).toHaveLength(5);
    expect(slots.every((className) => className.includes("bg-border"))).toBe(
      true
    );
  });

  it("pinta cada casa pelo resultado", () => {
    const slots = renderFormSlots({ form: FORM });

    expect(slots).toHaveLength(5);
    expect(
      slots.filter((className) => className.includes("bg-success"))
    ).toHaveLength(3);
    expect(
      slots.filter((className) => className.includes("bg-danger"))
    ).toHaveLength(2);
  });

  it("não desenha casa nenhuma com a forma vazia", () => {
    expect(renderFormSlots({ form: [] })).toEqual([]);
  });
});
