import { describe, expect, it } from "bun:test";

import { getNotificationFeedActionState } from "./feed-action-state";

describe("notification feed action state", () => {
  it("disables read all and clear all when the feed is empty", () => {
    expect(
      getNotificationFeedActionState({
        notificationCount: 0,
        unreadCount: 0,
      })
    ).toEqual({
      isClearAllDisabled: true,
      isMarkAllReadDisabled: true,
    });
  });

  it("disables read all when every notification is already read", () => {
    expect(
      getNotificationFeedActionState({
        notificationCount: 3,
        unreadCount: 0,
      })
    ).toEqual({
      isClearAllDisabled: false,
      isMarkAllReadDisabled: true,
    });
  });

  it("enables both actions when the feed has unread notifications", () => {
    expect(
      getNotificationFeedActionState({
        notificationCount: 3,
        unreadCount: 2,
      })
    ).toEqual({
      isClearAllDisabled: false,
      isMarkAllReadDisabled: false,
    });
  });
});
