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
mock.module("react-native-reanimated", () => ({
  default: { View: (props: unknown) => props },
  useAnimatedStyle: () => ({}),
  useSharedValue: () => ({ value: 0 }),
  withTiming: (value: number) => value,
}));
mock.module("@/components/core/text", () => ({
  Text: (props: unknown) => props,
}));
mock.module("./huge-icons", () => ({ HugeIcons: () => null }));
mock.module("@hugeicons/core-free-icons", () => ({
  Calendar03Icon: "calendar",
  Cancel01Icon: "cancel",
  Edit02Icon: "edit",
  ExchangeIcon: "exchange",
  MoreVerticalIcon: "more",
  Tick02Icon: "tick",
}));

const { MatchCard, MatchSelectionRing } = await import(
  "@/components/ui/match-card"
);
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
    /** Números do placar com o destaque de cada um (set vencido x perdido). */
    scoreTokens: nodes
      .filter((node) => node.type === Text)
      .filter((node) => typeof node.props?.children === "number")
      .map((node) => ({
        color: node.props?.color,
        value: node.props?.children,
        weight: node.props?.weight,
      })),
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

/** O item do menu cujo `onPress` é ESTE handler, com o rótulo que ele desenha: as
 * peças do Menu são a MESMA função no mock, então quem distingue o item é a
 * identidade do handler, não o tipo. */
function menuEntry(nodes: Node[], handler: () => void) {
  const index = nodes.findIndex((node) => node.props?.onPress === handler);
  const node = nodes[index];

  return {
    index,
    label: walk(node).find((child) => typeof child.props?.children === "string")
      ?.props?.children as string | undefined,
    press: () => {
      if (typeof node?.props?.onPress === "function") {
        node.props.onPress();
      }
    },
  };
}

const noop = () => undefined;

describe("MatchCard no menu do papel", () => {
  it("desenha os itens na ordem que chegam e chama o handler de cada um", () => {
    const onConcludePress = mock(() => undefined);
    const onCancelPress = mock(() => undefined);
    const nodes = walk(
      MatchCardImpl(
        buildProps({
          menu: [
            {
              icon: "tick",
              label: "Concluir torneio",
              onPress: onConcludePress,
            },
            {
              icon: "cancel",
              isDanger: true,
              label: "Cancelar jogo",
              onPress: onCancelPress,
            },
          ],
        })
      )
    );
    const conclusion = menuEntry(nodes, onConcludePress);
    const cancel = menuEntry(nodes, onCancelPress);

    expect(conclusion.label).toBe("Concluir torneio");
    expect(cancel.label).toBe("Cancelar jogo");
    // A ordem da árvore é a ordem do menu: quem monta o menu manda (o builder
    // por papel), o card não reordena nada.
    expect(conclusion.index).toBeLessThan(cancel.index);

    conclusion.press();
    cancel.press();

    expect(onConcludePress).toHaveBeenCalledTimes(1);
    expect(onCancelPress).toHaveBeenCalledTimes(1);
  });

  it("sem item nenhum o ⋮ não é desenhado", () => {
    const nodes = walk(MatchCardImpl(buildProps()));

    expect(nodes.some((node) => node.props?.icon === "more")).toBeFalse();
  });

  it("o ⋮ aparece quando o menu do papel ou o acerto trazem item", () => {
    const withMenu = walk(
      MatchCardImpl(
        buildProps({
          menu: [{ icon: "edit", label: "Resultado", onPress: noop }],
        })
      )
    );
    const withAgreement = walk(
      MatchCardImpl(
        buildProps({
          agreement: {
            chip: null,
            menuItems: [
              { icon: "edit", label: "Propor horário", onPress: noop },
            ],
            scheduleProposal: null,
            scoreProposal: null,
          },
        })
      )
    );

    expect(withMenu.some((node) => node.props?.icon === "more")).toBeTrue();
    expect(
      withAgreement.some((node) => node.props?.icon === "more")
    ).toBeTrue();
  });
});

