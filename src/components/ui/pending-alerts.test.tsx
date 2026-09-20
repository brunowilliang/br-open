import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Namespaces REAIS capturados ANTES dos mocks (import estático é avaliado antes
// do corpo do módulo): o `afterAll` devolve os originais aos outros arquivos do
// mesmo processo, porque `mock.module` resolve por CAMINHO e vazaria.
import * as realBetterStyled from "better-styled";
import * as realConvexCrpc from "@/lib/convex/crpc";
import * as realReactQuery from "@tanstack/react-query";

import type { PendingItem } from "@convex/domains/pendings/contract";
import { buildPlayerEntryPendings } from "@convex/domains/tournament/pendings-rules";
import { buildPlayerChallengePendingItem } from "@convex/domains/league/pendings-rules";

/**
 * WIRING do renderer de pendências (o HIGH do `Recusar`): o framework é
 * substituído por stubs no boundary (react-native/HeroUI/React Query/router) e
 * o componente é CHAMADO como função, então a árvore devolvida é inspecionada —
 * cada botão do alerta vira uma prop (`action`/`secondaryAction`) com o SEU
 * `onPress`, e o teste apertar cada botão mostra o comando que chega à mutation.
 *
 * O repo não tem harness de render (nem `react-test-renderer`) e `react-native`
 * não parseia sob bun (Flow), por isso os módulos são mockados ANTES do import
 * dinâmico do componente.
 */

const chargeCalls: unknown[] = [];
const inviteCalls: unknown[] = [];
const navigateCalls: unknown[] = [];
const pendingMutations = new Set<string>();

type MutationOptions = {
  mutationFn: (variables: never) => unknown;
  /** O componente passa o RESULTADO do `mutationKey()` do crpc (a chave). */
  mutationKey?: unknown;
};

mock.module("react-native", () => ({ View: (props: unknown) => props }));
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
mock.module("@/components/ui/loading-state", () => ({
  LoadingState: () => null,
}));
mock.module("@/components/ui/error-state", () => ({
  ErrorMessage: () => null,
}));
mock.module("@/lib/convex/crpc", () => ({
  useCRPC: () => ({
    payment: { charge: { createCharge: { mutationKey: () => ["charge"] } } },
    pendings: { list: { list: { queryFilter: () => ({ queryKey: [] }) } } },
    tournament: {
      entries: { respondPartnerInvite: { mutationKey: () => ["invite"] } },
    },
  }),
  useCRPCClient: () => ({
    payment: {
      charge: {
        createCharge: {
          mutate: (variables: unknown) => {
            chargeCalls.push(variables);
          },
        },
      },
    },
    tournament: {
      entries: {
        respondPartnerInvite: {
          mutate: (variables: unknown) => {
            inviteCalls.push(variables);
          },
        },
      },
    },
  }),
}));

const { PendingAlerts } = await import("@/components/ui/pending-alerts");

type AlertButton = {
  isDisabled: boolean;
  label: string;
  onPress: () => void;
};

type RenderedAlert = {
  action?: AlertButton;
  secondaryAction?: AlertButton;
  title: string;
};

function renderAlert(item: PendingItem): RenderedAlert {
  // `View` mockado é o TIPO do elemento: a chamada devolve
  // `{ props: { children: [<WidgetAlert .../>] } }` e o alerta é o `.props`
  // do filho (é lá que vivem `action`/`secondaryAction`).
  const tree = PendingAlerts({ items: [item] }) as unknown as {
    props: { children: { props: RenderedAlert }[] };
  };

  return tree.props.children[0]?.props as RenderedAlert;
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
  inviteCalls.length = 0;
  navigateCalls.length = 0;
  pendingMutations.clear();
});

// `mock.module` é resolvido por CAMINHO e vale para o PROCESSO TODO: sem a
// devolução abaixo, qualquer arquivo de teste que rode DEPOIS herdaria os stubs
// em silêncio. Os três caminhos com namespace real carregável sob bun voltam ao
// original aqui (provado com sonda descartável: `createStyledContext`,
// `QueryClient` e `CRPCProvider` reaparecem). Os outros seis NÃO têm como voltar:
// `react-native` é Flow e estoura "Unexpected typeof" sob bun, o que inviabiliza
// também expo-router, HeroUI e os dois componentes que os importam — e o runner
// compartilha o registro de módulos entre arquivos do mesmo processo, então um
// arquivo futuro que importe um deles herda o stub (re-mockar no arquivo novo
// NÃO sobrescreve; o jeito é rodar a suíte com `bun test --isolate`, que dá
// registro de módulos novo por arquivo). Hoje nenhum outro arquivo de teste
// importa esses caminhos.
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
});
