import { describe, expect, it } from "bun:test";
import {
  NOTIFICATION_CATEGORY_ACTION_IDS,
  NOTIFICATION_PUSH_CATEGORY_IDS,
} from "@convex/shared/notifications/protocol";

import {
  LEAGUE_MEMBERSHIP_REQUEST_NOTIFICATION_ACTIONS,
  NOTIFICATION_ACTION_IDENTIFIERS,
  resolveNotificationResponseIntent,
} from "./response-intent";

describe("notification response intent", () => {
  const membershipRequestData = {
    eventType: "league.membership.requested",
    leagueId: "league-1",
    membershipId: "membership-1",
    notificationId: "notification-1",
    url: "/leagues/league-1?tab=requests",
  };

  it("resolves approve action for a league membership request", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier:
          NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestApprove,
        data: membershipRequestData,
      })
    ).toEqual({
      kind: "approveLeagueMembership",
      leagueId: "league-1",
      membershipId: "membership-1",
      notificationId: "notification-1",
      url: "/leagues/league-1?tab=ranking",
    });
  });

  it("resolves reject action for a league membership request", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier:
          NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestReject,
        data: membershipRequestData,
      })
    ).toEqual({
      kind: "rejectLeagueMembership",
      leagueId: "league-1",
      membershipId: "membership-1",
      notificationId: "notification-1",
    });
  });

  it("falls back to opening the notification route", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: membershipRequestData,
      })
    ).toEqual({
      kind: "open",
      notificationId: "notification-1",
      url: "/leagues/league-1?tab=requests",
    });
  });

  it("registers only approve and reject as visible membership request actions", () => {
    expect(
      LEAGUE_MEMBERSHIP_REQUEST_NOTIFICATION_ACTIONS.map(
        (action) => action.identifier
      )
    ).toEqual([
      ...NOTIFICATION_CATEGORY_ACTION_IDS[
        NOTIFICATION_PUSH_CATEGORY_IDS.leagueMembershipRequest
      ],
    ]);
  });
});
