/**
 * Entrada do checkout pelo fluxo de inscrição (`/checkout/new?sourceId…`).
 *
 * O repo não tem harness de render (`react-native` é Flow e não parseia sob
 * bun), então o precedente é CHAMAR o componente como função e inspecionar a
 * árvore (`pending-alerts.test.tsx`). Esta tela usa hooks de verdade, então
 * `react` entra mockado com células por hook: cada passada é uma chamada da
 * função do componente e os efeitos rodam depois, como num commit.
 *
 * O que este teste guarda: a tela resolve a cobrança SEM trocar o param da rota
 * (trocar re-montava o modal `fullScreenModal` — a tela saía e entrava de novo
 * antes do QR). A cobrança resolvida vive em estado local e o QR sai na MESMA
 * tela, com UMA única navegação (a que abriu o modal).
 *
 * Vive em `src/lib/payments` (e não ao lado da rota) porque `src/app/**` é
 * varrido pelo expo-router.
 */
import { afterAll, expect, it, mock } from "bun:test";

import * as realConvexCrpc from "@/lib/convex/crpc";
import * as realReactQuery from "@tanstack/react-query";

// O gate de dev do "Simular pagamento" é o mesmo do simulatePayment: ligado aqui
// para a ordem dos botões do layout de PIX ser testada por inteiro.
process.env.EXPO_PUBLIC_IS_DEV = "true";

type NavCall = { kind: "navigate" | "replace" | "setParams" };

const navCalls: NavCall[] = [];
const queryArgs: { chargeId?: string }[] = [];
const chargeCalls: unknown[] = [];
const cancelCalls: unknown[] = [];
const invalidated: unknown[] = [];
const backCalls: string[] = [];
let chargeFails = false;
let chargeStatus = "PENDING";
let categoryValue: null | string = "Simples Masculino";
let params: Record<string, string> = {};

type Cell = { kind: string; value: unknown };
let cells: Cell[] = [];
let cursor = 0;
let pendingEffects: (() => void)[] = [];
const cleanups: (() => void)[] = [];

/** Microtasks suficientes para a promessa da mutation resolver e o setState cair. */
async function flush() {
  for (let tick = 0; tick < 12; tick += 1) {
    await Promise.resolve();
  }
}

/** Espera a condição virar verdadeira (o harness não tem relógio). */
async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 40 && !predicate(); attempt += 1) {
    await flush();
  }
}

/** Componente de mentira com nome: as asserções acham o nó pelo `displayName`. */
type ComponentLike = ((props: Record<string, unknown>) => unknown) & {
  displayName?: string;
};

function mockComponent(name: string): ComponentLike {
  const component = (props: Record<string, unknown>) => props;
  component.displayName = name;

  return component;
}

// O mock precisa MANTER o react real (o `react/jsx-dev-runtime` lê os internals
// dele) e trocar só os hooks.
const realReact = await import("react");

