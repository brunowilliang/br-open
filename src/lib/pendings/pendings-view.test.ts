import { describe, expect, it } from "bun:test";

import type {
  PendingAction,
  PendingItem,
} from "@convex/domains/pendings/contract";

import {
  PENDING_ALERT_STATUS,
  resolvePendingAction,
  resolvePendingsForTournament,
} from "./pendings-view";

function buildItem(overrides: Partial<PendingItem>): PendingItem {
  return {
    action: null,
    actionLabel: null,
    count: null,
    deadlineAt: null,
    description: "Pendência de teste.",
    domain: "tournament",
    id: "pending:test",
    kind: "player_tournament_entries_awaiting_payment",
    moneyCents: null,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: "tournament-1", type: "tournament" },
    title: "Pendência de teste",
    ...overrides,
  };
}

function buildAction(overrides: Partial<PendingAction>): PendingAction {
  return { params: null, type: "open_route", ...overrides };
}

describe("PENDING_ALERT_STATUS", () => {
  it("maps every server severity to an alert status the component has", () => {
    expect(PENDING_ALERT_STATUS).toEqual({
      danger: "danger",
      info: "accent",
      warning: "warning",
    });
  });
});

describe("resolvePendingAction", () => {
  it("navigates for the pure-navigation action, with the item route", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "open_route",
          }),
          params: { tournamentId: "tournament-1" },
          route: "/tournaments/[tournamentId]/entries",
        })
      )
    ).toEqual({
      kind: "navigate",
      params: { entryId: "entry-1", tournamentId: "tournament-1" },
      route: "/tournaments/[tournamentId]/entries",
    });
  });

  it("omits the button without action or without a route to open", () => {
    expect(resolvePendingAction(buildItem({}))).toBeNull();
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({ type: "open_route" }),
        })
      )
    ).toBeNull();
  });

  it("pays the entry with the id the action carries", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "pay_tournament_entry",
          }),
        })
      )
    ).toEqual({ entryId: "entry-1", kind: "pay_entry" });
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({ type: "pay_tournament_entry" }),
        })
      )
    ).toBeNull();
  });

  it("responds the partner invite with the accept flag of the action", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "accept_partner_invite",
          }),
        })
      )
    ).toEqual({ accept: true, entryId: "entry-1", kind: "respond_invite" });
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "decline_partner_invite",
          }),
        })
      )
    ).toEqual({ accept: false, entryId: "entry-1", kind: "respond_invite" });
  });

  it("approves and rejects the tournament entry", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "approve_tournament_entry",
          }),
        })
      )
    ).toEqual({ entryId: "entry-1", kind: "approve_entry" });
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "reject_tournament_entry",
          }),
        })
      )
    ).toEqual({ entryId: "entry-1", kind: "reject_entry" });
  });
});

describe("resolvePendingsForTournament", () => {
  const items = [
    buildItem({
      id: "pending:by-params",
      params: { tournamentId: "tournament-1" },
    }),
    buildItem({
      id: "pending:by-source",
      kind: "player_tournament_entries_awaiting_payment",
      source: { id: "tournament-1", type: "tournament" },
    }),
    buildItem({
      id: "pending:other",
      params: { tournamentId: "tournament-2" },
      source: { id: "tournament-2", type: "tournament" },
    }),
  ];

  it("keeps the items of the tournament by params or by source", () => {
    expect(
      resolvePendingsForTournament({
        items,
        tournamentId: "tournament-1",
      }).map((item) => item.id)
    ).toEqual(["pending:by-params", "pending:by-source"]);
  });
});
