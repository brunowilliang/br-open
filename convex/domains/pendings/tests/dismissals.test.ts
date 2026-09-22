import { describe, expect, it } from "bun:test";

import {
  dismissPendingItemSchema,
  type PendingsListResult,
  type PendingItem,
  type PendingSeverity,
} from "../contract";
import {
  buildPendingDismissalSnapshot,
  buildPendingsResult,
  PENDING_ITEM_CAP,
  type PendingsActorRef,
  type PendingDismissalReceipt,
  resolvePendingItemScope,
  selectDeadPendingDismissals,
} from "../pendings-rules";
import { toPendingActorRef } from "../registry";

const PLAYER: PendingsActorRef = { id: "player-1", kind: "player" };
const ORGANIZATION: PendingsActorRef = { id: "org-1", kind: "organization" };

function makeItem(input: {
  count?: null | number;
  deadlineAt?: null | number;
  id: string;
  severity?: PendingSeverity;
}): PendingItem {
  return {
    action: null,
    actionLabel: null,
    count: input.count ?? null,
    deadlineAt: input.deadlineAt ?? null,
    description: "Descrição de teste.",
    domain: "payment",
    id: input.id,
    kind: "player_league_membership_suspended",
    moneyCents: null,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: input.severity ?? "warning",
    source: { id: input.id, type: "league_membership" },
    title: "Pendência de teste",
  };
}

/** Recibo do item como estava quando o usuario dispensou. */
function makeReceipt(input: {
  actor?: PendingsActorRef;
  item: PendingItem;
  itemId?: string;
  surface?: "home" | "house";
}): PendingDismissalReceipt {
  const actor = input.actor ?? PLAYER;

  return {
    ...buildPendingDismissalSnapshot(input.item),
    actorId: actor.id,
    actorKind: actor.kind,
    itemId: input.itemId ?? input.item.id,
    surface: input.surface ?? "home",
  };
}

function result(input: {
  actor?: PendingsActorRef;
  items: PendingItem[];
  receipts: PendingDismissalReceipt[];
  surface?: "home" | "house";
}): PendingsListResult {
  return buildPendingsResult({
    dismissals: {
      actor: input.actor ?? PLAYER,
      receipts: input.receipts,
      surface: input.surface ?? "home",
    },
    items: input.items,
    scope: "player",
  });
}

