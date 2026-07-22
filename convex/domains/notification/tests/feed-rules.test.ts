import { describe, expect, it } from "bun:test";

import {
  canMarkNotificationReadForUser,
  isNotificationForActiveActor,
} from "../feed-rules";

describe("notification feed access", () => {
  describe("canMarkNotificationReadForUser", () => {
    it("allows read acknowledgement for any notification owned by the user", () => {
      expect(
        canMarkNotificationReadForUser({
          notification: { recipientUserId: "user-1" },
          userId: "user-1",
        })
      ).toBe(true);
    });

    it("rejects read acknowledgement for another user notification", () => {
      expect(
        canMarkNotificationReadForUser({
          notification: { recipientUserId: "user-2" },
          userId: "user-1",
        })
      ).toBe(false);
    });
  });

  describe("isNotificationForActiveActor", () => {
    const orgNotification = {
      recipientActorKind: "organization",
      recipientOrganizationId: "org-1",
      recipientPlayerProfileId: null,
    };
    const playerNotification = {
      recipientActorKind: "player",
      recipientOrganizationId: null,
      recipientPlayerProfileId: "player-1",
    };

    it("matches when actor kind + id align (organization)", () => {
      expect(
        isNotificationForActiveActor(orgNotification, {
          id: "org-1",
          kind: "organization",
        })
      ).toBe(true);
    });

    it("rejects when organization id differs", () => {
      expect(
        isNotificationForActiveActor(orgNotification, {
          id: "org-2",
          kind: "organization",
        })
      ).toBe(false);
    });

    it("rejects when actor kind differs (org notification, player viewer)", () => {
      expect(
        isNotificationForActiveActor(orgNotification, {
          id: "org-1",
          kind: "player",
        })
      ).toBe(false);
    });

    it("matches when actor kind + id align (player)", () => {
      expect(
        isNotificationForActiveActor(playerNotification, {
          id: "player-1",
          kind: "player",
        })
      ).toBe(true);
    });
  });
});
