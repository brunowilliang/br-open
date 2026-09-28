import { describe, expect, it, mock } from "bun:test";

// O card do "Próximos jogos" da home SEM agendamento: a chave saiu, o confronto
// é dele, então a lista traz o jogo e o card tem que desenhar os lados, o chip
// "A definir" e a ação de propor horário, sem linha de data nenhuma. Sem harness
// de render (o repo não tem), o card é CHAMADO como função e a árvore
// inspecionada, com os módulos de boundary mockados antes do import — mesmo
// molde de `src/components/ui/match-card.test.tsx`.

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
mock.module("@/components/ui/huge-icons", () => ({ HugeIcons: () => null }));
mock.module("@hugeicons/core-free-icons", () => ({
  Calendar03Icon: "agenda",
  Cancel01Icon: "x",
  Edit02Icon: "resultado",
  ExchangeIcon: "exchange",
  MoreVerticalIcon: "more",
  Tick02Icon: "check",
}));

const { MatchCard } = await import("@/components/ui/match-card");
const { Chip } = await import("heroui-native");
const { Text } = await import("@/components/core/text");
const { buildUpcomingMatchItems } = await import(
  "@/lib/home/player-dashboard-view"
);
const {
  buildPlayerAgreementChip,
  buildPlayerAgreementMenu,
  buildPlayerAgreementScheduleProposal,
  buildPlayerAgreementScoreProposal,
} = await import("@/lib/tournaments/match-agreement-view");

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

const MatchCardImpl = (
  MatchCard as unknown as { type: (props: Record<string, unknown>) => unknown }
).type;

const VIEWER = {
  avatarUrl: null,
  fullName: "Bruno Garcia",
  nickname: "Bruninho",
};

/** Payload do dash no shape congelado: agendamento nulo quando não tem horário. */
function wire(matchDate: null | string, startMinute: null | number) {
  return {
    categoryDisplayName: "Simples Masculino",
    categoryId: "cat-1",
    competitionId: "t-1",
    competitionName: "Copa Guarujá",
    courtName: matchDate ? "Quadra 2" : null,
    endMinute: startMinute === null ? null : startMinute + 60,
    id: "match-1",
    matchDate,
    opponents: [
      {
        avatarUrl: null,
        fullName: "Diego Nakamura",
        nickname: "Dieguinho",
        playerProfileId: "p-x",
      },
    ],
    partner: null,
    round: 1,
    startMinute,
    totalRounds: 2,
  };
}

/** O card da home como ele é montado na tela: item do dash + acerto do viewer. */
function renderHomeCard(matchDate: null | string, startMinute: null | number) {
  const [item] = buildUpcomingMatchItems({
    matches: [wire(matchDate, startMinute)],
    viewer: VIEWER,
  });
  // Mesmos builders puros que o `AgreementMatchCard` usa na tela (o provider só
  // encana eles): chip, menu e as propostas do acerto.
  const playerMatch = {
    agreements: {
      matchId: item.id,
      schedule: {
        agreedAt: null,
        proposal: null,
        proposedAt: null,
        proposedByMe: false,
        proposedBySide: null,
        state: "idle",
      },
      score: {
        agreedAt: null,
        proposal: null,
        proposedAt: null,
        proposedByMe: false,
        proposedBySide: null,
        state: "idle",
      },
    },
    match: {
      entryAId: "entry-me",
      entryBId: "entry-them",
      id: item.id,
      matchDate,
      round: 1,
      startMinute,
      status: matchDate ? "scheduled" : "pending",
      winnerEntryId: null,
    },
    mySide: "a",
    totalRounds: 2,
  } as never;
  const agreement = {
    chip: buildPlayerAgreementChip({ playerMatch }),
    menuItems: buildPlayerAgreementMenu({
      isMatchLocked: false,
      playerMatch,
      tournamentStatus: "ongoing",
    }).map((action) => ({
      icon: action.icon,
      isDanger: action.isDanger,
      label: action.label,
      onPress: () => undefined,
    })),
    scheduleProposal: buildPlayerAgreementScheduleProposal({
      courts: [],
      playerMatch,
    }),
    scoreProposal: buildPlayerAgreementScoreProposal({
      playerMatch,
      sideOrder: "viewer",
    }),
  };

  const nodes = walk(
    MatchCardImpl({
      agreement,
      challengedAvatarUrl: item.sideBAvatarUrl,
      challengedName: item.sideBName,
      challengedPartnerAvatarUrl: item.sideBPartnerAvatarUrl,
      challengedPartnerName: item.sideBPartnerName,
      challengerAvatarUrl: item.sideAAvatarUrl,
      challengerName: item.sideAName,
      challengerPartnerAvatarUrl: item.sideAPartnerAvatarUrl,
      challengerPartnerName: item.sideAPartnerName,
      courtName: item.courtName,
      matchDate: item.matchDate,
      matchStatus: item.matchStatus,
      stageLabel: item.stageLabel,
      startMinute: item.startMinute ?? 0,
    })
  );

  return {
    chips: nodes
      .filter((node) => node.type === Chip)
      .map((node) =>
        walk(node)
          .slice(1)
          .find((child) => typeof child.props?.children === "string")
      )
      .map((node) => node?.props?.children),
    lines: nodes
      .filter((node) => node.type === Text)
      .filter((node) => typeof node.props?.children === "string")
      .map((node) => node.props?.children),
    menu: (agreement?.menuItems ?? []).map(
      (menuItem) => `${menuItem.label} (${String(menuItem.icon)})`
    ),
  };
}

describe("card do Próximos jogos sem agendamento", () => {
  it("sem horário: os dois lados, chip A definir, sem linha de data e com a ação", () => {
    const card = renderHomeCard(null, null);

    expect(card.lines.slice(0, 2)).toEqual(["Bruninho", "Dieguinho"]);
    expect(card.chips).toContain("A definir");
    // Nenhuma linha de agendamento: o rodapé é o único lugar com o separador.
    expect(card.chips.some((chip) => String(chip).includes(" | "))).toBe(false);
    expect(card.lines.some((line) => String(line).includes(" | "))).toBe(false);
    expect(card.menu).toEqual(["Propor horário (agenda)"]);
  });

  it("com horário: a data aparece e a ação segue a mesma", () => {
    const card = renderHomeCard("2026-10-04", 540);

    expect(card.chips).toContain("4 de out.   |   09:00   |   Quadra 2");
    // Sem proposta na mesa o verbo é o mesmo dos dois casos (quem manda é o
    // estado do canal, não a presença de data no confronto).
    expect(card.menu).toEqual(["Propor horário (agenda)"]);
  });
});