mock.module("react", () => ({
  ...realReact,
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => {
    pendingEffects.push(fn);
  },
  useMemo: (fn: () => unknown) => fn(),
  useRef: (initial: unknown) => {
    const index = cursor++;
    cells[index] ??= { kind: "ref", value: { current: initial } };

    return cells[index]?.value as { current: unknown };
  },
  useState: (initial: unknown) => {
    const index = cursor++;
    cells[index] ??= {
      kind: "state",
      value:
        typeof initial === "function" ? (initial as () => unknown)() : initial,
    };

    const cell = cells[index] as Cell;

    return [
      cell.value,
      (next: unknown) => {
        cell.value =
          typeof next === "function"
            ? (next as (value: unknown) => unknown)(cell.value)
            : next;
      },
    ];
  },
}));
mock.module("react-native", () => ({ View: mockComponent("View") }));
mock.module("@/components/core/page", () => {
  const Page = Object.assign(mockComponent("Page"), {
    Header: Object.assign(mockComponent("Page.Header"), {
      Center: mockComponent("Page.Header.Center"),
      Icon: mockComponent("Page.Header.Icon"),
      Left: mockComponent("Page.Header.Left"),
      Right: mockComponent("Page.Header.Right"),
      SubTitle: mockComponent("Page.Header.SubTitle"),
      Title: mockComponent("Page.Header.Title"),
    }),
    ScrollView: mockComponent("Page.ScrollView"),
    View: mockComponent("Page.View"),
  });

  return { Page };
});
mock.module("@/components/core/text", () => ({
  Text: mockComponent("Text"),
}));
mock.module("@/components/core/image", () => ({
  Image: mockComponent("Image"),
}));
mock.module("@/components/ui/huge-icons", () => ({
  HugeIcons: mockComponent("HugeIcons"),
}));
mock.module("expo-clipboard", () => ({
  setStringAsync: async () => undefined,
}));
mock.module("expo-router", () => ({
  useLocalSearchParams: () => params,
  useRouter: () => ({
    back: () => backCalls.push("back"),
    navigate: () => navCalls.push({ kind: "navigate" }),
    replace: () => navCalls.push({ kind: "replace" }),
    setParams: () => navCalls.push({ kind: "setParams" }),
  }),
}));
mock.module("heroui-native", () => ({
  Button: Object.assign(mockComponent("Button"), {
    Label: mockComponent("Button.Label"),
  }),
  Card: mockComponent("Card"),
  Chip: Object.assign(mockComponent("Chip"), {
    Label: mockComponent("Chip.Label"),
  }),
  Dialog: Object.assign(mockComponent("Dialog"), {
    Content: mockComponent("Dialog.Content"),
    Overlay: mockComponent("Dialog.Overlay"),
    Portal: mockComponent("Dialog.Portal"),
    Title: mockComponent("Dialog.Title"),
  }),
  Skeleton: mockComponent("Skeleton"),
  useToast: () => ({ toast: { show: () => undefined } }),
}));
mock.module("heroui-native-pro", () => ({
  EmptyState: Object.assign(mockComponent("EmptyState"), {
    Content: mockComponent("EmptyState.Content"),
    // Título e descrição do empty state são texto: o harness lê como "Text".
    Description: mockComponent("Text"),
    Media: mockComponent("EmptyState.Media"),
    Title: mockComponent("Text"),
  }),
}));
mock.module("@/components/ui/dialog-close-button", () => ({
  DialogCloseButton: mockComponent("DialogCloseButton"),
}));
mock.module("@/lib/convex/crpc", () => ({
  useCRPC: () => ({
    payment: {
      charge: {
        createCharge: { mutationKey: () => ["charge"] },
        getCheckoutContext: {
          queryFilter: (args: unknown) => ({ args, queryKey: ["checkout"] }),
          staticQueryOptions: (args: unknown) => ({
            args,
            queryKey: ["checkout"],
          }),
        },
        listMine: { queryFilter: () => ({ queryKey: ["listMine"] }) },
        simulatePayment: { mutationKey: () => ["simulate"] },
      },
    },
    pendings: {
      list: { list: { queryFilter: () => ({ queryKey: ["pendings"] }) } },
    },
    tournament: {
      entries: { cancel: { mutationKey: () => ["cancel-entry"] } },
    },
  }),
  useCRPCClient: () => ({
    payment: {
      charge: {
        createCharge: {
          mutate: () => {
            chargeCalls.push("create");

            return chargeFails
              ? Promise.reject(new Error("woovi fora"))
              : flush().then(() => ({ chargeId: "charge-real" }));
          },
        },
        simulatePayment: { mutate: () => undefined },
      },
    },
    tournament: {
      entries: {
        cancel: {
          mutate: (variables: unknown) => {
            cancelCalls.push(variables);

            return flush();
          },
        },
      },
    },
  }),
}));
mock.module("@tanstack/react-query", () => ({
  useMutation: (options: {
    mutationFn: (variables: never) => Promise<unknown>;
    onError?: (error: unknown, variables: never) => unknown;
    onSuccess?: (result: unknown, variables: never) => unknown;
  }) => ({
    isPending: false,
    mutate: (variables: never) => {
      Promise.resolve()
        .then(() => options.mutationFn(variables))
        .then((result) => options.onSuccess?.(result, variables))
        .catch((error) => options.onError?.(error, variables));
    },
  }),
  useQuery: (options: { args?: { chargeId?: string } }) => {
    queryArgs.push(options.args ?? {});

    if (options.args?.chargeId !== "charge-real") {
      return { data: undefined, isError: false, isLoading: true };
    }

    return {
      data: {
        amountCents: 5000,
        brCode: "000201-charge-real",
        chargeId: "charge-real",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        pendingCharge: null,
        qrCodeUrl: "https://qr.example/charge-real.png",
        sourceCategory: categoryValue,
        sourceId: "entry-1",
        sourceLabel: "Copa Vila",
        sourceType: "tournament_entry",
        status: chargeStatus,
      },
      isError: false,
      isLoading: false,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: (filter: unknown) => {
      invalidated.push(filter);

      return flush();
    },
  }),
}));

