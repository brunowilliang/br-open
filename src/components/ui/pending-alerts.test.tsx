import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Namespaces reais, capturados antes dos mocks: o `afterAll` devolve os originais.
import * as realBetterStyled from "better-styled";
import * as realConvexCrpc from "@/lib/convex/crpc";
import * as realReactQuery from "@tanstack/react-query";

import type {
  PendingItem,
  PendingSurface,
} from "@convex/domains/pendings/contract";
import {
  buildOrganizerConclusionPendings,
  buildPlayerEntryPendings,
} from "@convex/domains/tournament/pendings-rules";

// O repo não tem harness de render (nem `react-test-renderer`) e `react-native`
// não parseia sob bun (Flow): o componente é CHAMADO como função e a árvore
// devolvida é inspecionada, com os módulos de boundary mockados antes do import.

const chargeCalls: unknown[] = [];
const concludeCalls: unknown[] = [];
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
      lifecycle: {
        conclude: { mutationKey: () => ["conclude-tournament"] },
      },
    },
  }),
  useCRPCClient: () => {
    // O runner monta TODAS as mutations: sem a superfície inteira um
    // `mutationFn` ausente estoura no mount. `createCharge` fica só como
    // armadilha: o CTA Pagar NÃO pode chamá-lo (quem cria é o checkout).
    const notUsed = () => ({
      mutate: () => undefined,
    });

    return {
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
        lifecycle: {
          conclude: {
            mutate: (variables: unknown) => {
              concludeCalls.push(variables);
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

/** Inscrição aguardando pagamento: item com CTA de cobrança do torneio. */
function buildPaymentItem(): PendingItem {
  const [item] = buildPlayerEntryPendings({
    entries: [
      {
        ...ENTRY_VIEW,
        entryId: "entry-awaiting-payment",
        invitedName: "",
        inviterName: "",
        isCreator: true,
        isInvited: false,
        status: "awaiting_payment",
      },
    ],
  });

  return item as PendingItem;
}

/** Conclusão do torneio: item de ESTADO, sem dispensa (o CTA conclui). */
function buildConclusionItem(): PendingItem {
  const [item] = buildOrganizerConclusionPendings({
    tournaments: [
      {
        canConclude: true,
        tournamentId: "tournament-1",
        tournamentName: "Copa Dracena 8",
      },
    ],
  });

  return item as PendingItem;
}

beforeEach(() => {
  chargeCalls.length = 0;
  concludeCalls.length = 0;
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

  it("opens the checkout for the entry without waiting for the charge", () => {
    const alert = renderAlert(buildPaymentItem());

    alert.action?.onPress();

    // A cobrança nasce no checkout: o toque só navega (o POST à Woovi não
    // pode segurar a transição).
    expect(navigateCalls).toEqual([
      {
        params: {
          chargeId: "new",
          sourceId: "entry-awaiting-payment",
          sourceType: "tournament_entry",
        },
        pathname: "/checkout/[chargeId]",
      },
    ]);
    expect(chargeCalls).toEqual([]);
  });

  it("disables BOTH buttons while the invite mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["invite"]));

    const alert = renderAlert(buildInviteItem());

    expect(alert.action?.isDisabled).toBe(true);
    expect(alert.secondaryAction?.isDisabled).toBe(true);
  });

  it("keeps the buttons enabled when another mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["approve-entry"]));

    const alert = renderAlert(buildInviteItem());

    expect(alert.action?.isDisabled).toBe(false);
    expect(alert.secondaryAction?.isDisabled).toBe(false);
  });

  it("draws no secondary button when the item has no secondary action", () => {
    const alert = renderAlert(buildPaymentItem());

    expect(alert.secondaryAction).toBeUndefined();
  });

  it("runs the conclusion CTA on the tournament it belongs to", () => {
    const alert = renderAlert(buildConclusionItem());

    expect(alert.action?.label).toBe("Concluir");

    alert.action?.onPress();

    expect(concludeCalls).toEqual([{ tournamentId: "tournament-1" }]);
  });

  it("disables the conclusion CTA while its own mutation is in flight", () => {
    pendingMutations.add(JSON.stringify(["conclude-tournament"]));

    const alert = renderAlert(buildConclusionItem());

    expect(alert.action?.isDisabled).toBe(true);
  });

  it("offers no dismiss for the state item, not even on the home", () => {
    const alert = renderAlert(buildConclusionItem(), "home");

    // O kind vive em PENDING_NON_DISMISSIBLE_KINDS: sem ação revelada, o item
    // não sai da casa e o servidor recusaria a dispensa de qualquer forma.
    expect(alert.dismissAction).toBeUndefined();
  });

  it("dismisses THAT item on the surface the renderer declares", () => {
    const item = buildPaymentItem();
    const alert = renderAlert(item, "home");

    alert.dismissAction?.onPress();

    expect(dismissCalls).toEqual([{ itemId: item.id, surface: "home" }]);
  });

  it("leaves the revealed action without a handler when no surface opts in", () => {
    const alert = renderAlert(buildPaymentItem());

    expect(alert.dismissAction).toBeUndefined();
  });
});

describe("PendingAlerts dismissal animation", () => {
  it("animates the item only on the surface that opts in", () => {
    const item = buildPaymentItem();

    const [house] = renderItems({ items: [item] });
    expect(house.wrapper.exiting).toBeUndefined();
    expect(house.wrapper.layout).toBeUndefined();
    expect(house.card.title).toBe(item.title);

    const [opted] = renderItems({ dismissSurface: "home", items: [item] });
    expect(opted.wrapper.exiting).toBeDefined();
    expect(opted.wrapper.layout).toBe(LinearTransition);
  });

  it("dispatches the dismiss without hiding the card locally", () => {
    const item = buildPaymentItem();
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

    const alert = renderAlert(buildPaymentItem(), "home");

    expect(alert.dismissAction?.isDisabled).toBe(true);
  });
});
