import { describe, expect, it } from "bun:test";

import type { PendingItem } from "@convex/domains/pendings/contract";
import { PENDING_KINDS_BY_SCOPE } from "@convex/domains/pendings/contract";
import {
  buildOrganizerEntryPendings,
  buildPlayerEntryPendings,
  type TournamentEntryPendingView,
} from "@convex/domains/tournament/pendings-rules";

import { resolvePendingAction } from "./pendings-view";

/**
 * Itens reais dos builders do servidor passam pelo MESMO `resolvePendingAction`
 * da tela: nenhum kind pode nascer sem ação resolvível, ou o botão some calado.
 */

const NOW_MS = Date.UTC(2026, 8, 15, 12);
const TOURNAMENT_ID = "tournament-1";

function buildEntryView(
  overrides: Partial<TournamentEntryPendingView>
): TournamentEntryPendingView {
  return {
    categoryDisplayName: "Simples Masculino",
    entryFeeCents: 500,
    entryId: "entry-1",
    invitedName: "",
    inviterName: "",
    isCreator: true,
    isInvited: false,
    registrationDeadlineAtMs: NOW_MS + 86_400_000,
    status: "awaiting_payment",
    tournamentId: TOURNAMENT_ID,
    tournamentName: "Copa Vila Tênis Clube",
    ...overrides,
  };
}

function buildEveryKindItem(): PendingItem[] {
  return [
    ...buildPlayerEntryPendings({
      entries: [buildEntryView({})],
    }),
    ...buildPlayerEntryPendings({
      entries: [
        buildEntryView({
          entryId: "entry-invited",
          inviterName: "Marina Costa",
          isCreator: false,
          isInvited: true,
          status: "pending_partner",
        }),
      ],
    }),
    ...buildPlayerEntryPendings({
      entries: [
        buildEntryView({
          invitedName: "Gustavo Lima",
          status: "pending_partner",
        }),
      ],
    }),
    ...buildPlayerEntryPendings({
      entries: [buildEntryView({ status: "pending_approval" })],
    }),
    ...buildOrganizerEntryPendings({
      tournaments: [
        {
          awaitingApprovalCount: 1,
          awaitingPaymentCount: 2,
          awaitingPaymentFeeCents: 1000,
          registrationDeadlineAtMs: NOW_MS + 86_400_000,
          tournamentId: TOURNAMENT_ID,
          tournamentName: "Copa Vila Tênis Clube",
        },
      ],
    }),
  ].filter((item): item is PendingItem => item !== null);
}

function inviteItem(): PendingItem {
  return buildEveryKindItem().find(
    (item) => item.kind === "player_tournament_partner_invite_received"
  ) as PendingItem;
}

describe("pendings server -> client parity", () => {
  const items = buildEveryKindItem();

  it("builds one item for each kind of the catalogue", () => {
    const allKinds = [
      ...PENDING_KINDS_BY_SCOPE.organization,
      ...PENDING_KINDS_BY_SCOPE.player,
    ];

    expect(items.length).toBe(allKinds.length);
    expect([...new Set(items.map((item) => item.kind))].sort()).toEqual(
      [...allKinds].sort()
    );
  });

  it("resolves an action for every CTA the item draws, primary AND secondary", () => {
    const unresolvedAction = (item: PendingItem) => {
      if (item.actionLabel !== null && resolvePendingAction(item) === null) {
        return `${item.kind}: sem ação no CTA principal`;
      }

      if (
        item.secondaryActionLabel !== null &&
        (!item.secondaryAction ||
          resolvePendingAction({ ...item, action: item.secondaryAction }) ===
            null)
      ) {
        return `${item.kind}: sem ação no CTA secundário`;
      }

      return null;
    };

    expect(items.map(unresolvedAction).filter(Boolean)).toEqual([]);
    // Prova negativa: o mesmo predicado reprova sem o rótulo do segundo botão.
    expect(unresolvedAction({ ...inviteItem(), secondaryAction: null })).toBe(
      "player_tournament_partner_invite_received: sem ação no CTA secundário"
    );
  });

  it("resolves the invite primary as accept and the secondary as decline", () => {
    const invite = items.find(
      (item) => item.kind === "player_tournament_partner_invite_received"
    ) as PendingItem;

    expect(resolvePendingAction(invite)).toEqual({
      accept: true,
      entryId: "entry-invited",
      kind: "respond_invite",
    });
    // A secundária resolve pelo SEU `action`, nunca pela resolução do primário.
    expect(
      resolvePendingAction({ ...invite, action: invite.secondaryAction })
    ).toEqual({
      accept: false,
      entryId: "entry-invited",
      kind: "respond_invite",
    });
  });

  it("never resolves the secondary button with the primary action", () => {
    const shared = items
      .filter((item) => item.secondaryAction !== null)
      .filter(
        (item) =>
          JSON.stringify(resolvePendingAction(item)) ===
          JSON.stringify(
            resolvePendingAction({ ...item, action: item.secondaryAction })
          )
      );

    expect(shared.map((item) => item.kind)).toEqual([]);
  });

  it("draws no CTA for the items the server sends without an action", () => {
    const withLabel = items
      .filter((item) => item.action === null)
      .filter((item) => item.actionLabel !== null);

    expect(withLabel).toEqual([]);
  });

  // No `open_route` o destino é o par do ITEM (`action.params` é nulo): sem o
  // `item.params` as rotas com placeholder abrem sem o id.
  it("fills every route placeholder of the navigation items", () => {
    const missing: string[] = [];

    for (const item of items) {
      if (item.action?.type !== "open_route") {
        continue;
      }

      const resolution = resolvePendingAction(item);

      if (resolution?.kind !== "navigate") {
        missing.push(`${item.kind}: sem navegação`);
        continue;
      }

      const placeholders = [...resolution.route.matchAll(/\[(\w+)\]/g)].map(
        (match) => match[1] as string
      );

      for (const placeholder of placeholders) {
        if (!resolution.params[placeholder]) {
          missing.push(`${item.kind}: ${placeholder} vazio`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