const CheckoutScreen = (
  await import("@/app/(private)/checkout/[chargeId]/index")
).default;

type Element = { props?: Record<string, unknown>; type?: unknown };

/** Anda a árvore entregando o `displayName` do nó e os props, por tipo. */
function walkByType(
  node: unknown,
  visit: (name: string | undefined, props: Record<string, unknown>) => void
) {
  if (Array.isArray(node)) {
    for (const child of node) {
      walkByType(child, visit);
    }

    return;
  }

  if (!(node && typeof node === "object")) {
    return;
  }

  const element = node as Element;
  const { props, type } = element;
  if (!props) {
    return;
  }

  if (typeof type === "function") {
    const component = type as ComponentLike;

    // Componente REAL (sem `displayName` = não é mock): o JSX não o invoca, então
    // o harness invoca para enxergar a subárvore (ex.: o cartão de estado). Vale
    // só para componente sem hook; um que use hook estoura aqui, alto.
    if (!component.displayName) {
      walkByType(component(props), visit);

      return;
    }

    visit(component.displayName, props);
    walkByType(props.children, visit);

    return;
  }

  // Fragment e afins (o `<>` do JSX): sem nome, só desce nos filhos.
  visit(undefined, props);
  walkByType(props.children, visit);
}

function renderScreen() {
  // Desmonta os efeitos da passada anterior (o countdown devolve o clearInterval).
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }

  cursor = 0;
  pendingEffects = [];
  const tree = CheckoutScreen();
  for (const effect of pendingEffects) {
    const cleanup = effect();
    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  }

  return tree;
}

/** Quantas passadas forem precisas para o estado assentar. */
async function renderUntilQuiet() {
  let tree = renderScreen();
  for (let pass = 0; pass < 3; pass += 1) {
    await flush();
    tree = renderScreen();
  }
  await flush();

  return tree;
}

type Found = {
  buttons: { label: string | undefined; press?: () => void }[];
  /** Rótulo dos chips (heroui-native: `Chip` + `Chip.Label`). */
  chips: string[];
  images: unknown[];
  /** Rótulos e textos na ORDEM em que a tela pinta (o que a ordem do layout exige). */
  order: string[];
  skeletons: unknown[];
  texts: string[];
};

function labelOf(node: unknown, labelType: "Button.Label" | "Chip.Label") {
  let label: string | undefined;
  walkByType(node, (name, props) => {
    if (name === labelType && typeof props.children === "string") {
      label = props.children;
    }
  });

  return label;
}

/** O que é pintado a partir de um nó (o JSX não invoca componente: o harness invoca). */
function collect(node: unknown): Found {
  const found: Found = {
    buttons: [],
    chips: [],
    images: [],
    order: [],
    skeletons: [],
    texts: [],
  };

  walkByType(node, (name, props) => {
    if (name === "Chip") {
      const label = labelOf(props.children, "Chip.Label");

      if (label) {
        found.chips.push(label);
      }
    }
    if (name === "Image") {
      found.images.push(props.source);
    }
    if (name === "Skeleton") {
      found.skeletons.push(props.isLoading);
    }
    if (name === "Text" && typeof props.children === "string") {
      found.texts.push(props.children);
      found.order.push(props.children);
    }
    if (name === "Button") {
      const label = labelOf(props.children, "Button.Label");

      found.buttons.push({
        label,
        press:
          typeof props.onPress === "function"
            ? (props.onPress as () => void)
            : undefined,
      });
      if (label) {
        found.order.push(label);
      }
    }
  });

  return found;
}

/** Coleta a subárvore do nó com esse `displayName` (corpo ou diálogo). */
function collectUnder(tree: unknown, rootName: string) {
  let found: Found = {
    buttons: [],
    chips: [],
    images: [],
    order: [],
    skeletons: [],
    texts: [],
  };
  walkByType(tree, (name, props) => {
    if (name === rootName) {
      found = collect(props.children);
    }
  });

  return found;
}

