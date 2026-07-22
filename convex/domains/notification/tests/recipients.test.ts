import { describe, expect, it } from "bun:test";

import { getLeagueNotificationRecipientUserIds } from "../recipients";

describe("league notification recipients", () => {
  it("keeps same-user recipients because actor context can differ", () => {
    expect(
      getLeagueNotificationRecipientUserIds({
        actorUserId: "user-1",
        recipientUserIds: ["user-1"],
      })
    ).toEqual(["user-1"]);
  });

  it("deduplicates recipients without removing the actor user", () => {
    expect(
      getLeagueNotificationRecipientUserIds({
        actorUserId: "user-1",
        recipientUserIds: ["user-1", "user-2", "user-1"],
      })
    ).toEqual(["user-1", "user-2"]);
  });
});
