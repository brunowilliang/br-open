import { describe, expect, it } from "bun:test";

import {
  buildNotificationResponseDataFromFeedItem,
  isNotificationRecipientActorActive,
  resolveNotificationResponseIntent,
} from "./response-intent";

describe("notification response intent", () => {
  const entryData = {
    eventType: "tournament.entry.approved",
    notificationId: "notification-1",
    tournamentId: "tournament-1",
    url: "/tournaments/tournament-1",
  };

  it("resolves the notification route as the open intent", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: entryData,
      })
    ).toEqual({
      kind: "open",
      notificationId: "notification-1",
      url: "/tournaments/tournament-1",
    });
  });

  it("keeps the recipient actor in the open intent", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: {
          ...entryData,
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
      url: "/tournaments/tournament-1",
    });
  });

  it("builds response data from a feed item with the recipient actor", () => {
    expect(
      resolveNotificationResponseIntent({
        actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
        data: buildNotificationResponseDataFromFeedItem({
          data: entryData,
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
      url: "/tournaments/tournament-1",
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
});
