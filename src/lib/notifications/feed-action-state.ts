type NotificationFeedActionStateInput = {
  notificationCount: number;
  unreadCount: number;
};

export function getNotificationFeedActionState(
  input: NotificationFeedActionStateInput
) {
  const hasNotifications = input.notificationCount > 0;
  const hasUnreadNotifications = input.unreadCount > 0;

  return {
    isClearAllDisabled: !hasNotifications,
    isMarkAllReadDisabled: !(hasNotifications && hasUnreadNotifications),
  };
}