/** Filhos DIRETOS do corpo: o cancelar do PIX mora no FLUXO, não solto no fim. */
function readDirectBodyChildren(tree: unknown) {
  let children: unknown[] = [];
  walkByType(tree, (name, props) => {
    if (name === "Page.View" || name === "Page.ScrollView") {
      children = Array.isArray(props.children)
        ? props.children
        : [props.children];
    }
  });

  return children;
}

function isCancelButton(node: unknown) {
  const element = node as Element;
  const type = element?.type;

  return (
    typeof type === "function" &&
    (type as ComponentLike).displayName === "Button" &&
    labelOf(element?.props?.children, "Button.Label") === "Cancelar inscrição"
  );
}

/** O corpo da tela (o Header/botão de voltar fica fora). */
function readView(tree: unknown) {
  let found: Found = {
    buttons: [],
    chips: [],
    images: [],
    order: [],
    skeletons: [],
    texts: [],
  };
  walkByType(tree, (name, props) => {
    if (name === "Page.View" || name === "Page.ScrollView") {
      found = collect(props.children);
    }
  });

  return found;
}

/** Botão pelo rótulo dentro do corpo da tela. */
function findButton(tree: unknown, label: string) {
  return readView(tree).buttons.find((button) => button.label === label)?.press;
}

/** O diálogo é irmão do corpo: lido do `Dialog.Portal`. */
function readDialog(tree: unknown) {
  return collectUnder(tree, "Dialog.Portal");
}

/** Botão pelo rótulo dentro do diálogo. */
function findDialogButton(tree: unknown, label: string) {
  return readDialog(tree).buttons.find((button) => button.label === label)
    ?.press;
}

/** Entra no fluxo como o toque em "inscrever e pagar": o modal abre UMA vez. */
async function enterFlow(input?: {
  category?: null | string;
  fails?: boolean;
  status?: string;
}) {
  navCalls.length = 0;
  queryArgs.length = 0;
  chargeCalls.length = 0;
  cancelCalls.length = 0;
  invalidated.length = 0;
  backCalls.length = 0;
  const nextCategory = input?.category;

  chargeFails = input?.fails ?? false;
  chargeStatus = input?.status ?? "PENDING";
  categoryValue =
    nextCategory === undefined ? "Simples Masculino" : nextCategory;
  cells = [];
  params = {
    chargeId: "new",
    sourceId: "entry-1",
    sourceType: "tournament_entry",
  };
  navCalls.push({ kind: "navigate" });

  return { tree: await renderUntilQuiet() };
}

afterAll(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  mock.module("@/lib/convex/crpc", () => realConvexCrpc);
  mock.module("@tanstack/react-query", () => realReactQuery);
});

it("entra no checkout com UMA navegação e pinta o QR na mesma tela", async () => {
  const { tree } = await enterFlow();
  const { images, skeletons } = readView(tree);

  expect(navCalls).toEqual([{ kind: "navigate" }]);
  expect(queryArgs.at(-1)?.chargeId).toBe("charge-real");
  expect(images).toEqual([{ uri: "https://qr.example/charge-real.png" }]);
  expect(skeletons).not.toContain(true);
  // 4 passadas: o efeito de criação só pode disparar UMA cobrança.
  expect(chargeCalls.length).toBe(1);
});

it("falha ao criar não navega e o retry cria na MESMA tela", async () => {
  const failed = readView((await enterFlow({ fails: true })).tree);

  // Sem QR, com o botão de retry — e nenhuma navegação nova.
  expect(failed.images).toEqual([]);
  expect(failed.buttons.map((button) => button.label)).toEqual([
    "Tentar novamente",
  ]);
  expect(navCalls).toEqual([{ kind: "navigate" }]);

  chargeFails = false;
  failed.buttons[0]?.press?.();
  const retried = readView(await renderUntilQuiet());

  expect(navCalls).toEqual([{ kind: "navigate" }]);
  expect(retried.images).toEqual([
    { uri: "https://qr.example/charge-real.png" },
  ]);
  // Falha + retry: duas tentativas, uma por toque no botão.
  expect(chargeCalls.length).toBe(2);
});

