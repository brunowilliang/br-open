import { describe, expect, it } from "bun:test";
import {
  NOTIFICATION_CATEGORY_ACTION_IDS,
  NOTIFICATION_PUSH_CATEGORY_IDS,
} from "@convex/shared/notifications/protocol";

import {
  buildNotificationResponseDataFromFeedItem,
  isNotificationRecipientActorActive,
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
    url: "/leagues/league-1/requests",
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
      url: "/leagues/league-1/ranking",
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
      url: "/leagues/league-1/requests",
    });
  });

  it("keeps the recipient actor in the open intent", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: {
          ...membershipRequestData,
          recipientActorKind: "player",
          recipientPlayerProfileId: "profile-1",
        },
      })
    ).toEqual({
      kind: "open",
      notificationId: "notification-1",
      recipientActor: {
        kind: "player",
        playerProfileId: "profile-1",
      },
      url: "/leagues/league-1/requests",
    });
  });

  it("keeps the recipient organization in action intents", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier:
          NOTIFICATION_ACTION_IDENTIFIERS.leagueMembershipRequestApprove,
        data: {
          ...membershipRequestData,
          recipientActorKind: "organization",
          recipientOrganizationId: "organization-1",
        },
      })
    ).toEqual({
      kind: "approveLeagueMembership",
      leagueId: "league-1",
      membershipId: "membership-1",
      notificationId: "notification-1",
      recipientActor: {
        kind: "organization",
        organizationId: "organization-1",
      },
      url: "/leagues/league-1/ranking",
    });
  });

  it("builds response data from a feed item with the recipient actor", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: buildNotificationResponseDataFromFeedItem({
          data: membershipRequestData,
          id: "notification-1",
          recipientActorKind: "organization",
          recipientOrganizationId: "organization-1",
          recipientPlayerProfileId: null,
        }),
      })
    ).toEqual({
      kind: "open",
      notificationId: "notification-1",
      recipientActor: {
        kind: "organization",
        organizationId: "organization-1",
      },
      url: "/leagues/league-1/requests",
    });
  });

  it("detects when the notification recipient actor is already active", () => {
    expect(
      isNotificationRecipientActorActive({
        activeActor: { id: "organization-1", kind: "organization" },
        recipientActor: {
          kind: "organization",
          organizationId: "organization-1",
        },
      })
    ).toBe(true);
    expect(
      isNotificationRecipientActorActive({
        activeActor: { id: "player-1", kind: "player" },
        recipientActor: {
          kind: "organization",
          organizationId: "organization-1",
        },
      })
    ).toBe(false);
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
