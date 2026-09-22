import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Namespaces reais, capturados antes dos mocks: o `afterAll` devolve os originais.
import * as realBetterStyled from "better-styled";
import * as realConvexCrpc from "@/lib/convex/crpc";
import * as realReactQuery from "@tanstack/react-query";

import type {
  PendingItem,
  PendingSurface,
} from "@convex/domains/pendings/contract";
import { buildPlayerEntryPendings } from "@convex/domains/tournament/pendings-rules";
import { buildPlayerChallengePendingItem } from "@convex/domains/league/pendings-rules";

// O repo não tem harness de render (nem `react-test-renderer`) e `react-native`
// não parseia sob bun (Flow): o componente é CHAMADO como função e a árvore
// devolvida é inspecionada, com os módulos de boundary mockados antes do import.

const chargeCalls: unknown[] = [];
const dismissCalls: unknown[] = [];
const inviteCalls: unknown[] = [];
const navigateCalls: unknown[] = [];
const pendingMutations = new Set<string>();

type MutationOptions = {
  mutationFn: (variables: never) => unknown;
  /** O componente passa o RESULTADO do `mutationKey()` do crpc (a chave). */
  mutationKey?: unknown;
};

mock.module("react-native", () => ({ View: (props: unknown) => props }));
mock.module("react-native-reanimated", () => ({
  default: { View: (props: unknown) => props },
  FadeOut: { duration: (ms: number) => ({ duration: ms }) },
  LinearTransition: {},
}));
mock.module("better-styled", () => ({
  cn: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
}));
mock.module("@tanstack/react-query", () => ({
  useMutation: (options: MutationOptions) => ({
    isPending: pendingMutations.has(JSON.stringify(options.mutationKey ?? [])),
    mutate: (variables: never) => {
      options.mutationFn(variables);
    },
  }),
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
mock.module("expo-router", () => ({
  useRouter: () => ({
    navigate: (href: unknown) => {
      navigateCalls.push(href);
    },
  }),
}));
mock.module("heroui-native", () => ({
  useToast: () => ({ toast: { show: () => undefined } }),
}));
mock.module("@/components/ui/widget-alert", () => ({
  WidgetAlert: (props: unknown) => props,
}));
mock.module("@/components/ui/error-state", () => ({
  ErrorMessage: () => null,
}));
mock.module("@/lib/convex/crpc", () => ({
  useCRPC: () => ({
    league: {
      challenges: {
        acceptProposal: { mutationKey: () => ["accept-proposal"] },
        confirmResult: { mutationKey: () => ["confirm-result"] },
        declineProposal: { mutationKey: () => ["decline-proposal"] },
        respondCancellationRequest: {
          mutationKey: () => ["respond-cancellation"],
        },
      },
      membership: {
        approve: { mutationKey: () => ["approve-membership"] },
        reject: { mutationKey: () => ["reject-membership"] },
      },
    },
    payment: { charge: { createCharge: { mutationKey: () => ["charge"] } } },
    pendings: {
      dismiss: { dismiss: { mutationKey: () => ["dismiss-pending"] } },
      list: { list: { queryFilter: () => ({ queryKey: [] }) } },
    },
    tournament: {
      entries: {
        approve: { mutationKey: () => ["approve-entry"] },
        reject: { mutationKey: () => ["reject-entry"] },
        respondPartnerInvite: { mutationKey: () => ["invite"] },
      },
    },
  }),
  useCRPCClient: () => {
    // O runner monta TODAS as mutations: sem a superfície inteira um
    // `mutationFn` ausente estoura no mount.
    const notUsed = () => ({
      mutate: () => undefined,
    });

    return {
      league: {
        challenges: {
          acceptProposal: notUsed(),
          confirmResult: notUsed(),
          declineProposal: notUsed(),
          respondCancellationRequest: notUsed(),
        },
        membership: {
          approve: notUsed(),
          reject: notUsed(),
        },
      },
      payment: {
        charge: {
          createCharge: {
            mutate: (variables: unknown) => {
              chargeCalls.push(variables);
            },
          },
        },
      },
      pendings: {
        dismiss: {
          dismiss: {
            mutate: (variables: unknown) => {
              dismissCalls.push(variables);
            },
          },
        },
      },
      tournament: {
        entries: {
          approve: notUsed(),
          reject: notUsed(),
          respondPartnerInvite: {
            mutate: (variables: unknown) => {
              inviteCalls.push(variables);
            },
          },
        },
      },
    };
  },
}));

const { PendingAlerts } = await import("@/components/ui/pending-alerts");
const { LinearTransition } = await import("react-native-reanimated");

type AlertButton = {
  isDisabled: boolean;
  label: string;
  onPress: () => void;
};

type RenderedAlert = {
  action?: AlertButton;
  dismissAction?: { isDisabled: boolean; onPress: () => void };
  secondaryAction?: AlertButton;
  title: string;
};

/** O nó animado de UM item: só o opt-in traz `exiting`/`layout`. */
type RenderedWrapper = {
  exiting?: unknown;
  layout?: unknown;
};

type RenderedItem = { card: RenderedAlert; wrapper: RenderedWrapper };

function renderItems(props: {
  dismissSurface?: PendingSurface;
  items: PendingItem[];
}): RenderedItem[] {
  const tree = PendingAlerts(props) as unknown as {
    props: {
      children: { props: { children: { props: RenderedAlert } } }[];
    };
  };

  return (tree?.props.children ?? []).map((child) => ({
    card: child.props.children.props,
    wrapper: child.props as RenderedWrapper,
  }));
}

function renderAlert(
  item: PendingItem,
  dismissSurface?: PendingSurface
): RenderedAlert {
  return renderItems({ dismissSurface, items: [item] })[0].card;
}

const ENTRY_VIEW = {
  categoryDisplayName: "Duplas Mistas",
  entryFeeCents: 4000,
  entryId: "entry-invited",
  invitedName: "",
  inviterName: "Marina Costa",
  isCreator: false,
  isInvited: true,
  registrationDeadlineAtMs: Date.UTC(2026, 8, 20, 12),
  status: "pending_partner",
  tournamentId: "tournament-1",
  tournamentName: "Copa Dracena 8",
};

function buildInviteItem(): PendingItem {
  const [item] = buildPlayerEntryPendings({
    entries: [ENTRY_VIEW],
  });

  return item as PendingItem;
}

function buildChallengeItem(): PendingItem {
  return buildPlayerChallengePendingItem({
    counts: { confirmResult: 1, registerResult: 2, requestCorrection: 0 },
    leagueId: "league-1",
  }) as PendingItem;
}

beforeEach(() => {
  chargeCalls.length = 0;
  dismissCalls.length = 0;
  inviteCalls.length = 0;
  navigateCalls.length = 0;
  pendingMutations.clear();
});

// `mock.module` vale para o PROCESSO TODO: sem devolver os originais o próximo
// arquivo herda o stub (`react-native` é Flow e estoura sob bun).
afterAll(() => {
  mock.module("better-styled", () => realBetterStyled);
  mock.module("@tanstack/react-query", () => realReactQuery);
  mock.module("@/lib/convex/crpc", () => realConvexCrpc);
});

describe("PendingAlerts wiring", () => {
  it("dispatches each invite button with its OWN accept flag", () => {
    const alert = renderAlert(buildInviteItem());

    expect(alert.action?.label).toBe("Aceitar");
    expect(alert.secondaryAction?.label).toBe("Recusar");

    alert.action?.onPress();
    alert.secondaryAction?.onPress();

    // ACEITAR aceita; RECUSAR recusa (era o bug: os dois mandavam `accept: true`).
    expect(inviteCalls).toEqual([
      { accept: true, entryId: "entry-invited" },
      { accept: false, entryId: "entry-invited" },
    ]);
  });

  it("navigates with the entity params of the item", () => {
    const alert = renderAlert(buildChallengeItem());

    alert.action?.onPress();

    expect(navigateCalls).toEqual([
      {
        params: { leagueId: "league-1" },
        pathname: "/leagues/[leagueId]/challenges",
      },
    ]);
    // Nenhuma cobrança é criada por um CTA de navegação.
    expect(chargeCalls).toEqual([]);
  });

  it("disables BOTH buttons while the invite mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["invite"]));

    const alert = renderAlert(buildInviteItem());

    expect(alert.action?.isDisabled).toBe(true);
    expect(alert.secondaryAction?.isDisabled).toBe(true);
  });

  it("keeps the buttons enabled when another mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["charge"]));

    const alert = renderAlert(buildInviteItem());

    expect(alert.action?.isDisabled).toBe(false);
    expect(alert.secondaryAction?.isDisabled).toBe(false);
  });

  it("draws no secondary button when the item has no secondary action", () => {
    const alert = renderAlert(buildChallengeItem());

    expect(alert.secondaryAction).toBeUndefined();
  });

  it("dismisses THAT item on the surface the renderer declares", () => {
    const item = buildChallengeItem();
    const alert = renderAlert(item, "home");

    alert.dismissAction?.onPress();

    expect(dismissCalls).toEqual([{ itemId: item.id, surface: "home" }]);
  });

  it("leaves the revealed action without a handler when no surface opts in", () => {
    const alert = renderAlert(buildChallengeItem());

    expect(alert.dismissAction).toBeUndefined();
  });
});

describe("PendingAlerts dismissal animation", () => {
  it("animates the item only on the surface that opts in", () => {
    const item = buildChallengeItem();

    const [house] = renderItems({ items: [item] });
    expect(house.wrapper.exiting).toBeUndefined();
    expect(house.wrapper.layout).toBeUndefined();
    expect(house.card.title).toBe(item.title);

    const [opted] = renderItems({ dismissSurface: "home", items: [item] });
    expect(opted.wrapper.exiting).toBeDefined();
    expect(opted.wrapper.layout).toBe(LinearTransition);
  });

  it("dispatches the dismiss without hiding the card locally", () => {
    const item = buildChallengeItem();
    const props = { dismissSurface: "home" as const, items: [item] };

    renderItems(props)[0].card.dismissAction?.onPress();

    expect(dismissCalls).toEqual([{ itemId: item.id, surface: "home" }]);
    // Quem tira o item é a releitura do servidor: o renderer não esconde sozinho.
    const [after] = renderItems(props);
    expect(after.card.title).toBe(item.title);
    expect(after.card.dismissAction?.isDisabled).toBe(false);
  });

  it("disables the dismiss while its own mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["dismiss-pending"]));

    const alert = renderAlert(buildChallengeItem(), "home");

    expect(alert.dismissAction?.isDisabled).toBe(true);
  });
});