describe("pendings: dispensa de item", () => {
  it("recibo vivo esconde o item na home", () => {
    const dismissed = makeItem({ id: "item-a" });
    const kept = makeItem({ id: "item-b" });
    const outcome = result({
      items: [dismissed, kept],
      receipts: [makeReceipt({ item: dismissed })],
    });

    expect(outcome.items.map((item) => item.id)).toEqual(["item-b"]);
    expect(outcome.counts.total).toBe(1);
  });

  it("a casa NUNCA esconde, mesmo com recibo da home", () => {
    const dismissed = makeItem({ id: "item-a" });
    const kept = makeItem({ id: "item-b" });
    const outcome = result({
      items: [dismissed, kept],
      receipts: [makeReceipt({ item: dismissed })],
      surface: "house",
    });

    expect(outcome.items.map((item) => item.id)).toEqual(["item-a", "item-b"]);
    expect(outcome.counts.total).toBe(2);
  });

  it("recibo de OUTRA superficie nao vale nesta", () => {
    const item = makeItem({ id: "item-a" });
    const outcome = result({
      items: [item],
      receipts: [makeReceipt({ item, surface: "house" })],
    });

    expect(outcome.items.map((candidate) => candidate.id)).toEqual(["item-a"]);
  });

  it("recibo de OUTRO ator nao esconde o item do ator da leitura", () => {
    const item = makeItem({ id: "item-a" });
    const outcome = result({
      items: [item],
      receipts: [
        makeReceipt({ actor: ORGANIZATION, item }),
        makeReceipt({ actor: { id: "player-2", kind: "player" }, item }),
      ],
    });

    expect(outcome.items.map((candidate) => candidate.id)).toEqual(["item-a"]);
    expect(outcome.counts.total).toBe(1);
  });

  it("severidade que sobe mata o recibo e o item VOLTA", () => {
    const was = makeItem({ id: "item-a", severity: "warning" });
    const escalated = makeItem({ id: "item-a", severity: "danger" });
    const receipt = makeReceipt({ item: was });

    expect(result({ items: [was], receipts: [receipt] }).items).toEqual([]);
    expect(
      result({ items: [escalated], receipts: [receipt] }).items.map(
        (item) => item.id
      )
    ).toEqual(["item-a"]);
  });

  it("contagem que cresce mata o recibo e o item VOLTA", () => {
    const was = makeItem({ count: null, id: "item-a" });
    const grew = makeItem({ count: 3, id: "item-a" });
    const receipt = makeReceipt({ item: was });

    expect(result({ items: [was], receipts: [receipt] }).items).toEqual([]);
    expect(
      result({ items: [grew], receipts: [receipt] }).items.map(
        (item) => item.id
      )
    ).toEqual(["item-a"]);
    // Caso unico com contagem 1 e o MESMO caso do `count` nulo: segue escondido.
    expect(
      result({
        items: [makeItem({ count: 1, id: "item-a" })],
        receipts: [receipt],
      }).items
    ).toEqual([]);
  });

  it("prazo novo ou diferente mata o recibo e o item VOLTA", () => {
    const was = makeItem({ deadlineAt: null, id: "item-a" });
    const withDeadline = makeItem({
      deadlineAt: 1_700_000_000_000,
      id: "item-a",
    });
    const movedDeadline = makeItem({
      deadlineAt: 1_800_000_000_000,
      id: "item-a",
    });
    const receipt = makeReceipt({ item: was });

    expect(result({ items: [was], receipts: [receipt] }).items).toEqual([]);
    expect(
      result({ items: [withDeadline], receipts: [receipt] }).items.map(
        (item) => item.id
      )
    ).toEqual(["item-a"]);

    const scheduled = makeReceipt({ item: withDeadline });
    expect(
      result({ items: [withDeadline], receipts: [scheduled] }).items
    ).toEqual([]);
    expect(
      result({ items: [movedDeadline], receipts: [scheduled] }).items.map(
        (item) => item.id
      )
    ).toEqual(["item-a"]);
  });

  it("o item escondido nao ocupa vaga no cap nem entra nas contagens", () => {
    const visible = Array.from({ length: PENDING_ITEM_CAP }, (_, index) =>
      makeItem({ id: `item-${String(index).padStart(2, "0")}` })
    );
    const escalated = makeItem({ id: "item-extra", severity: "danger" });
    const receipt = makeReceipt({ item: escalated });
    const outcome = result({
      items: [...visible, escalated],
      receipts: [receipt],
    });

    expect(outcome.items).toHaveLength(PENDING_ITEM_CAP);
    expect(outcome.items.map((item) => item.id)).not.toContain("item-extra");
    expect(outcome.counts.total).toBe(PENDING_ITEM_CAP);
    expect(outcome.counts.bySeverity.danger).toBe(0);
    expect(outcome.truncated).toBe(false);
  });
});

