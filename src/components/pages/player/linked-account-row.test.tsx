import { describe, expect, it, mock } from "bun:test";

// Mesmo molde do match-card.test.tsx: o repo não tem harness de render e
// `react-native` não parseia sob bun (Flow), então o componente é CHAMADO como
// função e a árvore devolvida é inspecionada, com os módulos de boundary
// mockados antes do import. O `await import` abaixo é obrigatório: um import
// estático seria içado antes dos `mock.module` e pegaria o módulo real.

mock.module("react-native", () => ({ View: () => null }));
// Cada sub-componente é uma FUNÇÃO DISTINTA: `node.type === Chip` só casa com o
// próprio Chip quando as referências não se confundem.
mock.module("heroui-native", () => ({
  Button: Object.assign((props: unknown) => props, {
    Label: (props: unknown) => props,
  }),
  Chip: Object.assign((props: unknown) => props, {
    Label: (props: unknown) => props,
  }),
  ListGroup: Object.assign((props: unknown) => props, {
    Item: (props: unknown) => props,
    ItemContent: (props: unknown) => props,
    ItemPrefix: (props: unknown) => props,
    ItemSuffix: (props: unknown) => props,
    ItemTitle: (props: unknown) => props,
  }),
}));
mock.module("@/components/ui/huge-icons", () => ({ HugeIcons: () => null }));

const { LinkedAccountRow } = await import(
  "@/components/pages/player/linked-account-row"
);
const { Button, Chip, ListGroup } = await import("heroui-native");

/** `LinkedAccountRow` é `memo(...)`: a função pura da árvore é o `.type`. */
const LinkedAccountRowImpl = (
  LinkedAccountRow as unknown as {
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

/** Textos desenhados dentro de um nó, na ordem da árvore. */
function textsOf(nodes: Node[]) {
  return nodes
    .filter((node) => typeof node.props?.children === "string")
    .map((node) => node.props?.children);
}

/** Texto do rótulo do sub-componente: o filho string, não o próprio wrapper. */
function labelOf(node: Node | undefined) {
  const [label] = textsOf(walk(node).slice(1));

  return label;
}

function rowNodes(overrides: Record<string, unknown> = {}) {
  return walk(
    LinkedAccountRowImpl({
      icon: "apple",
      status: "connected",
      title: "Apple",
      ...overrides,
    })
  );
}

function renderRow(overrides: Record<string, unknown> = {}) {
  const nodes = rowNodes(overrides);
  const [action] = nodes.filter((node) => node.type === Button);
  const item = nodes.find((node) => node.type === ListGroup.Item);

  return {
    actionLabel: labelOf(action),
    chipLabel: labelOf(nodes.find((node) => node.type === Chip)),
    isActionDisabled: action?.props?.isDisabled === true,
    isItemDisabled: item?.props?.disabled === true,
    itemClassName: item?.props?.className,
  };
}

describe("LinkedAccountRow por status", () => {
  it("conectada: chip Conectado e ação Desconectar", () => {
    expect(renderRow()).toMatchObject({
      actionLabel: "Desconectar",
      chipLabel: "Conectado",
      isActionDisabled: false,
      isItemDisabled: false,
    });
  });

  it("não conectada: chip Não conectado e ação Conectar", () => {
    expect(renderRow({ status: "disconnected" })).toMatchObject({
      actionLabel: "Conectar",
      chipLabel: "Não conectado",
      isActionDisabled: false,
      isItemDisabled: false,
    });
  });
});

describe("LinkedAccountRow com ação em voo", () => {
  it("conectando: o chip segue não conectado e o progresso é do botão", () => {
    expect(
      renderRow({ pendingAction: "link", status: "disconnected" })
    ).toMatchObject({
      actionLabel: "Conectando...",
      chipLabel: "Não conectado",
      isActionDisabled: true,
      isItemDisabled: false,
    });
  });

  it("desconectando: o chip segue conectado e o progresso é do botão", () => {
    expect(renderRow({ pendingAction: "unlink" })).toMatchObject({
      actionLabel: "Desconectando...",
      chipLabel: "Conectado",
      isActionDisabled: true,
      isItemDisabled: false,
    });
  });

  it("outra linha em andamento trava a ação sem mexer no chip", () => {
    expect(renderRow({ isActionDisabled: true })).toMatchObject({
      actionLabel: "Desconectar",
      chipLabel: "Conectado",
      isActionDisabled: true,
      isItemDisabled: false,
    });
  });
});

describe("LinkedAccountRow na posição aprovada", () => {
  it("chip em cima do título", () => {
    expect(textsOf(rowNodes())).toEqual(["Conectado", "Apple", "Desconectar"]);
  });
});

describe("LinkedAccountRow informativa", () => {
  it("sem ação e sem esmaecer quando há conta", () => {
    expect(renderRow({ isInformational: true })).toMatchObject({
      actionLabel: undefined,
      chipLabel: "Conectado",
      isActionDisabled: false,
      isItemDisabled: true,
      itemClassName: undefined,
    });
  });

  it("esmaece e mostra Não conectado quando não há conta", () => {
    expect(
      renderRow({ isInformational: true, status: "disconnected" })
    ).toMatchObject({
      actionLabel: undefined,
      chipLabel: "Não conectado",
      isActionDisabled: false,
      isItemDisabled: true,
      itemClassName: "opacity-50",
    });
  });
});