describe("MatchCard no modo seleção da agenda", () => {
  it("liga o anel de seleção e os toques, sem borda no card", () => {
    const onCardLongPress = mock(() => undefined);
    const onCardPress = mock(() => undefined);
    const nodes = walk(
      MatchCardImpl(
        buildProps({ isSelected: true, onCardLongPress, onCardPress })
      )
    );
    const cardIndex = nodes.findIndex((node) =>
      String(node.props?.className ?? "").includes("gap-3 p-3")
    );
    const card = nodes[cardIndex];
    const ringIndex = nodes.findIndex(
      (node) => node.type === MatchSelectionRing
    );
    const ring = nodes[ringIndex];
    const pressable = nodes.find(
      (node) => node.props?.onLongPress === onCardLongPress
    );

    // A borda vive DENTRO do card (o pressable e o próprio card cortam o que
    // passa das bordas — por fora ela saía cortada) e o card não muda de classe.
    expect(ring?.props?.isSelected).toBeTrue();
    expect(ringIndex).toBeGreaterThan(cardIndex);
    expect(card?.props?.className).toBe("gap-3 p-3");
    expect(pressable?.props?.onPress).toBe(onCardPress);
  });

  it("sem long press não existe superfície de toque própria", () => {
    const nodes = walk(MatchCardImpl(buildProps()));
    const card = nodes.find((node) =>
      String(node.props?.className ?? "").includes("gap-3 p-3")
    );

    expect(
      nodes.some((node) => node.props?.onLongPress !== undefined)
    ).toBeFalse();
    expect(nodes.some((node) => node.type === MatchSelectionRing)).toBeFalse();
    expect(card?.props?.className).toBe("gap-3 p-3");
  });
});

describe("MatchCard no placar da mesa", () => {
  const proposedScore = (overrides: Record<string, unknown> = {}) => ({
    chip: null,
    menuItems: [],
    scheduleProposal: null,
    scoreProposal: { sets: PLAYED_SETS, walkoverWinner: null },
    ...overrides,
  });

  it("pinta o vencedor da proposta como o resultado publicado", () => {
    const { lines, scoreTokens } = renderCard(
      buildProps({ agreement: proposedScore() })
    );

    // 2 sets a 1 para o desafiante: ele fica accent + semibold.
    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      ["accent", "semibold"],
      ["accent", "semibold"],
      ["muted", "normal"],
      ["muted", "normal"],
    ]);
    // Set vencido sai accent + bold, perdido muted + normal, linha por linha,
    // com o mini-placar do tie-break no mesmo tom do lado.
    expect(scoreTokens.map((token) => [token.value, token.color])).toEqual([
      [6, "accent"],
      [3, "muted"],
      [7, "accent"],
      [7, "accent"],
      [4, "muted"],
      [6, "accent"],
      [6, "muted"],
      [5, "muted"],
    ]);
  });

  it("empate entre sets não pinta ninguém", () => {
    const { lines, scoreTokens } = renderCard(
      buildProps({
        agreement: proposedScore({
          scoreProposal: {
            sets: [
              { aGames: 6, bGames: 4, kind: "set" },
              { aGames: 3, bGames: 6, kind: "set" },
            ],
            walkoverWinner: null,
          },
        }),
      })
    );

    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      [undefined, "normal"],
      [undefined, "normal"],
      [undefined, "normal"],
      [undefined, "normal"],
    ]);
    expect(scoreTokens.map((token) => token.color)).toEqual([
      "accent",
      "muted",
      "muted",
      "accent",
    ]);
  });

  it("W.O. proposto: sem placar e com o vencedor pintado", () => {
    const { lines, numbers, chipLabels } = renderCard(
      buildProps({
        agreement: proposedScore({
          scoreProposal: { sets: [], walkoverWinner: "b" },
        }),
        matchStatus: "scheduled",
      })
    );

    expect(numbers).toEqual([]);
    expect(lines.map((line) => [line.color, line.weight])).toEqual([
      ["muted", "normal"],
      ["muted", "normal"],
      ["accent", "semibold"],
      ["accent", "semibold"],
    ]);
    // Proposta não é desfecho: o chip de status continua contando o jogo.
    expect(chipLabels).toContain("Agendado");
  });
});
