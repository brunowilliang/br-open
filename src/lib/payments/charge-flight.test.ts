import { describe, expect, it } from "bun:test";

import { createChargeOnce } from "./charge-flight";

const ENTRY_A = { sourceId: "entry-a", sourceType: "tournament_entry" };
const ENTRY_B = { sourceId: "entry-b", sourceType: "tournament_entry" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

describe("createChargeOnce", () => {
  it("dois toques no mesmo voo criam UMA cobrança", async () => {
    const gate = deferred<{ chargeId: string }>();
    let calls = 0;
    const create = () => {
      calls += 1;
      return gate.promise;
    };

    const first = createChargeOnce(ENTRY_A, create);
    const second = createChargeOnce(ENTRY_A, create);

    expect(calls).toBe(1);
    expect(second).toBe(first);

    gate.resolve({ chargeId: "charge-1" });
    await expect(first).resolves.toEqual({ chargeId: "charge-1" });
  });

  it("inscrições diferentes voam em paralelo, cada uma com a sua cobrança", async () => {
    const a = deferred<{ chargeId: string }>();
    const b = deferred<{ chargeId: string }>();
    let calls = 0;
    const create = () => {
      calls += 1;
      return calls === 1 ? a.promise : b.promise;
    };

    const first = createChargeOnce(ENTRY_A, create);
    const second = createChargeOnce(ENTRY_B, create);

    expect(calls).toBe(2);
    a.resolve({ chargeId: "charge-a" });
    b.resolve({ chargeId: "charge-b" });

    await expect(first).resolves.toEqual({ chargeId: "charge-a" });
    await expect(second).resolves.toEqual({ chargeId: "charge-b" });
  });

  it("erro não trava o source: o retry cria de novo", async () => {
    let calls = 0;
    const create = () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error("woovi fora"))
        : Promise.resolve({ chargeId: "charge-2" });
    };

    await expect(createChargeOnce(ENTRY_A, create)).rejects.toThrow(
      "woovi fora"
    );
    await expect(createChargeOnce(ENTRY_A, create)).resolves.toEqual({
      chargeId: "charge-2",
    });
    expect(calls).toBe(2);
  });

  it("depois de resolver, o próximo toque pergunta de novo (reuso é do servidor)", async () => {
    let calls = 0;
    const create = () => {
      calls += 1;
      return Promise.resolve({ chargeId: `charge-${calls}` });
    };

    await createChargeOnce(ENTRY_A, create);
    await expect(createChargeOnce(ENTRY_A, create)).resolves.toEqual({
      chargeId: "charge-2",
    });
  });
});
