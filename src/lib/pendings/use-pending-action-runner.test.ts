import { beforeEach, describe, expect, it, mock } from "bun:test";

// Sem harness de render: o hook é CHAMADO como função (os boundaries viram
// mocks) e o `onSuccess` guardado é disparado à mão — o react-query mockado não
// roda o ciclo real de mutação.
type MutationOptions = {
  mutationFn?: (variables: unknown) => unknown;
  mutationKey?: unknown;
  onSuccess?: (data: unknown, variables: unknown) => Promise<void> | void;
};

const mutations = new Map<string, MutationOptions>();
const mutateCalls: string[] = [];
const invalidatedKeys: unknown[] = [];

mock.module("@tanstack/react-query", () => ({
  useMutation: (options: MutationOptions) => {
    const key = JSON.stringify(options.mutationKey ?? []);

    mutations.set(key, options);

    return {
      isPending: false,
      mutate: () => {
        mutateCalls.push(key);
      },
    };
  },
  useQueryClient: () => ({
    invalidateQueries: (filter: { queryKey?: unknown }) => {
      invalidatedKeys.push(filter.queryKey);
    },
  }),
}));

mock.module("expo-router", () => ({
  useRouter: () => ({ navigate: () => undefined }),
}));

mock.module("heroui-native", () => ({
  useToast: () => ({ toast: { show: () => undefined } }),
}));

// O runner monta TODAS as mutations no mount: a superfície inteira precisa
// existir, senão o `mutationFn` ausente estoura antes do teste começar.
function leaf(key: string[]) {
  return { mutationKey: () => key, queryFilter: () => ({ queryKey: key }) };
}

function notUsed() {
  return { mutate: () => undefined };
}

mock.module("@/lib/convex/crpc", () => ({
  useCRPC: () => ({
    pendings: {
      dismiss: { dismiss: leaf(["pendings.dismiss.dismiss"]) },
      list: { list: leaf(["pendings.list.list"]) },
    },
    player: {
      dashboard: { getOverview: leaf(["player.dashboard.getOverview"]) },
    },
    tournament: {
      agreements: {
        acceptSchedule: leaf(["accept-match-schedule"]),
        acceptScore: leaf(["confirm-match-score"]),
        listMyMatches: leaf(["tournament.agreements.listMyMatches"]),
      },
      entries: {
        approve: leaf(["approve-entry"]),
        reject: leaf(["reject-entry"]),
        respondPartnerInvite: leaf(["invite"]),
      },
      lifecycle: { conclude: leaf(["conclude-tournament"]) },
    },
  }),
  useCRPCClient: () => ({
    pendings: { dismiss: { dismiss: notUsed() } },
    tournament: {
      agreements: { acceptSchedule: notUsed(), acceptScore: notUsed() },
      entries: {
        approve: notUsed(),
        reject: notUsed(),
        respondPartnerInvite: notUsed(),
      },
      lifecycle: { conclude: notUsed() },
    },
  }),
}));

const { usePendingActionRunner } = await import("./use-pending-action-runner");

async function succeed(key: string) {
  const options = mutations.get(JSON.stringify([key]));

  if (!options?.onSuccess) {
    throw new Error(`mutation ${key} sem onSuccess`);
  }

  await options.onSuccess(undefined, undefined);
}

beforeEach(() => {
  mutateCalls.length = 0;
  invalidatedKeys.length = 0;
});

describe("usePendingActionRunner", () => {
  it("relê o confronto e a home no aceite do horário", async () => {
    const runner = usePendingActionRunner();

    runner.runAction({ kind: "accept_match_schedule", matchId: "match-7" });

    expect(mutateCalls).toEqual([JSON.stringify(["accept-match-schedule"])]);

    await succeed("accept-match-schedule");

    expect(invalidatedKeys).toEqual([
      ["pendings.list.list"],
      ["tournament.agreements.listMyMatches"],
      ["player.dashboard.getOverview"],
    ]);
  });

  it("relê o confronto e a home na confirmação do placar", async () => {
    const runner = usePendingActionRunner();

    runner.runAction({ kind: "confirm_match_score", matchId: "match-9" });

    expect(mutateCalls).toEqual([JSON.stringify(["confirm-match-score"])]);

    await succeed("confirm-match-score");

    expect(invalidatedKeys).toEqual([
      ["pendings.list.list"],
      ["tournament.agreements.listMyMatches"],
      ["player.dashboard.getOverview"],
    ]);
  });

  it("mantém o contexto da tela depois das releituras do aceite", async () => {
    const performed: string[] = [];

    usePendingActionRunner({
      onPerformed: () => {
        performed.push("performed");
      },
    });

    await succeed("accept-match-schedule");

    expect(performed).toEqual(["performed"]);
    expect(invalidatedKeys).toHaveLength(3);
  });
});
