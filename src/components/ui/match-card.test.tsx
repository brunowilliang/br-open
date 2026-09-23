import { describe, expect, it, mock } from "bun:test";

// O repo não tem harness de render (nem `react-test-renderer`) e `react-native`
// não parseia sob bun (Flow): o card é CHAMADO como função e a árvore devolvida
// é inspecionada, com os módulos de boundary mockados antes do import — mesmo
// molde de `pending-alerts.test.tsx`. O `await import` abaixo é obrigatório: um
// import estático seria içado antes dos `mock.module` e pegaria o módulo real.

mock.module("react-native", () => ({ View: () => null }));
mock.module("heroui-native", () => {
  const passthrough = (props: unknown) => props;

  return {
    Button: Object.assign(passthrough, { Label: passthrough }),
    Card: passthrough,
    Chip: Object.assign(passthrough, { Label: passthrough }),
    Menu: Object.assign(passthrough, {
      Content: passthrough,
      Item: passthrough,
      ItemTitle: passthrough,
      Overlay: passthrough,
      Portal: passthrough,
      Trigger: passthrough,
    }),
    PressableFeedback: passthrough,
    Separator: passthrough,
  };
});
mock.module("@/components/core/image", () => ({
  Image: (props: unknown) => props,
}));
mock.module("@/components/core/text", () => ({
  Text: (props: unknown) => props,
}));
mock.module("./huge-icons", () => ({ HugeIcons: () => null }));
mock.module("@hugeicons/core-free-icons", () => ({
  Calendar03Icon: "calendar",
  Edit02Icon: "edit",
  ExchangeIcon: "exchange",
  MoreVerticalIcon: "more",
}));

const { MatchCard } = await import("@/components/ui/match-card");
const { Chip } = await import("heroui-native");
const { Text } = await import("@/components/core/text");

/** `MatchCard` é `memo(...)`: a função pura da árvore é o `.type` do memo. */
const MatchCardImpl = (
  MatchCard as unknown as {
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

function renderCard(props: Record<string, unknown>) {
  const nodes = walk(MatchCardImpl(props));

  return {
    /** Rótulo de cada chip desenhado (fase, status e pé), na ordem da árvore. O
     * `slice(1)` pula o próprio `Chip`: o filho é que carrega o texto. */
    chipLabels: nodes
      .filter((node) => node.type === Chip)
      .map((node) =>
        walk(node)
          .slice(1)
          .find((child) => typeof child.props?.children === "string")
      )
      .map((node) => node?.props?.children),
    /** Linhas de nome do lado, na ordem em que o card desenha. */
    lines: nodes
      .filter((node) => node.type === Text)
      .filter((node) => typeof node.props?.children === "string")
      .map((node) => ({
        color: node.props?.color,
        name: node.props?.children,
        weight: node.props?.weight,
      })),
    /** Números do placar (nenhum existe no W.O.). */
    numbers: nodes
      .filter((node) => node.type === Text)
      .filter((node) => typeof node.props?.children === "number")
      .map((node) => node.props?.children),
  };
}

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    matchDate: "2026-09-12",
    modality: "doubles",
    startMinute: 840,
    ...overrides,
  };
}

const WALKOVER_SET = [{ aGames: 0, bGames: 0, kind: "set" }];
const PLAYED_SETS = [
  { aGames: 6, bGames: 4, kind: "set" },
  { aGames: 3, bGames: 6, kind: "set" },
  { aGames: 7, bGames: 6, kind: "set", tieBreak: { aPoints: 7, bPoints: 5 } },
];

describe("MatchCard no W.O. jogado", () => {
  it("pinta o vencedor, apaga o placar e avisa W.O. no chip", () => {
    const { chipLabels, lines, numbers } = renderCard(
      buildProps({
        matchStatus: "finished",
        scoreSets: WALKOVER_SET,
        walkoverWinner: "b",
      })
    );

    expect(lines).toEqual([
      { color: "muted", name: "Bruno William Garcia", weight: "normal" },
      { color: "muted", name: "Rafael de Souza Lima", weight: "normal" },
      { color: "accent", name: "Jose Almeida Prado", weight: "semibold" },
      { color: "accent", name: "Diego Nakamura Alves", weight: "semibold" },
    ]);
    expect(numbers).toEqual([]);
    expect(chipLabels).toContain("W.O.");
    expect(chipLabels).not.toContain("Encerrado");
  });

  it("espelha a pintura quando o lado A é quem vence por W.O.", () => {
    const { lines, numbers } = renderCard(
      buildProps({
        matchStatus: "finished",
        scoreSets: WALKOVER_SET,
        walkoverWinner: "a",
      })
    );

    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      ["accent", "semibold"],
      ["accent", "semibold"],
      ["muted", "normal"],
      ["muted", "normal"],
    ]);
    expect(numbers).toEqual([]);
  });

  it("na FINAL o chip de campeão vence o do W.O., e o placar segue fora", () => {
    const { chipLabels, lines, numbers } = renderCard(
      buildProps({
        matchStatus: "champion",
        scoreSets: WALKOVER_SET,
        walkoverWinner: "b",
      })
    );

    expect(chipLabels).toContain("Campeão");
    expect(chipLabels).not.toContain("W.O.");
    expect(numbers).toEqual([]);
    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      ["muted", "normal"],
      ["muted", "normal"],
      ["accent", "semibold"],
      ["accent", "semibold"],
    ]);
  });
});

describe("MatchCard no W.O. sem vencedor no wire", () => {
  it("só o chip do status fica: sem pintura e sem o 0x0 do placeholder", () => {
    const { chipLabels, lines, numbers } = renderCard(
      buildProps({ matchStatus: "walkover", scoreSets: WALKOVER_SET })
    );

    expect(chipLabels).toContain("W.O.");
    expect(numbers).toEqual([]);
    expect(
      lines.every(
        (line) => line.color === undefined && line.weight === "normal"
      )
    ).toBeTrue();
  });
});

describe("MatchCard na partida jogada", () => {
  it("segue pela maioria dos sets, com o placar e o chip de encerrado", () => {
    const { chipLabels, lines, numbers } = renderCard(
      buildProps({ matchStatus: "finished", scoreSets: PLAYED_SETS })
    );

    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      ["accent", "semibold"],
      ["accent", "semibold"],
      ["muted", "normal"],
      ["muted", "normal"],
    ]);
    // Lado A (6, 3, 7 + o tie-break 7) e depois o lado B (4, 6, 6 + o 5).
    expect(numbers).toEqual([6, 3, 7, 7, 4, 6, 6, 5]);
    expect(chipLabels).toContain("Encerrado");
  });

  it("o placar 0x0 sem W.O. explícito não pinta lado nenhum", () => {
    const { lines, numbers } = renderCard(
      buildProps({ matchStatus: "finished", scoreSets: WALKOVER_SET })
    );

    expect(lines.every((line) => line.color === undefined)).toBeTrue();
    expect(lines.every((line) => line.weight === "normal")).toBeTrue();
    expect(numbers).toEqual([0, 0]);
  });
});
