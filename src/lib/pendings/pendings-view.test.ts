import { describe, expect, it } from "bun:test";

import type {
  PendingAction,
  PendingItem,
} from "@convex/domains/pendings/contract";

import {
  PENDING_ALERT_STATUS,
  resolvePendingAction,
  resolvePendingsForLeague,
  resolvePendingsForTournament,
} from "./pendings-view";

function buildItem(overrides: Partial<PendingItem>): PendingItem {
  return {
    action: null,
    actionLabel: null,
    count: null,
    deadlineAt: null,
    description: "Pendência de teste.",
    domain: "league",
    id: "pending:test",
    kind: "player_league_challenges_pending_actions",
    moneyCents: null,
    params: null,
    route: null,
    secondaryAction: null,
    secondaryActionLabel: null,
    severity: "warning",
    source: { id: "source-1", type: "league" },
    title: "Pendência de teste",
    ...overrides,
  };
}

function buildAction(overrides: Partial<PendingAction>): PendingAction {
  return { params: null, type: "open_route", ...overrides };
}

describe("PENDING_ALERT_STATUS", () => {
  it("maps every server severity to an alert status the component has", () => {
    // O alerta não tem `info`: os cartões aprovados mostram os itens `info` no
    // accent, e `warning`/`danger` mantêm o nome da severidade.
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
            params: { leagueId: "league-1" },
            type: "open_route",
          }),
          params: { leagueId: "league-1" },
          route: "/leagues/[leagueId]/challenges",
        })
      )
    ).toEqual({
      kind: "navigate",
      params: { leagueId: "league-1" },
      route: "/leagues/[leagueId]/challenges",
    });
  });

  it("has no action when the item has no action or the route is missing", () => {
    expect(resolvePendingAction(buildItem({}))).toBeNull();
    // `open_route` é o ÚNICO tipo que exige `route`: sem ele não há destino e o
    // renderer omite o botão (nunca botão morto).
    expect(
      resolvePendingAction(
        buildItem({ action: buildAction({ type: "open_route" }) })
      )
    ).toBeNull();
  });

  it("charges the membership for the membership payment action", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({ type: "pay_league_membership" }),
          kind: "player_league_membership_suspended",
          source: { id: "membership-1", type: "league_membership" },
        })
      )
    ).toEqual({ kind: "pay_membership", sourceId: "membership-1" });
  });

  it("charges the entry from the action params for the entry payment action", () => {
    // A inscrição a pagar vem do `action.params.entryId` (não do `source`): o
    // item pode agregar o torneio e o `source` não ser a inscrição.
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { entryId: "entry-1" },
            type: "pay_tournament_entry",
          }),
          kind: "player_tournament_entries_awaiting_payment",
          route: "/tournaments/[tournamentId]",
          source: { id: "tournament-1", type: "tournament" },
        })
      )
    ).toEqual({ entryId: "entry-1", kind: "pay_entry" });
  });

  it("tells accept from decline by the action type, never by the label", () => {
    const item = buildItem({
      action: buildAction({
        params: { entryId: "entry-1" },
        type: "accept_partner_invite",
      }),
      kind: "player_tournament_partner_invite_received",
      secondaryAction: buildAction({
        params: { entryId: "entry-1" },
        type: "decline_partner_invite",
      }),
      source: { id: "entry-1", type: "tournament_entry" },
    });

    expect(resolvePendingAction(item)).toEqual({
      accept: true,
      entryId: "entry-1",
      kind: "respond_invite",
    });
    expect(
      resolvePendingAction({ ...item, action: item.secondaryAction })
    ).toEqual({ accept: false, entryId: "entry-1", kind: "respond_invite" });
  });

  it("has no invite action without the entry the response needs", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({ params: null, type: "accept_partner_invite" }),
        })
      )
    ).toBeNull();
  });
});

describe("resolvePendingsForLeague", () => {
  const leagueItem = buildItem({
    id: "pending:league",
    kind: "player_league_challenges_pending_actions",
    params: { leagueId: "league-1" },
    source: { id: "league-1", type: "league" },
  });
  const membershipItem = buildItem({
    id: "pending:membership",
    kind: "player_league_membership_suspended",
    source: { id: "membership-1", type: "league_membership" },
  });
  const otherLeagueItem = buildItem({
    id: "pending:other-league",
    kind: "player_league_challenges_pending_actions",
    params: { leagueId: "league-2" },
    source: { id: "league-2", type: "league" },
  });
  const otherMembershipItem = buildItem({
    id: "pending:other-membership",
    kind: "player_league_membership_payment_due",
    source: { id: "membership-2", type: "league_membership" },
  });
  const items = [
    leagueItem,
    membershipItem,
    otherLeagueItem,
    otherMembershipItem,
  ];

  it("keeps the league items and the viewer's own membership items", () => {
    expect(
      resolvePendingsForLeague({
        items,
        leagueId: "league-1",
        membershipId: "membership-1",
      }).map((item) => item.id)
    ).toEqual(["pending:league", "pending:membership"]);
  });

  it("drops the membership items of another league when the viewer has none", () => {
    expect(
      resolvePendingsForLeague({
        items,
        leagueId: "league-1",
        membershipId: null,
      }).map((item) => item.id)
    ).toEqual(["pending:league"]);
  });
});

describe("resolvePendingsForTournament", () => {
  it("keeps only the items of the tournament it belongs to", () => {
    const items = [
      buildItem({
        id: "pending:this",
        kind: "player_tournament_entries_awaiting_payment",
        params: { tournamentId: "tournament-1" },
      }),
      buildItem({
        id: "pending:other",
        kind: "player_tournament_entries_awaiting_payment",
        params: { tournamentId: "tournament-2" },
      }),
      buildItem({ id: "pending:no-params" }),
    ];

    expect(
      resolvePendingsForTournament({
        items,
        tournamentId: "tournament-1",
      }).map((item) => item.id)
    ).toEqual(["pending:this"]);
  });
});
