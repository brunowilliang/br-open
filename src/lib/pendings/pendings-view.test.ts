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
    // `open_route` é o único tipo que exige `route`: sem destino não há botão.
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

  it("charges the membership from the action params when the item has no source", () => {
    // Item do feed não tem `source` de membership: o id viaja em `params`.
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { membershipId: "membership-1" },
            type: "pay_league_membership",
          }),
          source: { id: "league-1", type: "league" },
        })
      )
    ).toEqual({ kind: "pay_membership", sourceId: "membership-1" });
  });

  it("approves and rejects a membership with the league the mutation needs", () => {
    const item = buildItem({
      action: buildAction({
        params: { membershipId: "membership-1" },
        type: "approve_league_membership",
      }),
      params: { leagueId: "league-1" },
    });

    expect(resolvePendingAction(item)).toEqual({
      kind: "approve_membership",
      leagueId: "league-1",
      membershipId: "membership-1",
    });
    expect(
      resolvePendingAction({
        ...item,
        action: buildAction({
          params: { membershipId: "membership-1" },
          type: "reject_league_membership",
        }),
      })
    ).toEqual({
      kind: "reject_membership",
      leagueId: "league-1",
      membershipId: "membership-1",
    });
  });

  it("has no membership decision without the league the mutation requires", () => {
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: { membershipId: "membership-1" },
            type: "approve_league_membership",
          }),
        })
      )
    ).toBeNull();
  });

  it("approves and rejects a tournament entry by the entry id", () => {
    const entryAction = (type: PendingAction["type"]) =>
      buildItem({
        action: buildAction({ params: { entryId: "entry-1" }, type }),
      });

    expect(
      resolvePendingAction(entryAction("approve_tournament_entry"))
    ).toEqual({ entryId: "entry-1", kind: "approve_entry" });
    expect(
      resolvePendingAction(entryAction("reject_tournament_entry"))
    ).toEqual({ entryId: "entry-1", kind: "reject_entry" });
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: null,
            type: "approve_tournament_entry",
          }),
        })
      )
    ).toBeNull();
  });

  it("resolves each challenge decision by the challenge id", () => {
    const resolve = (type: PendingAction["type"]) =>
      resolvePendingAction(
        buildItem({
          action: buildAction({ params: { challengeId: "challenge-1" }, type }),
        })
      );

    expect(resolve("accept_challenge_proposal")).toEqual({
      challengeId: "challenge-1",
      kind: "accept_challenge_proposal",
    });
    expect(resolve("decline_challenge_proposal")).toEqual({
      challengeId: "challenge-1",
      kind: "decline_challenge_proposal",
    });
    expect(resolve("accept_challenge_cancellation")).toEqual({
      challengeId: "challenge-1",
      kind: "accept_challenge_cancellation",
    });
    expect(resolve("decline_challenge_cancellation")).toEqual({
      challengeId: "challenge-1",
      kind: "decline_challenge_cancellation",
    });
    expect(resolve("confirm_challenge_result")).toEqual({
      challengeId: "challenge-1",
      kind: "confirm_challenge_result",
    });
    expect(
      resolvePendingAction(
        buildItem({
          action: buildAction({
            params: null,
            type: "confirm_challenge_result",
          }),
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
