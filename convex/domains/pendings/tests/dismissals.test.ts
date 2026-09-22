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