it("cancela a inscrição pelo PIX: uma mutation, as invalidações e a volta", async () => {
  const { tree } = await enterFlow();

  // O gatilho vive no corpo (o diálogo é lido à parte).
  expect(findButton(tree, "Cancelar inscrição")).toBeDefined();
  findButton(tree, "Cancelar inscrição")?.();

  const opened = await renderUntilQuiet();
  const dialogButtons = collectUnder(opened, "Dialog.Portal").buttons.map(
    (button) => button.label
  );

  expect(dialogButtons).toEqual(["Voltar", "Cancelar inscrição"]);

  findDialogButton(opened, "Cancelar inscrição")?.();
  // O sucesso aguarda duas invalidações antes de fechar a tela.
  await waitFor(() => backCalls.length > 0);

  // A porta é a que já existe: a inscrição pelo sourceId da cobrança.
  expect(cancelCalls).toEqual([{ entryId: "entry-1" }]);
  // Cancelar não navega nem empilha: o modal fecha e a tela volta.
  expect(navCalls).toEqual([{ kind: "navigate" }]);
  expect(backCalls).toEqual(["back"]);
  // As duas listas que as telas leem são invalidadas (o hub e as pendências).
  const filters = JSON.stringify(invalidated);
  expect(filters).toContain("listMine");
  expect(filters).toContain("pendings");
});

it("o valor sai sem sufixo de período e a categoria vem em chip", async () => {
  const { tree } = await enterFlow();
  const { chips, texts } = readView(tree);

  // Inscrição é pagamento único: nada de "/mês" colado no preço.
  expect(texts).toContain("R$ 50,00");
  expect(texts).not.toContain("/mês");
  expect(chips).toEqual(["Simples Masculino"]);
});

it("sem categoria não existe chip", async () => {
  const { tree } = await enterFlow({ category: null });
  const { chips, texts } = readView(tree);

  // O preço continua saindo (é o que prova que a tela já carregou, e não que o
  // bloco inteiro está escondido no loading).
  expect(texts).toContain("R$ 50,00");
  expect(chips).toEqual([]);
});

const PIX_HELP_TEXT =
  "Abra o app do seu banco e escaneie o QR code ou cole o código acima para pagar.";

it("no layout de PIX o cancelar fica abaixo da linha do copia-e-cola", async () => {
  const { tree } = await enterFlow();
  const { order } = readView(tree);
  const required = [
    "Copiar código PIX",
    "Simular pagamento",
    "Cancelar inscrição",
  ];

  // Ordem do alvo: o cancelar sai logo depois da linha do copia-e-cola.
  expect(order.filter((item) => required.includes(item))).toEqual(required);
  // E ele está NO FLUXO do layout (irmão do aviso), não solto como último filho
  // do corpo com âncora de rodapé (era o defeito: o botão ia para o fundo).
  expect(readDirectBodyChildren(tree).filter(isCancelButton)).toEqual([]);
  // O aviso do banco vive no rodapé da tela, fora do corpo.
  expect(collect(tree).texts).toContain(PIX_HELP_TEXT);
});

it("com o pagamento confirmado não existe cancelar", async () => {
  const { tree } = await enterFlow({ status: "PAID" });
  const { buttons, images, texts } = readView(tree);

  expect(findButton(tree, "Cancelar inscrição")).toBeUndefined();
  // Cartão terminal: sem PIX; a ação do estado é só sair, e o botão vive DENTRO
  // do cartão (slot de conteúdo do empty state), não solto na tela.
  expect(buttons.map((button) => button.label)).toEqual(["Voltar"]);
  expect(
    collectUnder(tree, "EmptyState.Content").buttons.map(
      (button) => button.label
    )
  ).toEqual(["Voltar"]);
  expect(images).toEqual([]);
  expect(texts).toContain("Pagamento confirmado!");

  findButton(tree, "Voltar")?.();
  expect(backCalls).toEqual(["back"]);
});

it("com o PIX expirado o cartão terminal não traz o cancelar", async () => {
  const { tree } = await enterFlow({ status: "EXPIRED" });
  const { buttons, images, texts } = readView(tree);

  // Hoje o cancelar só existe no layout de PIX vivo: no Expirado o cartão
  // terminal ocupa o lugar dele e oferece um PIX novo.
  expect(texts).toContain("PIX expirado");
  expect(findButton(tree, "Cancelar inscrição")).toBeUndefined();
  expect(buttons.map((button) => button.label)).toEqual(["Gerar novo PIX"]);
  expect(images).toEqual([]);

  findButton(tree, "Gerar novo PIX")?.();
  expect(chargeCalls).toEqual(["create"]);
});