describe("pendings: identidade do recibo de dispensa", () => {
  it("o cliente nao escolhe o dono: o input so tem item e superficie", () => {
    expect(Object.keys(dismissPendingItemSchema.shape).sort()).toEqual([
      "itemId",
      "surface",
    ]);
  });

  it("o recibo pertence ao ator da pendencia (player x organization)", () => {
    expect(
      toPendingActorRef({
        kind: "player",
        playerProfileId: "player-1" as never,
      })
    ).toEqual(PLAYER);
    expect(
      toPendingActorRef({
        kind: "organization",
        organizationId: "org-1" as never,
      })
    ).toEqual(ORGANIZATION);
  });

  it("o escopo do item sai do id; id sem kind registrado nao e dispensavel", () => {
    expect(
      resolvePendingItemScope("player_league_membership_suspended:membership-1")
    ).toBe("player");
    expect(
      resolvePendingItemScope("organization_league_join_requests:league-1")
    ).toBe("organization");

    for (const itemId of [
      "",
      "sem-kind",
      ":membership-1",
      "kind_inexistente:membership-1",
      "toString:membership-1",
    ]) {
      expect(resolvePendingItemScope(itemId)).toBeNull();
    }
  });
});

describe("pendings: poda dos recibos mortos no write-path (BUG-0062)", () => {
  it("item que saiu da derivacao deixa o recibo morto e o vivo intacto", () => {
    const gone = makeItem({ id: "item-saiu" });
    const kept = makeItem({ id: "item-fica" });
    const receipts = [makeReceipt({ item: gone }), makeReceipt({ item: kept })];

    const dead = selectDeadPendingDismissals({
      actor: PLAYER,
      items: [kept],
      receipts,
      surface: "home",
    });

    expect(dead.map((receipt) => receipt.itemId)).toEqual(["item-saiu"]);
    // Recibo vivo nunca entra na poda: o item "item-fica" segue escondido.
    expect(
      result({ items: [kept], receipts: receipts.slice(1) }).items
    ).toEqual([]);
  });

  it("item que PIOROU deixa o recibo morto nos tres campos do snapshot", () => {
    const baseline = makeItem({ id: "item-a" });
    const receipt = makeReceipt({ item: baseline });
    const worse = [
      makeItem({ id: "item-a", severity: "danger" }),
      makeItem({ count: 3, id: "item-a" }),
      makeItem({ deadlineAt: 1_700_000_000_000, id: "item-a" }),
    ];

    for (const item of worse) {
      expect(
        selectDeadPendingDismissals({
          actor: PLAYER,
          items: [item],
          receipts: [receipt],
          surface: "home",
        })
      ).toEqual([receipt]);
    }

    // Intacto (mesmo caso unico, com ou sem o `count` nulo) segue VIVO: e o que
    // garante a idempotencia do dismiss, que regrava o recibo do item atual.
    expect(
      selectDeadPendingDismissals({
        actor: PLAYER,
        items: [baseline, makeItem({ count: 1, id: "item-a" })],
        receipts: [receipt],
        surface: "home",
      })
    ).toEqual([]);
  });

  it("a poda e do ator + superficie: recibo alheio nunca e selecionado", () => {
    const item = makeItem({ id: "item-a" });
    const mine = makeReceipt({ item });
    const otherActor = makeReceipt({ actor: ORGANIZATION, item });
    const otherSurface = makeReceipt({ item, surface: "house" });
    const receipts = [mine, otherActor, otherSurface];

    expect(
      selectDeadPendingDismissals({
        actor: PLAYER,
        items: [item],
        receipts,
        surface: "home",
      })
    ).toEqual([]);

    // Mesmo com o item FORA da derivacao, so o recibo do ator+superficie morre.
    expect(
      selectDeadPendingDismissals({
        actor: PLAYER,
        items: [],
        receipts,
        surface: "home",
      })
    ).toEqual([mine]);
  });

  it("a poda nao muda o que a leitura esconde nem o que ela mostra", () => {
    const alive = makeItem({ id: "item-vivo" });
    const plain = makeItem({ id: "item-comum" });
    const worseBase = makeItem({ id: "item-piorou" });
    const items = [alive, plain, makeItem({ count: 4, id: "item-piorou" })];
    const receipts = [
      makeReceipt({ item: alive }),
      makeReceipt({ item: makeItem({ id: "item-saiu" }) }),
      makeReceipt({ item: worseBase }),
    ];

    const dead = selectDeadPendingDismissals({
      actor: PLAYER,
      items,
      receipts,
      surface: "home",
    });
    expect(dead.map((receipt) => receipt.itemId)).toEqual([
      "item-saiu",
      "item-piorou",
    ]);

    const before = result({ items, receipts });
    const after = result({
      items,
      receipts: receipts.filter((receipt) => !dead.includes(receipt)),
    });

    expect(before.items.map((item) => item.id)).toEqual([
      "item-comum",
      "item-piorou",
    ]);
    expect(after).toEqual(before);
  });

  it("recibo vivo de item fora do top-20 nao morre: a poda compara com a derivacao, nao com a lista cortada", () => {
    const derivation = Array.from(
      { length: PENDING_ITEM_CAP + 1 },
      (_, index) => makeItem({ id: `item-${String(index).padStart(2, "0")}` })
    );
    const tail = derivation[PENDING_ITEM_CAP]!;
    const receipts = [
      makeReceipt({ item: derivation[0]! }),
      makeReceipt({ item: tail }),
    ];
    const before = result({ items: derivation, receipts });

    expect(before.items).toHaveLength(PENDING_ITEM_CAP - 1);

    const prune = (items: readonly PendingItem[]) => {
      const dead = selectDeadPendingDismissals({
        actor: PLAYER,
        items,
        receipts,
        surface: "home",
      });

      return {
        dead: dead.map((receipt) => receipt.itemId),
        read: result({
          items: derivation,
          receipts: receipts.filter((receipt) => !dead.includes(receipt)),
        }),
      };
    };

    // Base CORRETA (a derivacao crua, como o dismiss a entrega): o recibo VIVO
    // do item fora do cap nao entra em dead e a leitura antes/depois e a MESMA
    // (mesmo conjunto e mesma contagem).
    expect(prune(derivation).dead).toEqual([]);
    expect(prune(derivation).read).toEqual(before);

    // Base CORTADA (a regressao do H1): o recibo vivo morre, o item volta para
    // a tela e a leitura muda.
    const cut = buildPendingsResult({
      items: derivation,
      scope: "player",
    }).items;
    expect(cut).toHaveLength(PENDING_ITEM_CAP);
    expect(cut.map((item) => item.id)).not.toContain(tail.id);

    const afterCut = prune(cut);
    expect(afterCut.dead).toEqual([tail.id]);
    expect(afterCut.read).not.toEqual(before);
    expect(afterCut.read.items).toHaveLength(PENDING_ITEM_CAP);
  });

  it("com 201 recibos so os vivos sobrevivem e a leitura segue igual", () => {
    // O id vivo e o ULTIMO na ordem `itemId asc` da leitura: era ele que ficava
    // fora do cap de 200 e fazia o item dispensado voltar em silencio.
    const alive = makeItem({ id: "item-vivo" });
    const stale = Array.from({ length: 200 }, (_, index) =>
      makeItem({ id: `item-morto-${String(index).padStart(3, "0")}` })
    );
    const receipts = [
      ...stale.map((item) => makeReceipt({ item })),
      makeReceipt({ item: alive }),
    ];
    const items = [alive, makeItem({ id: "item-visivel" })];

    const dead = selectDeadPendingDismissals({
      actor: PLAYER,
      items,
      receipts,
      surface: "home",
    });
    const survivors = receipts.filter((receipt) => !dead.includes(receipt));

    expect(dead).toHaveLength(200);
    expect([...dead.map((receipt) => receipt.itemId)].sort()).toEqual(
      [...stale.map((item) => item.id)].sort()
    );
    expect(survivors.map((receipt) => receipt.itemId)).toEqual(["item-vivo"]);

    const before = result({ items, receipts });
    const after = result({ items, receipts: survivors });

    expect(before.items.map((item) => item.id)).toEqual(["item-visivel"]);
    expect(after).toEqual(before);
  });
});
