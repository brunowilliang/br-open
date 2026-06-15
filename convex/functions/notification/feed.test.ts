import { describe, expect, it } from "bun:test";

import { canMarkNotificationReadForUser } from "./feed";

describe("notification feed access", () => {
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
