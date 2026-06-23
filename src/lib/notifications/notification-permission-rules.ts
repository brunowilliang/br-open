export type NotificationPermissionStatus =
  | "denied"
  | "granted"
  | "undetermined";

/**
 * Whether the bootstrap flow should trigger the system permission request.
 * Only the very first time (no device registered + undetermined) — a user who
 * already decided (granted/denied) or already has a registered device is never
 * re-prompted by us (they can still change it via OS settings).
 */
export function shouldRequestPushPermission(status: {
  deviceCount: number;
  permissionStatus: NotificationPermissionStatus;
}) {
  return status.deviceCount === 0 && status.permissionStatus === "undetermined";
}

/**
 * Whether the UI should show the "open notification settings" alert. True for
 * anything that isn't an explicit grant.
 */
export function shouldOpenNotificationSettingsAlert(
  permissionStatus: NotificationPermissionStatus
) {
  return permissionStatus !== "granted";
}
